"""PE-29: the learned lane is evaluated on an interpolation split and leave-one-case-out on recovery,
grade and energy, with the real model classes, validation-based early stopping, GP interval coverage
and an autoencoder guard with its threshold and error rates. The design here is a small sandbox."""
from __future__ import annotations

import json
from dataclasses import replace
from functools import lru_cache
from pathlib import Path

import numpy as np
import pytest

from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.model import OperatingPoint
from pipeline.io.contract import build_contract, validate
from pipeline.methods import learning

SANDBOX = dict(forest_trees=30, hgb_iterations=60, gp_training_rows=40, gp_restarts=0, max_epochs=500, patience=50,
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
    # permutation importance for every feature and target, shuffled within each case: a feature constant within every
    # case scores exactly 0 (L-04; 0.08.001 shuffled across cases and gave the carrier's composite content 2.82 points)
    for target in record["targets"]:
        imp = record["interpolation"]["permutation_importance"][target]
        assert set(imp) == set(learning.FEATURES)
        assert imp["carrier_composite_content"] == 0.0 and imp["carrier_density_t_m3"] == 0.0
    # L-01: the two chalcopyrite cases form one ore group, held out together
    assert record["transfer_groups"] == {"copper_porphyry_soft": "Cu:chalcopyrite", "copper_porphyry_hard": "Cu:chalcopyrite",
                                         "iron_magnetite_fine": "Fe:magnetite"}
    [fold] = record["leave_one_group_out"]
    assert fold["cases"] == ["copper_porphyry_soft", "copper_porphyry_hard"]
    assert fold["train_rows"] + fold["test_rows"] == record["design"]["rows"]
    # L-03: every interpolation score beside its within-case R2 and the predictor that knows only the case
    for model in record["models"]:
        for target in record["targets"]:
            row = record["summary"][model][target]
            assert np.isfinite(row["interpolation_r2_within_case"]) and np.isfinite(row["case_mean_r2"])
            assert np.isfinite(row["transfer_rmse_mean"]) and np.isfinite(row["transfer_r2_median"])
            assert row["interpolation_r2_within_case"] <= row["interpolation_r2"] + 1e-12 or row["case_mean_r2"] < 0.0
    # ONNX exports reproduce PyTorch and ship their scalers
    for export in record["final"]["exports"].values():
        assert (tmp_path / export["path"]).stat().st_size == export["bytes"]
        assert export["max_abs_difference"] <= 1e-5
    scalers = json.loads((tmp_path / "process_surrogate.json").read_text(encoding="utf-8"))
    assert scalers["features"] == list(learning.FEATURES) and scalers["guard_threshold"] == record["final"]["guard_threshold"]


def test_the_records_the_pages_quote(tmp_path):
    """M-07, M-08, M-11, M-16 and M-21 (review of 2026-10-02): what the Benchmark and the manuscript quote is recorded."""
    record = _run(str(tmp_path))
    # M-16: the guard's acceptance over distances, both directions; the 0.5 upward point is the headline rate
    curve = record["guard"]["acceptance_by_distance"]
    assert [c["distance"] for c in curve] == list(learning.settings()["ood_shifts"])
    half = next(c for c in curve if c["distance"] == 0.5)
    assert half["upward"] == pytest.approx(record["guard"]["false_accept_rate"])
    assert all(0.0 <= c[d] <= 1.0 for c in curve for d in ("upward", "downward"))
    # M-08: the GP's coverage under leave one case out, beside the interpolation's
    for target in record["targets"]:
        s = record["summary"]["gaussian_process"][target]
        assert 0.0 <= s["loco_coverage_worst"] <= s["loco_coverage_pooled"] <= 1.0
        assert s["interpolation_coverage"] == record["interpolation"]["models"]["gaussian_process"][target]["coverage_95"]
    # M-07: each held-out case carries its own spread
    for fold in record["leave_one_case_out"]:
        assert set(fold["spread"]) == set(record["targets"]) and all(v >= 0.0 for v in fold["spread"].values())
    # M-11: the other models refitted on the GP's rows
    assert set(record["equal_rows"]) == {"ridge", "random_forest", "hist_gradient_boosting"}
    # M-21: the network over five seeds, the first the record's own
    seeds = record["mlp_seeds"]
    assert len(seeds["seeds"]) == 5 and seeds["seeds"][0] == record["design"]["seed"]
    for target in record["targets"]:
        s = seeds["summary"][target]
        assert s["interpolation_rmse"][0] == pytest.approx(record["interpolation"]["models"]["mlp"][target]["rmse"], rel=1e-6)
        assert len(s["loco_rmse_mean"]) == len(s["loco_r2_median"]) == 5


def test_reused_learning_cannot_ship(tmp_path):
    # a development bake reuses an earlier learned lane and marks it; the artifact checks CI runs reject that mark,
    # and only the bake's own validation, which knows it is a development bake, allows it
    import importlib.util
    import json
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    spec = importlib.util.spec_from_file_location("check_artifacts", root / "scripts" / "check_artifacts.py")
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    record = json.loads((root / "data" / "derived" / "learning.json").read_text(encoding="utf-8"))
    version, digest = record["engine_version"], record["contract_digest"]
    record["reused"] = {"from_contract_digest": digest, "from_engine_version": version}
    (tmp_path / "learning.json").write_text(json.dumps(record), encoding="utf-8")
    shipped = checker.check_learning(tmp_path, root / "models", version, digest)
    assert any("reused by a development bake" in e for e in shipped)
    developing = checker.check_learning(tmp_path, root / "models", version, digest, allow_reused=True)
    assert not any("reused" in e for e in developing)
