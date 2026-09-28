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
    # every nominal state meets its own specification since 0.06.000, so the test makes one that does not:
    # the hard porphyry (26.2% Cu at nominal) against a 26.5% specification
    case = CASE_BY_ID["copper_porphyry_hard"]
    strict = replace(case, plant=replace(case.plant, grade_spec=GradeSpec("Cu", 26.5)))
    record = optimize(strict, strict.nominal, build_contract())
    assert not record["base"]["feasible"] and record["base"]["slacks"]["grade"] < 0.0
    assert record["status"] == "optimal"
    assert record["optimum"]["values"]["grade"] >= 26.5 * (1.0 - TOL)
    assert "grade" in record["optimum"]["active"]


def test_water_constraint_can_bind():
    record = _record("copper_oxide")
    assert "water" in record["optimum"]["active"]


# OP-02 to OP-04: the pattern search with a progressive barrier on analytic problems, before the engine uses it

def _run(evaluate, start, **kw):
    from pipeline.methods.pattern_search import pattern_search

    options = {"mesh_initial": 0.25, "mesh_minimum": 2.0**-12, "max_evaluations": 2000}
    options.update(kw)
    return pattern_search(evaluate, start, **options)


def test_poll_mesh_and_stopping():
    # an unconstrained bowl: the search ends at the minimum within the final mesh, stopping on the mesh size
    target = (0.3, 0.7)
    result = _run(lambda x: ((x[0] - target[0]) ** 2 + (x[1] - target[1]) ** 2, 0.0), (0.9, 0.1))
    assert result.stop == "mesh"
    assert all(abs(a - b) <= 2.0**-11 for a, b in zip(result.feasible, target))
    deltas = [it["delta"] for it in result.iterations]
    assert all(d <= 0.25 for d in deltas) and deltas[-1] < 2.0**-12
    # every mesh size is a power of two, so the browser's doubles take the same path
    assert all(float(d).hex().startswith("0x1.0000000000000p") for d in deltas)
    # the budget stops it too, and no point outside the cube is ever evaluated
    short = _run(lambda x: (-(x[0] + x[1]), 0.0), (0.5, 0.5), max_evaluations=7)
    assert short.stop == "budget" and len(short.evaluations) == 7
    assert all(0.0 <= v <= 1.0 for e in short.evaluations for v in e["x"])
    # the same inputs give the same run
    again = _run(lambda x: ((x[0] - target[0]) ** 2 + (x[1] - target[1]) ** 2, 0.0), (0.9, 0.1))
    assert again.evaluations == result.evaluations and again.iterations == result.iterations


def test_progressive_barrier():
    # maximize x + y inside the disc x^2 + y^2 <= 1/2, starting infeasible at (1, 1): the optimum is (1/2, 1/2)
    def evaluate(x):
        return -(x[0] + x[1]), max(0.0, x[0] ** 2 + x[1] ** 2 - 0.5) ** 2

    result = _run(evaluate, (1.0, 1.0))
    assert result.feasible is not None
    assert abs(result.feasible[0] + result.feasible[1] - 1.0) < 1e-3
    assert result.feasible[0] ** 2 + result.feasible[1] ** 2 <= 0.5
    # the barrier never rises, and every infeasible incumbent lies inside the barrier of its iteration
    h_max = [it["h_max"] for it in result.iterations]
    assert all(b <= a for a, b in zip(h_max, h_max[1:]))
    outcomes = {it["outcome"] for it in result.iterations}
    assert {"dominating", "improving", "unsuccessful"} <= outcomes  # the barrier path is exercised, not bypassed
    assert result.feasible == (0.5, 0.5)  # on this mesh the optimum is reached exactly


def test_infeasible_reports_least_violating():
    # the constraint x >= 2 cannot hold in the unit cube: no feasible point, and the infeasible incumbent
    # is the least-violating face
    result = _run(lambda x: (x[0], max(0.0, 2.0 - x[0]) ** 2), (0.5,))
    assert result.feasible is None
    assert result.infeasible == (1.0,) and result.infeasible_h == 1.0


# OP-08, the method's part: the browser's pattern search (frontend/src/engine/pattern_search.ts) takes the same
# path. Both suites hold these digests of the evaluation sequence (x, f, h and the source of every evaluation,
# then the mesh size and barrier of every iteration, as little-endian doubles). The evaluators multiply
# rather than raise to a power, so the two languages compute them identically.
PATTERN_SEARCH_DIGESTS = {
    "bowl": "4dcf0b3dba2272faf975bcd9425c47a00b0c1da6e7f203e78ba70597e6b38edc",
    "disc": "8650a09291e2acd651a8c119b6a44a8788236e1e231a20905872a7816b25074c",
    "impossible": "5a17ba72ae89daa5ff441725fa54168c92c67e0f0214bfb2c2a4341d21e8897e",
    "search": "deb8b4e114ba302f274781866a14de491774cbf92924ffab5f33c722f483d9df",
}


def _pattern_problems():
    def bowl(x):
        a, b = x[0] - 0.3, x[1] - 0.7
        return a * a + b * b, 0.0

    def disc(x):
        v = max(0.0, x[0] * x[0] + x[1] * x[1] - 0.5)
        return -(x[0] + x[1]), v * v

    def impossible(x):
        v = max(0.0, 2.0 - x[0])
        return x[0], v * v

    def bowl3(x):
        a, b = x[0] - 0.8, x[1] - 0.15
        return a * a + b * b + 0.1 * x[2], 0.0

    def mirror(state):
        return [] if state.feasible is None else [tuple(1.0 - v for v in state.feasible)]

    return {"bowl": (bowl, (0.9, 0.1), None), "disc": (disc, (1.0, 1.0), None),
            "impossible": (impossible, (0.5,), None), "search": (bowl3, (0.2, 0.85, 0.5), mirror)}


def _pattern_digest(result) -> str:
    import hashlib
    import struct

    source = {"start": 0.0, "search": 1.0, "poll": 2.0}
    digest = hashlib.sha256()
    for e in result.evaluations:
        digest.update(struct.pack(f"<{len(e['x']) + 3}d", *e["x"], e["f"], e["h"], source[e["source"]]))
    for it in result.iterations:
        digest.update(struct.pack("<2d", it["delta"], it["h_max"]))
    return digest.hexdigest()


def test_pattern_search_digests():
    for name, (evaluate, start, search) in _pattern_problems().items():
        result = _run(evaluate, start, search=search)
        assert _pattern_digest(result) == PATTERN_SEARCH_DIGESTS[name], name
