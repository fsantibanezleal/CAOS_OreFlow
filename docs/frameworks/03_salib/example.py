"""SALib in OreFlow: Sobol indices by Saltelli's design, first on the Ishigami function, whose indices are
known exactly, then the soft porphyry's committed sensitivity record re-run from scratch.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\03_salib\\example.py
The second part runs the engine 1536 times (about half a minute). Every printed claim is also asserted.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from SALib.analyze import sobol as sobol_analyze
from SALib.sample import sobol as sobol_sample

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.cases.catalog import CASE_BY_ID  # noqa: E402
from pipeline.methods.uncertainty import sensitivity  # noqa: E402

# 1. Ishigami: f = sin x1 + a sin^2 x2 + b x3^4 sin x1 on [-pi, pi]^3 (a = 7, b = 0.1), exact indices
a, b = 7.0, 0.1
v1 = 0.5 * (1.0 + b * math.pi ** 4 / 5.0) ** 2
v2 = a ** 2 / 8.0
v13 = 8.0 / 225.0 * b ** 2 * math.pi ** 8
variance = v1 + v2 + v13
exact_s1 = np.array([v1, v2, 0.0]) / variance
exact_st = np.array([v1 + v13, v2, v13]) / variance
problem = {"num_vars": 3, "names": ["x1", "x2", "x3"], "bounds": [[-math.pi, math.pi]] * 3}
x = sobol_sample.sample(problem, 4096, calc_second_order=False, scramble=True, seed=20260926)
y = np.sin(x[:, 0]) + a * np.sin(x[:, 1]) ** 2 + b * x[:, 2] ** 4 * np.sin(x[:, 0])
est = sobol_analyze.analyze(problem, y, calc_second_order=False, num_resamples=200, seed=20260926)
print(f"Ishigami, {len(x)} evaluations:")
for i, name in enumerate(problem["names"]):
    print(f"  {name}: S1 {est['S1'][i]:6.3f} (exact {exact_s1[i]:.3f}), ST {est['ST'][i]:6.3f} (exact {exact_st[i]:.3f})")
    assert abs(est["S1"][i] - exact_s1[i]) < 0.03 and abs(est["ST"][i] - exact_st[i]) < 0.03

# 2. the soft porphyry's record, re-run with the declared settings: it must equal the committed one
case = CASE_BY_ID["copper_porphyry_soft"]
record = sensitivity(case, case.nominal)
artifact = json.loads((ROOT / "data" / "derived" / "cases" / "copper_porphyry_soft.json").read_text(encoding="utf-8"))
baked = artifact["variants"][0]["methods"]["sensitivity"]
assert json.dumps(record, sort_keys=True) == json.dumps(baked, sort_keys=True)
recovery = record["indices"]["recovery_pct"]
print(f"soft porphyry recovery, {record['evaluations']} engine runs (identical to the committed record):")
for name in record["inputs"]:
    print(f"  {name:16s} S1 {recovery['S1'][name]:6.3f} +- {recovery['S1_conf'][name]:.3f}   "
          f"ST {recovery['ST'][name]:6.3f} +- {recovery['ST_conf'][name]:.3f}")
energy = record["indices"]["specific_energy_grinding_kwh_t"]
assert energy["ST"]["floatability"] == 0.0 and max(energy["ST"], key=energy["ST"].get) == "work_index"
print("  grinding energy: the work index leads and floatability is exactly zero, as the physics requires")
print("every check passed")
