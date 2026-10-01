"""SciPy in OreFlow: the Sobol design of the learned lane and the triangular solve of the optimizer's screen, each
checked against what the bake committed, and the uncertainty design OreFlow draws itself.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\02_scipy\\example.py
It takes a few seconds. Every printed claim is also asserted.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy.linalg import solve_triangular
from scipy.stats import qmc

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.cases.catalog import CASE_BY_ID  # noqa: E402
from pipeline.engine.constants import constant  # noqa: E402
from pipeline.methods.learning import _ore_factors, features  # noqa: E402
from pipeline.methods.sampling import latin_hypercube  # noqa: E402
from pipeline.methods.screen import Screen  # noqa: E402
from pipeline.methods.uncertainty import inputs_for  # noqa: E402

CASE = "copper_porphyry_soft"
artifact = json.loads((ROOT / "data" / "derived" / "cases" / f"{CASE}.json").read_text(encoding="utf-8"))
nominal = artifact["variants"][0]
case = CASE_BY_ID[CASE]

# 1. a Sobol design: in blocks of 2^m points every one-dimensional projection is stratified
sobol = qmc.Sobol(d=3, scramble=True, rng=np.random.default_rng(20260927)).random(256)
assert all(sorted(np.floor(sobol[:, j] * 256).astype(int)) == list(range(256)) for j in range(3))
print(f"sobol: 256 points in 3 dimensions, discrepancy {qmc.discrepancy(sobol):.2e} "
      f"against {qmc.discrepancy(np.random.default_rng(1).random((256, 3))):.2e} for independent draws")

# 2. the screen's variance at the case's nominal state, with SciPy's triangular solve and with a forward
# substitution by hand; both must give the half-width the export recorded for this state
screen = Screen(ROOT / "models")
reference = next(r for r in json.loads((ROOT / "models" / "process_screen.json").read_text(encoding="utf-8"))["reference"]
                 if r["case_id"] == CASE)
x = np.asarray(features(case, case.nominal, {name: 1.0 for name in _ore_factors(case)}))
xs = (x - screen.feature_mean) / screen.feature_scale
k = screen.amplitude * np.exp(-0.5 * ((xs / screen.length - screen.scaled) ** 2).sum(axis=1))
v_scipy = solve_triangular(screen.lower, k, lower=True, check_finite=False)
v_hand = np.zeros_like(k)
for i in range(len(k)):
    v_hand[i] = (k[i] - screen.lower[i, :i] @ v_hand[:i]) / screen.lower[i, i]
for v in (v_scipy, v_hand):
    half_width = screen.z * np.sqrt(max(0.0, screen.amplitude + screen.noise - v @ v)) * screen.y_std
    assert abs(half_width - reference["half_width"]) <= 1e-9 * reference["half_width"], half_width
print(f"screen: at the nominal state the 95% half-width on recovery is {reference['half_width']:.3f} points, "
      f"from a {len(k)}-row forward substitution; SciPy and the loop agree within "
      f"{np.max(np.abs(v_scipy - v_hand)):.1e}, and the bound is {constant('optimization.screen_half_width_pct')} points")

# 3. the uncertainty design: a Latin hypercube of 128 samples with the declared seed, from OreFlow's SplitMix64
# stream (methods/sampling.py), which the browser repeats bit for bit; SciPy's stratifies the same way from
# NumPy's stream, which a browser cannot repeat
names = inputs_for(case)
widths = np.array([constant("uncertainty.half_widths")[n] for n in names])
n, seed = int(constant("uncertainty.samples")), int(constant("uncertainty.seed"))
unit = np.asarray(latin_hypercube(n, len(names), seed))
factors = 1.0 - widths + 2.0 * widths * unit
assert np.array_equal(factors, np.asarray(nominal["methods"]["uncertainty"]["factors"]))
scipy_unit = qmc.LatinHypercube(d=len(names), scramble=True, rng=np.random.default_rng(seed)).random(n)
for design in (unit, scipy_unit):
    strata = np.floor(design * n).astype(int)
    assert all(sorted(strata[:, j]) == list(range(n)) for j in range(len(names)))
print(f"latin hypercube: {n} samples of {names}, one per stratum of every input, identical to the committed factors")
print("every check passed")
