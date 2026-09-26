"""A test file in the style of OreFlow's suite: a conservation property over seeded random states of the
contract envelope, a physical direction on every flotation circuit, and the contract's refusal to coerce.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe -m pytest docs\\frameworks\\09_pytest\\example.py -q
(pytest's configured test path is tests/, so this file runs only when it is named.)
"""
from __future__ import annotations

import json
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.cases.catalog import CASE_BY_ID, CASES  # noqa: E402
from pipeline.engine.circuit import simulate  # noqa: E402
from pipeline.engine.model import operating_from_dict  # noqa: E402
from pipeline.io.contract import validate  # noqa: E402

CONTRACT = json.loads((ROOT / "data" / "derived" / "contract" / "operating_contract.json").read_text(encoding="utf-8"))
FLOTATION = [c.id for c in CASES if c.plant.flotation is not None]


def random_states(case_id: str, count: int, seed: int):
    """Seeded states drawn uniformly inside the case's contract bounds (integers stay integers)."""
    inputs = CONTRACT["cases"][case_id]["inputs"]
    rng = np.random.default_rng(seed)
    for _ in range(count):
        yield {name: int(rng.integers(spec["min"], spec["max"] + 1)) if isinstance(spec["min"], int)
               else float(rng.uniform(spec["min"], spec["max"])) for name, spec in inputs.items()}


@pytest.mark.parametrize("case_id", ["copper_porphyry_soft", "gold_free_milling", "iron_magnetite_fine", "phosphate_clay"])
def test_every_accepted_state_closes_its_balance(case_id):
    case = CASE_BY_ID[case_id]
    solved = 0
    for state in random_states(case_id, 10, seed=2026):
        verdict = validate(CONTRACT, case_id, state)
        if not verdict["accepted"]:
            # inside the bounds, only the declared cross-field rule may reject a state
            assert {e["code"] for e in verdict["errors"]} == {"deslime_cut_above_half_target"}, state
            continue
        result = simulate(case.ore, case.plant, operating_from_dict(verdict["point"]))
        assert result.balance["max_relative_error"] <= 1e-9, state
        assert not any(f["code"] == "negative_mass" for f in result.flags), state
        assert 0.0 < result.metrics["recovery_pct"] < 100.0, state
        solved += 1
    assert solved > 0


@pytest.mark.parametrize("case_id", FLOTATION)
def test_a_finer_grind_costs_grinding_energy(case_id):
    case = CASE_BY_ID[case_id]
    plant = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=1.0e12))   # the target decides, not the limit
    coarse = simulate(case.ore, plant, case.nominal).metrics
    fine = simulate(case.ore, plant, case.nominal.with_values(target_p80_um=0.8 * case.nominal.target_p80_um)).metrics
    assert fine["p80_um"] < coarse["p80_um"]
    assert fine["specific_energy_grinding_kwh_t"] > coarse["specific_energy_grinding_kwh_t"]


def test_the_contract_rejects_instead_of_coercing():
    case_id = "copper_porphyry_soft"
    assert validate(CONTRACT, case_id, {"throughput_tph": "720"})["errors"][0]["code"] == "not_a_number"
    assert validate(CONTRACT, case_id, {"rougher_cells": 8.5})["errors"][0]["code"] == "not_integer"
    assert validate(CONTRACT, case_id, {"throughput_tph": float("nan")})["errors"][0]["code"] == "not_finite"
    assert validate(CONTRACT, case_id, {"mill_speed": 0.75})["errors"][0]["code"] == "unknown_input"
    assert validate(CONTRACT, case_id, {})["accepted"]          # nothing given: the nominal point
