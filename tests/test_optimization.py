"""PE-27: the constrained optimizer maximizes recovered primary payable subject to grade, power and water
constraints, reports the slacks, and never reports an infeasible point as optimal."""
from __future__ import annotations

from dataclasses import replace
from functools import lru_cache

import pytest

from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.engine.constants import constant
from pipeline.engine.model import GradeSpec
from pipeline.io.contract import build_contract
from pipeline.methods.optimization import decisions_for, optimize

TOL = float(constant("optimization.feasibility_tolerance"))
ACTIVE = float(constant("optimization.active_tolerance"))


@lru_cache(maxsize=None)
def _record(case_id: str) -> dict:
    case = CASE_BY_ID[case_id]
    return optimize(case, case.nominal, build_contract())


@pytest.mark.parametrize("case_id", ["copper_porphyry_hard", "iron_magnetite_fine", "copper_oxide", "gold_free_milling"])
def test_constraints_respected(case_id):
    case = CASE_BY_ID[case_id]
    record = _record(case_id)
    assert record["status"] == "optimal"
    optimum = record["optimum"]
    assert list(optimum["decisions"]) == list(decisions_for(case.plant.family))
    for name, value in optimum["decisions"].items():
        low, high = record["bounds"][name]
        assert low <= value <= high
    # independent re-simulation of the reported point
    point = case.nominal.with_values(**optimum["decisions"])
    m = simulate(case.ore, case.plant, point).metrics
    assert m["concentrate_grade"] >= case.plant.grade_spec.minimum * (1.0 - TOL)
    assert m["required_mill_power_kw"] <= case.plant.mill.installed_power_kw * (1.0 + TOL)
    assert m["water_intensity_m3_t"] <= case.plant.water_limit_m3_t * (1.0 + TOL)
    assert optimum["recovered_tph"] == pytest.approx(m["recovered_primary_tph"], rel=1e-12)
    assert optimum["slacks"]["grade"] == pytest.approx(m["concentrate_grade"] - case.plant.grade_spec.minimum, abs=1e-9)
    assert optimum["slacks"]["power"] == pytest.approx(case.plant.mill.installed_power_kw - m["required_mill_power_kw"], abs=1e-6)
    assert optimum["slacks"]["water"] == pytest.approx(case.plant.water_limit_m3_t - m["water_intensity_m3_t"], abs=1e-9)
    # the optimum is at least as good as every feasible start and as the base when the base is feasible
    for run in record["starts"]:
        if run["end"]["feasible"]:
            assert optimum["recovered_tph"] >= run["end"]["recovered_tph"] * (1.0 - 1e-12)
    if record["base"]["feasible"]:
        assert optimum["recovered_tph"] >= record["base"]["recovered_tph"]
    limits = {"grade": case.plant.grade_spec.minimum, "power": case.plant.mill.installed_power_kw, "water": case.plant.water_limit_m3_t}
    for constraint in optimum["active"]:
        assert abs(optimum["slacks"][constraint]) <= ACTIVE * limits[constraint]


def test_infeasible_specification_is_never_optimal():
    case = CASE_BY_ID["copper_porphyry_soft"]
    impossible = replace(case, plant=replace(case.plant, grade_spec=GradeSpec("Cu", 40.0)))
    record = optimize(impossible, impossible.nominal, build_contract())
    assert record["status"] == "infeasible" and record["optimum"] is None
    assert record["least_violating"]["slacks"]["grade"] < 0.0
    assert not record["least_violating"]["feasible"]


def test_off_specification_base_is_restored():
    # the hard porphyry runs 23.7% Cu at nominal against a 24% specification
    record = _record("copper_porphyry_hard")
    assert not record["base"]["feasible"] and record["base"]["slacks"]["grade"] < 0.0
    assert record["optimum"]["values"]["grade"] >= 24.0 * (1.0 - TOL)
    assert "grade" in record["optimum"]["active"]


def test_water_constraint_can_bind():
    record = _record("copper_oxide")
    assert "water" in record["optimum"]["active"]
