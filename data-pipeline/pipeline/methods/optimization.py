"""Constrained operating-point optimization (PE-27, OP-01 to OP-07).

Maximize ``w_r M/M0 - w_e E/E0`` over the grind target, the collector dose and the rougher gas velocity (the
grind target alone for the magnetite circuit), inside the Contract 1 bounds of the case. ``M`` is the recovered
primary payable (t/h), ``E`` the total specific energy (kWh/t), ``M0`` and ``E0`` their values at the variant's
own state, and ``w_r + w_e = 1``; the bake's record uses ``w_r = 1``, recovered metal alone. The constraints:

- final concentrate grade at or above the case specification,
- required mill power at or below the installed power (a target the mill cannot reach is not a
  decision it can take),
- process water per tonne at or below the plant's capacity.

The search is a generalized pattern search with a progressive barrier (``methods/pattern_search.py``; Torczon
1997, doi:10.1137/S1052623493250780; Audet and Dennis 2009, doi:10.1137/070692662), which the browser repeats
step for step (``frontend/src/engine/optimize.ts``), so the weights are live in the workbench. It runs from six
fixed starts in the unit cube of the decision bounds: the variant's own point and five declared interior points.
The constraints enter through the violation of their relative slacks beyond the feasibility tolerance; a state
the contract rejects is never an incumbent. The best start that ends feasible is the optimum; it is simulated
again from scratch to report its values and slacks. If no start ends feasible the record says so and reports the
least-violating point, never an optimum. The record also keeps the optimum's path as the weight moves from
recovered metal toward energy, each step warm-started from the previous optimum.

The search step is the surrogate screen (``methods/screen.py``; Booker et al. 1999, doi:10.1007/BF01197708). At
every iteration it takes the mesh neighbours one and two mesh steps from each incumbent that the engine has not
evaluated, rejects those the guard flags or where the Gaussian process's 95% half-width on recovery exceeds
``optimization.screen_half_width_pct``, and proposes the one with the best predicted objective to the engine. The
decisions change neither the throughput nor the head grade, so the predicted ``M/M0`` is the predicted recovery
over the base's. The poll follows when the proposal does not improve an incumbent, so the screen can only reorder
the engine's work, never replace it. The record keeps every iteration's screen counts, every proposal with the
surrogate's and the engine's values, and the same multi-start without the screen, so the saving is measured.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

import numpy as np

from ..cases.catalog import CaseDef
from ..engine.circuit import simulate
from ..engine.constants import constant
from ..engine.model import InfeasibleState, OperatingPoint
from ..io.contract import validate
from .learning import _ore_factors, features
from .pattern_search import pattern_search
from .screen import Screen

FLOTATION_DECISIONS = ("target_p80_um", "collector_gpt", "jg_cm_s")
MAGNETIC_DECISIONS = ("target_p80_um",)
METHOD = "gps-progressive-barrier"
# the columns of a start's screen proposals
PROPOSAL_COLUMNS = ("iteration", "surrogate_recovery_pct", "engine_recovery_pct", "surrogate_objective", "engine_objective",
                    "runner_up_margin", "improved")


def decisions_for(family: str, cut_mode: bool = False) -> tuple[str, ...]:
    """The decisions an operator controls; in the cut mode the classifier cut replaces the grind target (CM-02)."""
    names = MAGNETIC_DECISIONS if family == "magnetic" else FLOTATION_DECISIONS
    return tuple("d50c_um" if cut_mode and n == "target_p80_um" else n for n in names)


class Problem:
    """The optimization problem of one case at one base operating point."""

    def __init__(self, case: CaseDef, base: OperatingPoint, contract: dict[str, Any], screen: Screen | None = None) -> None:
        self.case, self.base, self.contract, self.screen = case, base, contract, screen
        self.factors = {name: 1.0 for name in _ore_factors(case)}
        self.names = decisions_for(case.plant.family, base.d50c_um > 0.0)
        inputs = contract["cases"][case.id]["inputs"]
        self.bounds = [(float(inputs[n]["min"]), float(inputs[n]["max"])) for n in self.names]
        self.spec = case.plant.grade_spec
        self.water_limit = case.plant.water_limit_m3_t
        self.cache: dict[tuple[float, ...], dict[str, Any]] = {}
        base_eval = self.evaluate_point(base)
        self.scale = base_eval["recovered_tph"] if base_eval["recovered_tph"] > 0.0 else 1.0
        self.energy_scale = base_eval["values"].get("energy_kwh_t", 0.0) or 1.0
        self.recovery_scale = base_eval.get("recovery_pct", 0.0) or 1.0

    def to_unit(self, point: OperatingPoint) -> list[float]:
        return [(getattr(point, n) - lo) / (hi - lo) for n, (lo, hi) in zip(self.names, self.bounds)]

    def from_unit(self, x: Any) -> OperatingPoint:
        values = {}
        for n, (lo, hi), xi in zip(self.names, self.bounds, np.clip(np.asarray(x, dtype=float), 0.0, 1.0)):
            values[n] = lo + float(xi) * (hi - lo)
        return self.base.with_values(**values)

    def evaluate_point(self, point: OperatingPoint) -> dict[str, Any]:
        """Simulate one point and express every constraint as a slack relative to its limit (>= 0 holds)."""
        verdict = validate(self.contract, self.case.id, asdict(point))
        if not verdict["accepted"]:
            return {"point": point, "valid": False, "recovered_tph": 0.0, "values": {}, "slacks": {},
                    "relative": {"contract": -1.0}}
        try:
            m = simulate(self.case.ore, self.case.plant, point).metrics
        except InfeasibleState as refusal:   # no steady state at this trial (E-01): infeasible, never a result
            return {"point": point, "valid": False, "recovered_tph": 0.0, "values": {}, "slacks": {},
                    "relative": {refusal.code: -1.0}}
        values = {"grade": m["concentrate_grade"], "required_power_kw": m["required_mill_power_kw"],
                  "water_m3_t": m["water_intensity_m3_t"], "energy_kwh_t": m["specific_energy_total_kwh_t"]}
        slacks = {"grade": m["concentrate_grade"] - self.spec.minimum,
                  "power": m["installed_mill_power_kw"] - m["required_mill_power_kw"]}
        relative = {"grade": slacks["grade"] / self.spec.minimum, "power": slacks["power"] / m["installed_mill_power_kw"]}
        if self.water_limit > 0.0:
            slacks["water"] = self.water_limit - m["water_intensity_m3_t"]
            relative["water"] = slacks["water"] / self.water_limit
        return {"point": point, "valid": True, "recovered_tph": m["recovered_primary_tph"], "recovery_pct": m["recovery_pct"],
                "values": values, "slacks": slacks, "relative": relative}

    def evaluate(self, x: Any) -> dict[str, Any]:
        key = tuple(float(v) for v in np.clip(np.asarray(x, dtype=float), 0.0, 1.0))
        if key not in self.cache:
            self.cache[key] = self.evaluate_point(self.from_unit(key))
        return self.cache[key]

    def objective(self, evaluation: dict[str, Any], weight: float) -> float:
        """The weighted objective to maximize: recovered metal against specific energy, both relative to the base."""
        return weight * evaluation["recovered_tph"] / self.scale - (1.0 - weight) * evaluation["values"]["energy_kwh_t"] / self.energy_scale

    def scored(self, weight: float, tolerance: float):
        """The evaluator the pattern search minimizes: (-objective, violation beyond the tolerance)."""
        def evaluate(x: tuple[float, ...]) -> tuple[float, float]:
            e = self.evaluate(x)
            if not e["valid"]:
                return float("inf"), float("inf")
            # a product, not a power: the browser computes the same square (engine/optimize.ts)
            h = 0.0
            for v in e["relative"].values():
                d = max(0.0, -v - tolerance)
                h += d * d
            return -self.objective(e, weight), h
        return evaluate

    def constraint_ids(self) -> list[str]:
        ids = ["grade", "power"]
        if self.water_limit > 0.0:
            ids.append("water")
        return ids


def _feasible(evaluation: dict[str, Any], tolerance: float) -> bool:
    return evaluation["valid"] and all(v >= -tolerance for v in evaluation["relative"].values())


def _violation(evaluation: dict[str, Any]) -> float:
    return sum(max(0.0, -v) for v in evaluation["relative"].values())


def _summary(problem: Problem, evaluation: dict[str, Any]) -> dict[str, Any]:
    point = evaluation["point"]
    active_tol = float(constant("optimization.active_tolerance"))
    return {
        "decisions": {n: getattr(point, n) for n in problem.names},
        "recovered_tph": evaluation["recovered_tph"],
        "recovery_pct": evaluation.get("recovery_pct", 0.0),
        "values": evaluation["values"],
        "slacks": evaluation["slacks"],
        "active": [c for c, v in evaluation["relative"].items() if abs(v) <= active_tol],
        "feasible": _feasible(evaluation, float(constant("optimization.feasibility_tolerance"))),
    }


def _starts(problem: Problem) -> list[list[float]]:
    starts = [problem.to_unit(problem.base)]
    for coords in constant("optimization.starts"):
        start = [float(v) for v in coords[:len(problem.names)]]
        if all(max(abs(a - b) for a, b in zip(start, s)) > 0.0 for s in starts):
            starts.append(start)
    return starts


def _screen_step(problem: Problem, weight: float, log: list[dict[str, Any]]):
    """The screen as the pattern search's search step (OP-05); every iteration appends its counts to ``log``."""
    screen = problem.screen
    bound = float(constant("optimization.screen_half_width_pct"))
    steps = [float(s) for s in constant("optimization.screen_steps")]
    tol = float(constant("optimization.decrease_tolerance"))

    def search(state) -> list[tuple[float, ...]]:
        rows: list[tuple[float, ...]] = []
        for center in (c for c in (state.feasible, state.infeasible) if c is not None):
            for step in steps:
                for i in range(len(center)):
                    for sign in (1.0, -1.0):
                        x = list(center)
                        x[i] = center[i] + sign * step * state.delta
                        t = tuple(x)
                        if all(0.0 <= v <= 1.0 for v in t) and t not in problem.cache and t not in rows:
                            rows.append(t)
        entry: dict[str, Any] = {"screened": len(rows), "guard": 0, "interval": 0, "proposal": None}
        best, runner_up = None, None
        for x in rows:
            judged = screen.judge(features(problem.case, problem.from_unit(x), problem.factors))
            if judged["guard_error"] > screen.guard_threshold:
                entry["guard"] += 1
                continue
            if judged["half_width"] > bound:
                entry["interval"] += 1
                continue
            p = judged["prediction"]
            objective = (weight * p["recovery_pct"] / problem.recovery_scale
                         - (1.0 - weight) * p["specific_energy_total_kwh_t"] / problem.energy_scale)
            # better only by more than round-off, so both languages rank alike; the first of equals is kept
            if best is None or objective > best[1] + tol * max(1.0, abs(best[1])):
                if best is not None:
                    runner_up = best[1]
                best = (x, objective, p["recovery_pct"])
            elif runner_up is None or objective > runner_up:
                runner_up = objective
        log.append(entry)
        if best is None:
            return []
        entry["proposal"] = {"x": best[0], "objective": best[1], "recovery_pct": best[2],
                             "margin": best[1] - runner_up if runner_up is not None else None}
        return [best[0]]
    return search


def _proposals(problem: Problem, log: list[dict[str, Any]], iterations: list[dict[str, Any]], weight: float) -> dict[str, Any]:
    """A start's screen record: the counts, and every proposal with the surrogate's and the engine's values."""
    rows = []
    for k, entry in enumerate(log):
        proposal = entry["proposal"]
        if proposal is None:
            continue
        key = tuple(float(v) for v in proposal["x"])
        engine = problem.cache.get(key)
        # a proposal the budget stopped before the engine reached is recorded without engine values
        evaluated = engine is not None and engine["valid"]
        after = iterations[k] if k < len(iterations) else {}
        improved = list(key) in (after.get("feasible"), after.get("infeasible"))
        rows.append([k, proposal["recovery_pct"], engine["recovery_pct"] if evaluated else None, proposal["objective"],
                     problem.objective(engine, weight) if evaluated else None, proposal["margin"], improved])
    return {"iterations": len(log), "screened": sum(e["screened"] for e in log),
            "rejected": {"guard": sum(e["guard"] for e in log), "interval": sum(e["interval"] for e in log)},
            "proposed": len(rows), "improved": sum(1 for r in rows if r[-1]), "proposals": rows}


def _search(problem: Problem, start: list[float], weight: float, tolerance: float) -> tuple[dict[str, Any], dict[str, Any]]:
    """One pattern search from ``start``, screened when the problem has a screen; returns its end (the feasible
    incumbent, else the infeasible one, else the start) and its run summary."""
    before = len(problem.cache)
    log: list[dict[str, Any]] = []
    result = pattern_search(problem.scored(weight, tolerance), tuple(min(1.0, max(0.0, v)) for v in start),
                            mesh_initial=float(constant("optimization.mesh_initial")),
                            mesh_minimum=float(constant("optimization.mesh_minimum")),
                            max_evaluations=int(constant("optimization.max_evaluations")),
                            search=_screen_step(problem, weight, log) if problem.screen is not None else None,
                            decrease=float(constant("optimization.decrease_tolerance")))
    x = result.feasible if result.feasible is not None else result.infeasible if result.infeasible is not None else tuple(start)
    end = problem.evaluate(x)
    run: dict[str, Any] = {"evaluations": len(problem.cache) - before, "iterations": len(result.iterations), "stop": result.stop,
                           "message": f"{result.stop}: {'feasible' if result.feasible is not None else 'no feasible point'}"}
    if problem.screen is not None:
        run["screen"] = _proposals(problem, log, result.iterations, weight)
    # the incumbent's path, for the view: outcome, mesh size, barrier, feasible objective, engine evaluations so far
    run["trace"] = [[it["outcome"][0], it["delta"], it["h_max"] if it["h_max"] != float("inf") else None,
                     -it["feasible_f"] if it["feasible_f"] is not None else None, it["evaluations"]] for it in result.iterations]
    return end, run


def _multistart(problem: Problem, weight: float, tolerance: float) -> list[dict[str, Any]]:
    runs = []
    for start in _starts(problem):
        end, run = _search(problem, start, weight, tolerance)
        runs.append({"start": {n: getattr(problem.from_unit(start), n) for n in problem.names},
                     "end": _summary(problem, end), "violation": _violation(end), **run})
    return runs


def _best(problem: Problem, runs: list[dict[str, Any]], weight: float) -> dict[str, Any] | None:
    tol = float(constant("optimization.decrease_tolerance"))
    best, score = None, None
    for r in runs:
        if not r["end"]["feasible"]:
            continue
        value = problem.objective({"recovered_tph": r["end"]["recovered_tph"], "values": r["end"]["values"]}, weight)
        # starts that end at one optimum agree to round-off: the first of them is kept, in both languages
        if best is None or value > score + tol * max(1.0, abs(score)):
            best, score = r, value
    return best


def optimize(case: CaseDef, base: OperatingPoint, contract: dict[str, Any], weight: float | None = None,
             path: bool = True, screen: Screen | None = None) -> dict[str, Any]:
    # the learned lane describes the target mode: its features are the grind target and the design load, which
    # the cut mode turns into results, so a cut-mode search runs without the screen and says so
    unscreened_reason = "cut_mode" if screen is not None and base.d50c_um > 0.0 else None
    if unscreened_reason:
        screen = None
    problem = Problem(case, base, contract, screen)
    tolerance = float(constant("optimization.feasibility_tolerance"))
    weight = float(constant("optimization.weight_default")) if weight is None else float(weight)
    runs = _multistart(problem, weight, tolerance)
    base_summary = _summary(problem, problem.evaluate_point(base))
    record: dict[str, Any] = {
        "method": METHOD,
        "weights": {"recovered_metal": weight, "energy": 1.0 - weight},
        "decisions": list(problem.names),
        "bounds": {n: [lo, hi] for n, (lo, hi) in zip(problem.names, problem.bounds)},
        "constraints": {"grade": {"minimum": problem.spec.minimum, "species": problem.spec.species},
                        "power": {"maximum_kw": case.plant.mill.installed_power_kw},
                        **({"water": {"maximum_m3_t": problem.water_limit}} if problem.water_limit > 0.0 else {})},
        "screened": screen is not None,
        **({"unscreened_reason": unscreened_reason} if unscreened_reason else {}),
        "base": base_summary,
        "starts": [{k: v for k, v in r.items() if k != "trace"} for r in runs],
        "evaluations": len(problem.cache),
        "status": "infeasible",
        "optimum": None,
    }
    if screen is not None:
        record["screen_bound_pct"] = float(constant("optimization.screen_half_width_pct"))
        record["proposal_columns"] = list(PROPOSAL_COLUMNS)
    best = _best(problem, runs, weight)
    best_decisions = None
    if best is not None:
        best_decisions = best["end"]["decisions"]
        record["trace"] = best["trace"]
        # simulated again from scratch, so the reported slacks do not come from the optimizer's cache
        optimum = _summary(problem, problem.evaluate_point(base.with_values(**best_decisions)))
        if optimum["feasible"]:
            record["status"], record["optimum"] = "optimal", optimum
            record["gain_tph"] = optimum["recovered_tph"] - base_summary["recovered_tph"]
            record["gain_pct"] = (100.0 * record["gain_tph"] / base_summary["recovered_tph"]
                                  if base_summary["recovered_tph"] > 0.0 else None)
    if record["optimum"] is None:
        least = min(runs, key=lambda r: r["violation"])
        record["least_violating"], record["trace"] = least["end"], least["trace"]
    if screen is not None:
        # the same starts and weight without the screen, on a fresh cache: the measured saving (OP-06)
        plain = Problem(case, base, contract, None)
        plain_runs = _multistart(plain, weight, tolerance)
        plain_best = _best(plain, plain_runs, weight)
        record["without_screen"] = {
            "evaluations": len(plain.cache), "starts": [r["evaluations"] for r in plain_runs],
            "status": "optimal" if plain_best is not None else "infeasible",
            "decisions": plain_best["end"]["decisions"] if plain_best is not None else None,
            "recovered_tph": plain_best["end"]["recovered_tph"] if plain_best is not None else None,
        }
    if path:
        record["path"] = _weight_path(problem, best_decisions, tolerance)
    return record


def _weight_path(problem: Problem, start_decisions: dict[str, float] | None, tolerance: float) -> list[dict[str, Any]]:
    """The optimum as the weight on recovered metal falls (OP-07), each step warm-started from the previous one."""
    steps = []
    current = problem.to_unit(problem.base.with_values(**start_decisions)) if start_decisions else problem.to_unit(problem.base)
    for weight in (float(w) for w in constant("optimization.weight_path")):
        end, run = _search(problem, current, weight, tolerance)
        summary = _summary(problem, end)
        step = {"weight": weight, "status": "optimal" if summary["feasible"] else "infeasible", "decisions": summary["decisions"],
                "recovered_tph": summary["recovered_tph"], "energy_kwh_t": summary["values"].get("energy_kwh_t"),
                "evaluations": run["evaluations"], "stop": run["stop"]}
        if "screen" in run:
            step["screen"] = {k: v for k, v in run["screen"].items() if k != "proposals"}
        steps.append(step)
        if summary["feasible"]:
            current = problem.to_unit(problem.base.with_values(**summary["decisions"]))
    return steps
