"""PE-29: the learned lane is evaluated on an interpolation split and leave-one-case-out on recovery,
grade and energy, with the real model classes, validation-based early stopping, GP interval coverage
and an autoencoder guard with its threshold and error rates. The design here is a small sandbox."""
from __future__ import annotations

import json
from dataclasses import replace
from functools import lru_cache
from pathlib import Path

import numpy as np

from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.model import OperatingPoint
from pipeline.io.contract import build_contract, validate
from pipeline.methods import learning

SANDBOX = dict(forest_trees=30, hgb_iterations=60, gp_training_rows=60, gp_restarts=0, max_epochs=500, patience=50,
               permutation_repeats=2, device="cpu")
CASES = tuple(CASE_BY_ID[c] for c in ("copper_porphyry_soft", "copper_porphyry_hard", "iron_magnetite_fine"))


@lru_cache(maxsize=1)
def _run(directory: str) -> dict:
    return learning.run(build_contract(), Path(directory), CASES, design_points_per_case=24, **SANDBOX)


def test_design_is_seeded_and_inside_the_envelope():
    contract = build_contract()
    case = CASE_BY_ID["phosphate_clay"]
    first = learning.design_states(case, contract, 20, 5)
    assert first == learning.design_states(case, contract, 20, 5)
    assert len(first) == 20
    widths = {"liberation_size": 0.25, "floatability": 0.25}
    for state in first:
        assert validate(contract, case.id, state["point"])["accepted"]
        for name, value in state["factors"].items():
            assert abs(value - 1.0) <= widths[name] + 1e-12


def test_features_never_see_the_case_identity():
    assert not any("case" in name for name in learning.FEATURES)
    case = CASE_BY_ID["copper_porphyry_soft"]
    renamed = replace(case, id="another_name", title=("x", "y"))
    point = OperatingPoint(**validate(build_contract(), case.id, {})["point"])
    factors = {"liberation_size": 1.0, "floatability": 1.0}
    assert learning.features(case, point, factors) == learning.features(renamed, point, factors)


def test_protocol_splits():
    case_of = np.array(["a"] * 10 + ["b"] * 10 + ["c"] * 5)
    train, test = learning.interpolation_split(case_of, 0.2, 3)
    assert set(train) | set(test) == set(range(len(case_of))) and not set(train) & set(test)
    for c in "abc":
        rows = set(np.flatnonzero(case_of == c))
        assert rows & set(train) and rows & set(test)
    folds = learning.leave_one_case_out(case_of)
    assert [f[0] for f in folds] == ["a", "b", "c"]
    for held_out, tr, te in folds:
        assert set(te) == set(np.flatnonzero(case_of == held_out))
        assert not (set(case_of[tr]) & {held_out})


def test_protocols_and_model_identity(tmp_path):
    record = _run(str(tmp_path))
    json.dumps(record, allow_nan=False)
    identity = record["identity"]
    assert identity["hist_gradient_boosting"].endswith("HistGradientBoostingRegressor")
    assert identity["random_forest"].endswith("RandomForestRegressor")
    assert identity["gaussian_process"].endswith("GaussianProcessRegressor")
    assert identity["ridge"].endswith("Ridge")
    assert set(record["targets"]) == {"recovery_pct", "log_upgrade", "specific_energy_total_kwh_t"}
    for model in record["models"]:
        for target in record["targets"]:
            assert np.isfinite(record["interpolation"]["models"][model][target]["rmse"])
            assert np.isfinite(record["summary"][model][target]["loco_rmse_mean"])
    assert [f["held_out"] for f in record["leave_one_case_out"]] == [c.id for c in CASES]
    for fold in record["leave_one_case_out"]:
        assert fold["train_rows"] + fold["test_rows"] == record["design"]["rows"]
    # early stopping on validation loss, with the best weights restored
    mlp = record["interpolation"]["mlp_training"]
    assert 1 <= mlp["best_epoch"] <= mlp["epochs_run"] <= SANDBOX["max_epochs"]
    assert mlp["epochs_run"] - mlp["best_epoch"] <= SANDBOX["patience"]
    if mlp["stopped_early"]:
        assert mlp["epochs_run"] - mlp["best_epoch"] == SANDBOX["patience"]
    assert mlp["validation_rows"] > 0 and mlp["best_validation_mse"] <= min(mlp["validation_history"])
    # GP interval coverage
    for target in record["targets"]:
        gp = record["interpolation"]["models"]["gaussian_process"][target]
        assert 0.0 <= gp["coverage_95"] <= 1.0 and gp["mean_half_width"] > 0.0
    # the guard: a threshold, false alarms on in-envelope states, false accepts on shifted ones
    g = record["guard"]
    assert g["threshold"] > 0.0 and 0.0 <= g["false_alarm_rate"] <= 1.0 and 0.0 <= g["false_accept_rate"] <= 1.0
    assert g["false_accept_rate"] < 1.0 - g["false_alarm_rate"]
    # permutation importance for every feature and target
    for target in record["targets"]:
        assert set(record["interpolation"]["permutation_importance"][target]) == set(learning.FEATURES)
    # ONNX exports reproduce PyTorch and ship their scalers
    for export in record["final"]["exports"].values():
        assert (tmp_path / export["path"]).stat().st_size == export["bytes"]
        assert export["max_abs_difference"] <= 1e-5
    scalers = json.loads((tmp_path / "process_surrogate.json").read_text(encoding="utf-8"))
    assert scalers["features"] == list(learning.FEATURES) and scalers["guard_threshold"] == record["final"]["guard_threshold"]
