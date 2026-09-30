"""A generalized pattern search with a progressive barrier, deterministic so that the browser repeats it (OP-02,
OP-03, OP-04).

The search minimizes ``f`` over the unit cube subject to relaxable constraints aggregated as
``h(x) = sum_j max(0, g_j(x))^2`` (Audet and Dennis 2009, doi:10.1137/070692662; the definitions as restated by
Halle-Hannan and Tribes 2026, arXiv:2609.19333, section 2.3). The cube's faces are unrelaxable: a trial point
outside them is never evaluated (the extreme barrier). Each iteration:

1. **search** (optional): evaluate the candidates the caller proposes, in order, and stop at the first that
   dominates an incumbent (the surrogate management framework of Booker et al. 1999, doi:10.1007/BF01197708:
   the search may use any model, the poll keeps the method's guarantees);
2. **poll**: evaluate ``c +- delta e_i`` for each coordinate, in a fixed order, around the feasible incumbent
   and then the infeasible one, and stop at the first trial point that dominates an incumbent.

A *dominating* iteration dominates an incumbent: a feasible point with a lower ``f``, or an infeasible point
with ``h <= h_max`` and no worse in ``(h, f)`` and better in one. The mesh size then doubles (capped at its initial
value). An *improving* iteration dominates neither but finds an infeasible point with a lower ``h`` than the
infeasible incumbent, which it replaces; the mesh size stays. Otherwise the iteration is *unsuccessful* and
the mesh size halves. After every iteration the barrier ``h_max`` is set to the infeasible incumbent's ``h``: it
never rises, which the progressive barrier requires. That update is a declared simplification of the rules in
Audet and Hare (2017, chapter 12), which were not read.

All arithmetic is IEEE doubles in a fixed order, and ``frontend/src/engine/pattern_search.ts`` repeats it.
"""
from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

Point = tuple[float, ...]
Evaluator = Callable[[Point], tuple[float, float]]
Search = Callable[["SearchState"], Sequence[Point]]


@dataclass
class SearchState:
    """What a search step may read: the incumbents, the mesh size and the barrier."""

    feasible: Point | None
    infeasible: Point | None
    delta: float
    h_max: float


@dataclass
class Result:
    feasible: Point | None
    feasible_f: float | None
    infeasible: Point | None
    infeasible_h: float | None
    infeasible_f: float | None
    stop: str
    evaluations: list[dict[str, Any]] = field(default_factory=list)
    iterations: list[dict[str, Any]] = field(default_factory=list)


def _inside(x: Point) -> bool:
    return all(0.0 <= v <= 1.0 for v in x)


def pattern_search(evaluate: Evaluator, start: Point, *, mesh_initial: float, mesh_minimum: float, max_evaluations: int,
                   search: Search | None = None) -> Result:
    if not _inside(start):
        raise ValueError(f"the start must lie in the unit cube, got {start}")
    if not 0.0 < mesh_minimum <= mesh_initial:
        raise ValueError(f"need 0 < mesh_minimum <= mesh_initial, got {mesh_minimum} and {mesh_initial}")
    cache: dict[Point, tuple[float, float]] = {}
    evaluations: list[dict[str, Any]] = []

    def value(x: Point, source: str) -> tuple[float, float]:
        if x not in cache:
            f, h = evaluate(x)
            cache[x] = (float(f), max(0.0, float(h)))
            evaluations.append({"x": list(x), "f": cache[x][0], "h": cache[x][1], "source": source})
        return cache[x]

    f0, h0 = value(start, "start")
    xf: Point | None = start if h0 == 0.0 else None
    ff = f0 if h0 == 0.0 else None
    xi: Point | None = None if h0 == 0.0 else start
    hi, fi = (None, None) if h0 == 0.0 else (h0, f0)
    h_max = float("inf") if xi is None else hi
    delta = mesh_initial
    iterations: list[dict[str, Any]] = []

    def dominates(f: float, h: float) -> bool:
        if h == 0.0:
            return ff is None or f < ff
        if h > h_max:
            return False
        return xi is not None and h <= hi and f <= fi and (h < hi or f < fi)

    while True:
        if delta < mesh_minimum:
            stop = "mesh"
            break
        if len(cache) >= max_evaluations:
            stop = "budget"
            break
        outcome, best_improving, first_infeasible = "unsuccessful", None, None
        trials: list[tuple[Point, str]] = []
        if search is not None:
            trials += [(tuple(float(v) for v in x), "search") for x in search(SearchState(xf, xi, delta, h_max))]
        for center in (c for c in (xf, xi) if c is not None):
            for i in range(len(center)):
                for sign in (1.0, -1.0):
                    x = list(center)
                    x[i] = center[i] + sign * delta
                    trials.append((tuple(x), "poll"))
        for x, source in trials:
            if not _inside(x) or len(cache) >= max_evaluations:
                continue
            f, h = value(x, source)
            # a state the evaluator cannot score (a contract rejection) is an extreme-barrier point: never an incumbent
            if not (math.isfinite(f) and math.isfinite(h)):
                continue
            if dominates(f, h):
                outcome = "dominating"
                if h == 0.0:
                    xf, ff = x, f
                else:
                    xi, hi, fi = x, h, f
                break
            if 0.0 < h <= h_max:
                if xi is None:
                    # no infeasible incumbent yet: the best f among the infeasible points inside the barrier
                    # becomes one (eq. 13), without counting as a success
                    if first_infeasible is None or f < first_infeasible[2]:
                        first_infeasible = (x, h, f)
                elif h < hi and (best_improving is None or (h, f) < (best_improving[1], best_improving[2])):
                    best_improving = (x, h, f)
        if outcome != "dominating" and best_improving is not None:
            outcome = "improving"
            xi, hi, fi = best_improving
        if xi is None and first_infeasible is not None:
            xi, hi, fi = first_infeasible
        if outcome == "dominating":
            delta = min(2.0 * delta, mesh_initial)
        elif outcome == "unsuccessful":
            delta = delta / 2.0
        if xi is not None:
            h_max = hi
        iterations.append({"outcome": outcome, "delta": delta, "h_max": h_max, "evaluations": len(cache),
                           "feasible": list(xf) if xf is not None else None, "feasible_f": ff,
                           "infeasible": list(xi) if xi is not None else None, "infeasible_h": hi})
    return Result(xf, ff, xi, hi, fi, stop, evaluations, iterations)
