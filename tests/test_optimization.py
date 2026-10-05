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


# OP-01, OP-05, OP-06: the weighted objective, the surrogate screen and the screened record. The screen is the
# export of the learning stage in models/ (OF_MODELS points a development run at a sandbox bake's models).

@lru_cache(maxsize=1)
def _screen():
    import os
    from pathlib import Path

    from pipeline.methods.screen import SCREEN_FILE, Screen

    models = Path(os.environ.get("OF_MODELS", Path(__file__).resolve().parents[1] / "models"))
    assert (models / SCREEN_FILE).exists(), f"{models} has no {SCREEN_FILE}: bake the learning stage or set OF_MODELS"
    return Screen(models)


@lru_cache(maxsize=None)
def _screened(case_id: str) -> dict:
    case = CASE_BY_ID[case_id]
    return optimize(case, case.nominal, build_contract(), screen=_screen())


def test_objective_and_decisions():
    from pipeline.methods.optimization import Problem

    case = CASE_BY_ID["copper_porphyry_soft"]
    contract = build_contract()
    problem = Problem(case, case.nominal, contract)
    base = problem.evaluate_point(case.nominal)
    # at the base both terms are 1, so the objective is w - (1 - w)
    for w in (0.0, 0.25, 0.5, 1.0):
        assert problem.objective(base, w) == pytest.approx(2.0 * w - 1.0, abs=1e-15)
    metal = optimize(case, case.nominal, contract, weight=1.0, path=False)
    energy = optimize(case, case.nominal, contract, weight=0.0, path=False)
    assert metal["weights"] == {"recovered_metal": 1.0, "energy": 0.0} and energy["weights"] == {"recovered_metal": 0.0, "energy": 1.0}
    assert metal["decisions"] == list(decisions_for(case.plant.family)) == ["target_p80_um", "collector_gpt", "jg_cm_s"]
    assert decisions_for("magnetic") == ("target_p80_um",)
    # each weight's optimum is at least as good as the other's in its own objective
    assert metal["optimum"]["recovered_tph"] >= energy["optimum"]["recovered_tph"] * (1.0 - 1e-12)
    assert energy["optimum"]["values"]["energy_kwh_t"] <= metal["optimum"]["values"]["energy_kwh_t"] * (1.0 + 1e-12)


def test_screen_accepts_only_inside_envelope():
    from pipeline.methods.learning import features
    from pipeline.methods.optimization import Problem, _screen_step
    from pipeline.methods.pattern_search import SearchState

    case = CASE_BY_ID["copper_porphyry_soft"]
    screen = _screen()
    problem = Problem(case, case.nominal, build_contract(), screen)
    centre = tuple(problem.to_unit(case.nominal))
    state = SearchState(centre, None, 0.125, float("inf"))
    log: list = []
    proposed = _screen_step(problem, 1.0, log)(state)
    bound = float(constant("optimization.screen_half_width_pct"))
    passing = []
    for i in range(len(centre)):
        for step in (1.0, 2.0):
            for sign in (1.0, -1.0):
                x = list(centre)
                x[i] += sign * step * state.delta
                if all(0.0 <= v <= 1.0 for v in x):
                    judged = screen.judge(features(case, problem.from_unit(x), problem.factors))
                    if judged["guard_error"] <= screen.guard_threshold and judged["half_width"] <= bound:
                        passing.append((judged["prediction"]["recovery_pct"], tuple(x)))
    entry = log[0]
    assert entry["screened"] - entry["guard"] - entry["interval"] == len(passing)
    if passing:
        assert proposed == [max(passing)[1]]
        assert entry["proposal"]["recovery_pct"] == max(passing)[0]
    else:
        assert proposed == [] and entry["proposal"] is None
    # a guard that accepts nothing leaves the search step empty and the poll to the engine
    strict = Problem(case, case.nominal, build_contract(), screen)
    original, screen.guard_threshold = screen.guard_threshold, -1.0
    try:
        log = []
        assert _screen_step(strict, 1.0, log)(state) == []
        assert log[0]["guard"] == log[0]["screened"] > 0
    finally:
        screen.guard_threshold = original


def test_optimum_is_an_engine_result():
    case = CASE_BY_ID["copper_porphyry_soft"]
    record = _screened("copper_porphyry_soft")
    assert record["screened"] and record["status"] == "optimal"
    m = simulate(case.ore, case.plant, case.nominal.with_values(**record["optimum"]["decisions"])).metrics
    assert record["optimum"]["recovered_tph"] == pytest.approx(m["recovered_primary_tph"], rel=1e-12)
    columns = record["proposal_columns"]
    for run in record["starts"]:
        rows = run["screen"]["proposals"]
        # every proposal the budget did not cut is an engine evaluation, with the engine's value beside the surrogate's
        for row in rows[:-1] if run["stop"] == "budget" else rows:
            assert row[columns.index("engine_recovery_pct")] is not None and row[columns.index("engine_objective")] is not None


def test_record_fields():
    record = _screened("copper_oxide")
    assert record["method"] == "gps-progressive-barrier"
    assert record["screen_bound_pct"] == float(constant("optimization.screen_half_width_pct"))
    assert len(record["proposal_columns"]) == 7
    for run in record["starts"]:
        s = run["screen"]
        assert s["iterations"] == run["iterations"]
        assert s["rejected"]["guard"] + s["rejected"]["interval"] <= s["screened"]
        assert s["improved"] <= s["proposed"] == len(s["proposals"]) <= s["iterations"]
    plain = record["without_screen"]
    assert len(plain["starts"]) == len(record["starts"]) and plain["evaluations"] > 0
    assert [step["weight"] for step in record["path"]] == constant("optimization.weight_path")
    assert all("screen" in step and step["stop"] in ("mesh", "budget") for step in record["path"])
    assert all(len(row) == 5 and row[0] in "diu" for row in record["trace"])


def test_a_refused_base_has_no_optimum():
    """M-05: at a base the engine refuses, 0.08.001 normalised the objective by 1 and mixed t/h with kWh/t."""
    from pipeline.cases.catalog import CASE_BY_ID, variant_point
    from pipeline.io.contract import build_contract
    from pipeline.methods.optimization import optimize

    case = CASE_BY_ID["copper_porphyry_hard"]
    point = variant_point(case, next(v for v in case.variants if v["id"] == "cut_finer"))
    base = point.with_values(work_index_kwh_t=1.15 * point.work_index_kwh_t)
    record = optimize(case, base, build_contract(), weight=0.5, path=False)
    assert record["status"] == "base_refused" and record["optimum"] is None and record["refused"]


def test_a_non_finite_slack_is_infeasible():
    """M-10: Python's max(0, nan) is 0, which read a NaN slack as feasible; the browser read it as a barrier."""
    import math

    from pipeline.cases.catalog import CASE_BY_ID
    from pipeline.io.contract import build_contract
    from pipeline.methods.optimization import Problem

    case = CASE_BY_ID["copper_porphyry_soft"]
    problem = Problem(case, case.nominal, build_contract())
    problem.evaluate = lambda x: {"valid": True, "recovered_tph": 1.0, "values": {"energy_kwh_t": 1.0}, "relative": {"grade": math.nan}}
    assert problem.scored(0.5, 1e-6)((0.5, 0.5, 0.5)) == (math.inf, math.inf)


def test_records_say_whether_the_search_converged():
    """M-09: an optimum from a start that stopped on its evaluation budget is labelled so."""
    from pipeline.cases.catalog import CASE_BY_ID
    from pipeline.io.contract import build_contract
    from pipeline.methods.optimization import optimize

    case = CASE_BY_ID["iron_magnetite_fine"]
    record = optimize(case, case.nominal, build_contract(), weight=1.0, path=True)
    assert record["status"] == "optimal" and isinstance(record["converged"], bool)
    assert all(isinstance(step["converged"], bool) for step in record["path"])
