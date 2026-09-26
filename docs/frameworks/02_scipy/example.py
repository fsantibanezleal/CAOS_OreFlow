"""SciPy in OreFlow: the COBYLA operating-point optimizer, the Latin hypercube of the uncertainty record
and the Sobol design of the learned lane, each checked against what the bake committed.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\02_scipy\\example.py
It takes a few seconds (about a hundred engine runs). Every printed claim is also asserted.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy.stats import qmc

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.cases.catalog import CASE_BY_ID  # noqa: E402
from pipeline.engine.constants import constant  # noqa: E402
from pipeline.methods.optimization import optimize  # noqa: E402
from pipeline.methods.uncertainty import inputs_for  # noqa: E402

CASE = "copper_porphyry_soft"
contract = json.loads((ROOT / "data" / "derived" / "contract" / "operating_contract.json").read_text(encoding="utf-8"))
artifact = json.loads((ROOT / "data" / "derived" / "cases" / f"{CASE}.json").read_text(encoding="utf-8"))
nominal = artifact["variants"][0]
case = CASE_BY_ID[CASE]

# 1. the optimizer, re-run from the six starts; deterministic, so it must land where the bake did
record = optimize(case, case.nominal, contract)
baked = nominal["methods"]["optimization"]
print(f"optimizer: {record['status']}, {len(record['starts'])} starts, {record['evaluations']} engine runs")
for run in record["starts"]:
    print(f"  start {run['start']} -> feasible {run['end']['feasible']} after {run['evaluations']} runs")
optimum = record["optimum"]
print(f"  optimum {optimum['decisions']}, active {optimum['active']}, gain {record['gain_pct']:.2f}% recovered metal")
assert record["status"] == baked["status"] == "optimal"
assert record["evaluations"] == baked["evaluations"]
for name, value in optimum["decisions"].items():
    assert abs(value - baked["optimum"]["decisions"][name]) <= 1e-9 * max(1.0, abs(value)), name
assert all(slack >= -1e-6 * abs(limit) for slack, limit in
           ((optimum["slacks"]["grade"], baked["constraints"]["grade"]["minimum"]),
            (optimum["slacks"]["power"], baked["constraints"]["power"]["maximum_kw"])))
print("  reproduces the committed record")

# 2. the uncertainty design: a scrambled Latin hypercube of 128 samples with the declared seed
names = inputs_for(case)
widths = np.array([constant("uncertainty.half_widths")[n] for n in names])
n, seed = int(constant("uncertainty.samples")), int(constant("uncertainty.seed"))
unit = qmc.LatinHypercube(d=len(names), scramble=True, rng=np.random.default_rng(seed)).random(n)
factors = 1.0 - widths + 2.0 * widths * unit
assert np.array_equal(factors, np.asarray(nominal["methods"]["uncertainty"]["factors"]))
strata = np.floor(unit * n).astype(int)
assert all(sorted(strata[:, j]) == list(range(n)) for j in range(len(names)))
print(f"latin hypercube: {n} samples of {names}, one per stratum of every input, identical to the committed factors")

# 3. a Sobol design: in blocks of 2^m points every one-dimensional projection is stratified too
sobol = qmc.Sobol(d=3, scramble=True, rng=np.random.default_rng(20260927)).random(256)
assert all(sorted(np.floor(sobol[:, j] * 256).astype(int)) == list(range(256)) for j in range(3))
print(f"sobol: 256 points in 3 dimensions, discrepancy {qmc.discrepancy(sobol):.2e} "
      f"against {qmc.discrepancy(np.random.default_rng(1).random((256, 3))):.2e} for independent draws")
print("every check passed")
