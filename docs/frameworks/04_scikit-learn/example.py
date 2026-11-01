"""scikit-learn in OreFlow: conditional and common-case recovery scores, then real small fits.

Run from the repository root with the accelerator environment:
    .venv-gpu/Scripts/python.exe docs/frameworks/04_scikit-learn/example.py
The fresh part simulates 768 states and fits Ridge, forest and GP models.
Rejected transfer scores remain unavailable; model comparisons declare their populations.
"""
from __future__ import annotations

import json
import math
import statistics
import sys
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel
from sklearn.linear_model import Ridge

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.cases.catalog import CASES  # noqa: E402
from pipeline.methods import learning  # noqa: E402


def fold_summary(folds: list[dict], model: str, selected: list[str] | None = None) -> dict:
    """Equal-fold mean over explicitly scored recovery records, retaining every attempt."""
    scores = {}
    for fold in folds:
        name = fold["held_out"]
        if name in scores:
            raise ValueError(f"Duplicate fold: {name}")
        score = fold["models"][model]["recovery_pct"]
        value = score["rmse"]
        if score["valid_for_scoring"] is True:
            if score["status"] != "scored" or type(value) not in (int, float) or not math.isfinite(value):
                raise ValueError(f"Invalid scored recovery: {model}/{name}")
        elif score["valid_for_scoring"] is False:
            if score["status"] != "rejected-transfer" or value is not None:
                raise ValueError(f"Invalid rejected recovery: {model}/{name}")
        else:
            raise ValueError(f"Missing scoring decision: {model}/{name}")
        scores[name] = score
    evaluated = [name for name, score in scores.items() if score["valid_for_scoring"]]
    rejected = [name for name in scores if name not in evaluated]
    cohort = evaluated if selected is None else selected
    if len(set(cohort)) != len(cohort) or any(name not in evaluated for name in cohort):
        raise ValueError(f"Comparison cohort contains an unavailable or duplicate fold: {model}")
    values = [scores[name]["rmse"] for name in cohort]
    return {"attempted": len(scores), "evaluated": len(evaluated), "rejected": len(rejected),
            "evaluated_folds": evaluated, "rejected_folds": rejected, "cohort": list(cohort),
            "mean": statistics.fmean(values) if values else None}


def common_folds(folds: list[dict], models: list[str]) -> list[str]:
    if not models:
        raise ValueError("A common comparison needs at least one model")
    populations = [set(fold_summary(folds, model)["evaluated_folds"]) for model in models]
    return [fold["held_out"] for fold in folds if all(fold["held_out"] in p for p in populations)]


def display_score(value: float | None) -> str:
    return "unavailable" if value is None else f"{value:.2f}"


def main() -> None:
    record = json.loads((ROOT / "data/derived/learning.json").read_text(encoding="utf-8"))
    folds, models = record["leave_one_case_out"], record["models"]
    print(f"committed {record['engine_version']}: {record['design']['rows']} states; recovery RMSE in points")
    print("Conditional equal-fold means: each model uses its own evaluated cases; not a common-case ranking.")
    for model in models:
        summary = record["summary"][model]["recovery_pct"]
        own = fold_summary(folds, model)
        assert summary["loco_folds"] == {key: own[label] for key, label in
                                         (("attempted", "attempted"), ("scored", "evaluated"), ("rejected", "rejected"))}
        expected = summary["loco_rmse_mean"]
        assert expected is None if own["mean"] is None else expected is not None and abs(expected - own["mean"]) < 1e-12
        if own["mean"] is not None:
            assert own["mean"] > summary["interpolation_rmse"]
        print(f"  {model:24s} interpolation {display_score(summary['interpolation_rmse'])}; "
              f"conditional LOCO {display_score(own['mean'])}; attempted/evaluated/rejected "
              f"{own['attempted']}/{own['evaluated']}/{own['rejected']}; rejected {own['rejected_folds']}")
    common = common_folds(folds, models)
    stored = record["common_cohorts"]["leave_one_case_out"]["recovery_pct"]
    excluded = [fold["held_out"] for fold in folds if fold["held_out"] not in common]
    assert (stored["attempted"], stored["folds"], stored["excluded"]) == (len(folds), common, excluded)
    print(f"Common-case recovery comparison: attempted {len(folds)}, evaluated {len(common)}, excluded {len(excluded)}: {excluded}")
    for model in models:
        matched = fold_summary(folds, model, common)["mean"]
        expected = stored["models"][model]["rmse_mean"]
        assert expected is None if matched is None else expected is not None and abs(expected - matched) < 1e-12
        print(f"  {model:24s} common-case equal-fold RMSE {display_score(matched)}")

    contract = json.loads((ROOT / "data/derived/contract/operating_contract.json").read_text(encoding="utf-8"))
    design = learning.build_design(contract, CASES, per_case=64, seed=11)
    x, y, case_of = design["x"], design["y"][:, 0], design["case"]
    print(f"fresh design: {len(x)} states, {x.shape[1]} features, simulated in {design['seconds']:.1f} s")

    def rmse(truth, prediction):
        assert np.isfinite(truth).all() and np.isfinite(prediction).all()
        return float(np.sqrt(np.mean((prediction - truth) ** 2)))

    def fit(model, training):
        scale = learning.Standardizer(x[training])
        return model.fit(scale(x[training]), y[training]), scale

    train, test = learning.interpolation_split(case_of, 0.2, seed=11)
    interpolation = {}
    for name, model in (("ridge", Ridge(alpha=1.0)),
                        ("random_forest", RandomForestRegressor(n_estimators=150, min_samples_leaf=2, random_state=11))):
        fitted, scale = fit(model, train)
        interpolation[name] = rmse(y[test], fitted.predict(scale(x[test])))
    fresh_folds = []
    for held_out, tr, te in learning.leave_one_case_out(case_of):
        fold = {"held_out": held_out, "models": {}}
        for name, model in (("ridge", Ridge(alpha=1.0)),
                            ("random_forest", RandomForestRegressor(n_estimators=150, min_samples_leaf=2, random_state=11))):
            fitted, scale = fit(model, tr)
            score = learning._scores(
                y[te], fitted.predict(scale(x[te])), reference=y,
                evaluation={"method": name, "target": "recovery_pct", "protocol": "leave_one_case_out",
                            "fold": held_out, "seed": 11}, allow_rejection=True,
            )
            fold["models"][name] = {"recovery_pct": score}
        fresh_folds.append(fold)
    for name in interpolation:
        own = fold_summary(fresh_folds, name)
        print(f"  fresh {name:13s} interpolation {interpolation[name]:.2f}, conditional LOCO {display_score(own['mean'])}; "
              f"attempted/evaluated/rejected {own['attempted']}/{own['evaluated']}/{own['rejected']}; "
              f"rejected {own['rejected_folds']}")
    fresh_common = common_folds(fresh_folds, list(interpolation))
    print(f"Fresh common-case comparison: attempted {len(fresh_folds)}, evaluated {len(fresh_common)}, "
          f"excluded {len(fresh_folds)-len(fresh_common)}")
    for name in interpolation:
        print(f"  {name}: common-case RMSE {display_score(fold_summary(fresh_folds, name, fresh_common)['mean'])}")
    forest = fold_summary(fresh_folds, "random_forest")
    if forest["mean"] is not None:
        assert forest["mean"] > interpolation["random_forest"]
    else:
        assert forest["rejected"] == forest["attempted"]
        print("All forest transfer folds rejected: no finite transfer-error comparison is available.")

    kernel = ConstantKernel(1.0) * RBF(length_scale=np.ones(x.shape[1]), length_scale_bounds=(0.01, 1e5)) \
        + WhiteKernel(1e-3, noise_level_bounds=(1e-9, 10.0))
    gp, scale = fit(GaussianProcessRegressor(kernel=kernel, normalize_y=True, n_restarts_optimizer=1, random_state=11), train)
    mean, std = gp.predict(scale(x[test]), return_std=True)
    coverage = float(np.mean(np.abs(y[test] - mean) <= 1.959963984540054 * std))
    scales = np.atleast_1d(gp.kernel_.k1.k2.length_scale)
    off = [f for f, s in zip(learning.FEATURES, scales) if s >= 0.99e5]
    print(f"  gaussian process: RMSE {rmse(y[test], mean):.2f}, 95% interval coverage {coverage:.2f}, "
          f"length scale at its bound (switched off) for: {', '.join(off) or 'none'}")
    assert 0.0 <= coverage <= 1.0
    print("every check passed")


if __name__ == "__main__":
    main()
