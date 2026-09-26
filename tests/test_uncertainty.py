"""PE-28: the uncertainty record is seeded and reports P05, P50, P95 and constraint probabilities; the
sensitivity record carries first-order and total Sobol indices."""
from __future__ import annotations

import json
from functools import lru_cache

import numpy as np

from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.constants import constant
from pipeline.methods.uncertainty import OUTPUTS, inputs_for, sensitivity, uncertainty


@lru_cache(maxsize=None)
def _mc(case_id: str, seed: int | None = None) -> str:
    case = CASE_BY_ID[case_id]
    return json.dumps(uncertainty(case, case.nominal, seed=seed), allow_nan=False)


def test_seeded_quantiles_and_sobol():
    record = json.loads(_mc("copper_porphyry_soft"))
    assert record["samples"] == int(constant("uncertainty.samples")) and record["seed"] == int(constant("uncertainty.seed"))
    assert _mc("copper_porphyry_soft") == json.dumps(uncertainty(CASE_BY_ID["copper_porphyry_soft"],
                                                                 CASE_BY_ID["copper_porphyry_soft"].nominal), allow_nan=False)
    widths = constant("uncertainty.half_widths")
    names = list(record["inputs"])
    factors = np.array(record["factors"])
    for j, name in enumerate(names):
        assert np.all(factors[:, j] >= 1.0 - widths[name]) and np.all(factors[:, j] <= 1.0 + widths[name])
    for key in OUTPUTS:
        out = record["outputs"][key]
        assert out["p05"] <= out["p50"] <= out["p95"]
        values = np.array(out["values"])
        assert len(values) == record["samples"]
        assert np.allclose(np.quantile(values, [0.05, 0.5, 0.95]), [out["p05"], out["p50"], out["p95"]], rtol=0, atol=0)
    probabilities = record["probabilities"]
    assert all(0.0 <= v <= 1.0 for v in probabilities.values())
    assert probabilities["all_constraints"] <= min(v for k, v in probabilities.items() if k != "all_constraints")
    assert record["max_balance_error"] <= 1e-9
    other = json.loads(_mc("copper_porphyry_soft", seed=7))
    assert other["factors"] != record["factors"]

    case = CASE_BY_ID["copper_porphyry_soft"]
    s = sensitivity(case, case.nominal, base_samples=32)
    assert s["evaluations"] == 32 * (len(names) + 2)
    energy = s["indices"]["specific_energy_grinding_kwh_t"]
    # grinding does not depend on floatability, so its indices are exactly zero, not merely small
    assert energy["ST"]["floatability"] == 0.0 and energy["S1"]["floatability"] == 0.0
    assert max(energy["ST"], key=energy["ST"].get) == "work_index"
    for key in OUTPUTS:
        idx = s["indices"][key]
        for name in names:
            assert idx["ST"][name] >= idx["S1"][name] - idx["S1_conf"][name] - idx["ST_conf"][name]
            assert idx["ST"][name] >= -idx["ST_conf"][name]


def test_magnetite_has_no_floatability_input_and_sobol_is_seeded():
    case = CASE_BY_ID["iron_magnetite_fine"]
    assert "floatability" not in inputs_for(case)
    first = sensitivity(case, case.nominal, base_samples=32)
    again = sensitivity(case, case.nominal, base_samples=32)
    assert json.dumps(first) == json.dumps(again)
    assert set(first["inputs"]) == {"work_index", "head_grade", "liberation_size"}


def test_grade_margin_shows_in_the_probability():
    # the magnetite grade (65.7% Fe) sits close to its 65% specification, the soft porphyry (26.2% Cu)
    # well above its 24%: the probabilities of meeting the specification must reflect that order
    magnetite = json.loads(_mc("iron_magnetite_fine"))["probabilities"]["grade_meets_spec"]
    copper = json.loads(_mc("copper_porphyry_soft"))["probabilities"]["grade_meets_spec"]
    assert magnetite < copper
