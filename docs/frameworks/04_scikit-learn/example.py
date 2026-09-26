"""scikit-learn in OreFlow: the learned lane's two protocols, interpolation inside the cases and leave one
case out, first read from the committed record and re-derived from its folds, then run afresh on a small
design so the gap between them can be watched forming.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\04_scikit-learn\\example.py
The fresh part simulates 768 states (about twenty seconds) and fits small models. Every printed claim is asserted.
"""
from __future__ import annotations

import json
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

# 1. the committed record: the summary must be the mean of its own folds
record = json.loads((ROOT / "data" / "derived" / "learning.json").read_text(encoding="utf-8"))
print(f"committed record: {record['design']['rows']} states, recovery RMSE in points (interpolation / leave one case out)")
for model in record["models"]:
    summary = record["summary"][model]["recovery_pct"]
    folds = [f["models"][model]["recovery_pct"]["rmse"] for f in record["leave_one_case_out"]]
    assert abs(summary["loco_rmse_mean"] - float(np.mean(folds))) < 1e-12
    assert summary["loco_rmse_mean"] > summary["interpolation_rmse"]
    print(f"  {model:24s} {summary['interpolation_rmse']:6.2f} / {summary['loco_rmse_mean']:6.2f}")

# 2. a fresh design of 64 states per case (the lane uses 256), the same features and targets
contract = json.loads((ROOT / "data" / "derived" / "contract" / "operating_contract.json").read_text(encoding="utf-8"))
design = learning.build_design(contract, CASES, per_case=64, seed=11)
x, y, case_of = design["x"], design["y"][:, 0], design["case"]   # target 0: recovery (%)
print(f"fresh design: {len(x)} states, {x.shape[1]} features, simulated in {design['seconds']:.1f} s")


def rmse(truth: np.ndarray, pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((pred - truth) ** 2)))


def fit(model, train: np.ndarray):
    scale = learning.Standardizer(x[train])        # fitted on the training rows only
    return model.fit(scale(x[train]), y[train]), scale


train, test = learning.interpolation_split(case_of, 0.2, seed=11)
interpolation = {}
for name, model in (("ridge", Ridge(alpha=1.0)), ("random_forest", RandomForestRegressor(n_estimators=150, min_samples_leaf=2, random_state=11))):
    fitted, scale = fit(model, train)
    interpolation[name] = rmse(y[test], fitted.predict(scale(x[test])))
loco = {"ridge": [], "random_forest": []}
for held_out, tr, te in learning.leave_one_case_out(case_of):
    for name, model in (("ridge", Ridge(alpha=1.0)), ("random_forest", RandomForestRegressor(n_estimators=150, min_samples_leaf=2, random_state=11))):
        fitted, scale = fit(model, tr)
        loco[name].append(rmse(y[te], fitted.predict(scale(x[te]))))
for name in interpolation:
    print(f"  {name:13s} interpolation {interpolation[name]:6.2f}, leave one case out {np.mean(loco[name]):6.2f} "
          f"(worst {max(loco[name]):.1f}, held out {learning.leave_one_case_out(case_of)[int(np.argmax(loco[name]))][0]})")
assert np.mean(loco["random_forest"]) > interpolation["random_forest"]

# 3. the Gaussian process with one length scale per feature, and the coverage of its 95% intervals
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
