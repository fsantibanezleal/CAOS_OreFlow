"""Constrained operating-point optimization (PE-27).

Maximize the recovered primary payable (t/h) over the grind target, the collector dose and the rougher
gas velocity (the grind target alone for the magnetite circuit), inside the Contract 1 bounds of the
case, subject to

- final concentrate grade at or above the case specification,
- required mill power at or below the installed power (a target the mill cannot reach is not a
  decision it can take),
- process water per tonne at or below the plant's capacity.

COBYLA (Powell 1994, doi:10.1007/978-94-015-8330-5_4; SciPy's PRIMA implementation, Zhang 2023,
doi:10.5281/zenodo.8052654) runs from six fixed starts in the unit cube of the decision bounds: the
variant's own point and five declared interior points. The best start that ends feasible is the
optimum; it is simulated again from scratch to report its values and slacks. If no start ends
feasible the record says so and reports the least-violating point, never an optimum.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

import numpy as np
from scipy.optimize import minimize

from ..cases.catalog import CaseDef
from ..engine.circuit import simulate
from ..engine.constants import constant
from ..engine.model import OperatingPoint
from ..io.contract import validate

FLOTATION_DECISIONS = ("target_p80_um", "collector_gpt", "jg_cm_s")
MAGNETIC_DECISIONS = ("target_p80_um",)


def decisions_for(family: str) -> tuple[str, ...]:
    return MAGNETIC_DECISIONS if family == "magnetic" else FLOTATION_DECISIONS


class Problem:
    """The optimization problem of one case at one base operating point."""

    def __init__(self, case: CaseDef, base: OperatingPoint, contract: dict[str, Any]) -> None:
        self.case, self.base, self.contract = case, base, contract
        self.names = decisions_for(case.plant.family)
        inputs = contract["cases"][case.id]["inputs"]
        self.bounds = [(float(inputs[n]["min"]), float(inputs[n]["max"])) for n in self.names]
        self.spec = case.plant.grade_spec
        self.water_limit = case.plant.water_limit_m3_t
        self.cache: dict[tuple[float, ...], dict[str, Any]] = {}
        base_eval = self.evaluate_point(base)
        self.scale = base_eval["recovered_tph"] if base_eval["recovered_tph"] > 0.0 else 1.0

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
        m = simulate(self.case.ore, self.case.plant, point).metrics
        values = {"grade": m["concentrate_grade"], "required_power_kw": m["required_mill_power_kw"],
                  "water_m3_t": m["water_intensity_m3_t"]}
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


def optimize(case: CaseDef, base: OperatingPoint, contract: dict[str, Any]) -> dict[str, Any]:
    problem = Problem(case, base, contract)
    tolerance = float(constant("optimization.feasibility_tolerance"))
    constraints = [{"type": "ineq", "fun": (lambda x, c=c: problem.evaluate(x)["relative"].get(c, -1.0))}
                   for c in problem.constraint_ids()]
    constraints.append({"type": "ineq", "fun": lambda x: problem.evaluate(x)["relative"].get("contract", 0.0)})
    runs = []
    for start in _starts(problem):
        before = len(problem.cache)
        result = minimize(lambda x: -problem.evaluate(x)["recovered_tph"] / problem.scale, np.asarray(start), method="COBYLA",
                          constraints=constraints, bounds=[(0.0, 1.0)] * len(start),
                          options={"rhobeg": float(constant("optimization.rhobeg")), "tol": float(constant("optimization.rhoend")),
                                   "maxiter": int(constant("optimization.max_evaluations")), "catol": tolerance})
        end = problem.evaluate(result.x)
        runs.append({"start": {n: getattr(problem.from_unit(start), n) for n in problem.names},
                     "end": _summary(problem, end), "violation": _violation(end),
                     "evaluations": len(problem.cache) - before, "message": str(result.message)})
    base_summary = _summary(problem, problem.evaluate_point(base))
    record: dict[str, Any] = {
        "decisions": list(problem.names),
        "bounds": {n: [lo, hi] for n, (lo, hi) in zip(problem.names, problem.bounds)},
        "constraints": {"grade": {"minimum": problem.spec.minimum, "species": problem.spec.species},
                        "power": {"maximum_kw": case.plant.mill.installed_power_kw},
                        **({"water": {"maximum_m3_t": problem.water_limit}} if problem.water_limit > 0.0 else {})},
        "base": base_summary,
        "starts": runs,
        "evaluations": len(problem.cache),
        "status": "infeasible",
        "optimum": None,
    }
    feasible_runs = [r for r in runs if r["end"]["feasible"]]
    if feasible_runs:
        best = max(feasible_runs, key=lambda r: r["end"]["recovered_tph"])
        # simulated again from scratch, so the reported slacks do not come from the optimizer's cache
        optimum = _summary(problem, problem.evaluate_point(base.with_values(**best["end"]["decisions"])))
        if optimum["feasible"]:
            record["status"], record["optimum"] = "optimal", optimum
            record["gain_tph"] = optimum["recovered_tph"] - base_summary["recovered_tph"]
            record["gain_pct"] = (100.0 * record["gain_tph"] / base_summary["recovered_tph"]
                                  if base_summary["recovered_tph"] > 0.0 else None)
    if record["optimum"] is None:
        record["least_violating"] = min(runs, key=lambda r: r["violation"])["end"]
    return record
