"""Seeded uncertainty and variance-based sensitivity of an operating point (PE-28).

Four ore properties are uncertain: the Bond work index, the head grade, the liberation size of the
valuable minerals and their floatability (the magnetite circuit has no flotation, so three there).
Each varies uniformly on ``[1 - h, 1 + h]`` times its value at the operating point, with the declared
half-widths ``h``. The uncertainty record propagates a seeded Latin hypercube of 128 samples through
the engine and reports P05, P50 and P95 of recovery, grade, grinding energy and recovered metal, and
the probability of meeting each constraint of the optimizer (grade specification, installed power,
process-water capacity). The design comes from one SplitMix64 generator (``methods/sampling.py``),
which the browser repeats bit for bit, so a seed or sample count set in the workbench re-runs the
same design (UQ-01 to UQ-06). The sensitivity record estimates
first-order and total Sobol indices with the Saltelli design and estimators (Saltelli et al. 2010,
doi:10.1016/j.cpc.2009.09.018) through SALib (Herman and Usher 2017, doi:10.21105/joss.00097).
"""
from __future__ import annotations

from dataclasses import replace
from typing import Any

import numpy as np
from SALib.analyze import sobol as sobol_analyze
from SALib.sample import sobol as sobol_sample

from ..cases.catalog import CaseDef
from ..engine.circuit import simulate
from ..engine.constants import constant
from ..engine.model import InfeasibleState, OperatingPoint, Ore
from ..engine.ore import resolve
from .sampling import latin_hypercube

INPUTS = ("work_index", "head_grade", "liberation_size", "floatability")
OUTPUTS = ("recovery_pct", "concentrate_grade", "specific_energy_grinding_kwh_t", "recovered_primary_tph")


def inputs_for(case: CaseDef) -> tuple[str, ...]:
    return tuple(n for n in INPUTS if n != "floatability" or case.plant.flotation is not None)


def _half_widths(names: tuple[str, ...]) -> list[float]:
    table = constant("uncertainty.half_widths")
    return [float(table[n]) for n in names]


def perturbed(case: CaseDef, point: OperatingPoint, factors: dict[str, float]) -> tuple[Ore, OperatingPoint]:
    """The ore and operating point with each uncertain property multiplied by its factor. The floatability factor acts
    on every valuable mineral that floats, the liberation factor on those with a declared liberation size; until
    0.09.000 both took the liberation-size rule, which left electrum (45% of the gold case's gold) and chrysocolla out
    of the floatability factor (review of 2026-10-04, M-03)."""
    valuable = set(resolve(case.ore, point).valuable)
    minerals = []
    for m in case.ore.minerals:
        flotation = m.flotation
        if m.id in valuable and flotation is not None and "floatability" in factors:
            flotation = replace(flotation, floatability=flotation.floatability * factors["floatability"])
        if m.liberation_size_um > 0.0:
            m = replace(m, liberation_size_um=m.liberation_size_um * factors.get("liberation_size", 1.0))
        minerals.append(replace(m, flotation=flotation))
    ore = replace(case.ore, minerals=tuple(minerals))
    new_point = point.with_values(work_index_kwh_t=point.work_index_kwh_t * factors.get("work_index", 1.0),
                                  head_grade=point.head_grade * factors.get("head_grade", 1.0))
    return ore, new_point


def _evaluate(case: CaseDef, point: OperatingPoint, factors: dict[str, float]) -> dict[str, Any]:
    ore, p = perturbed(case, point, factors)
    try:
        result = simulate(ore, case.plant, p)
    except InfeasibleState as refusal:   # a draw with no steady state (E-01): counted, never a sample of the outputs
        return {"refused": refusal.code}
    m = result.metrics
    plant = case.plant
    checks = {"grade_meets_spec": m["concentrate_grade"] >= plant.grade_spec.minimum,
              "power_within_installed": m["required_mill_power_kw"] <= plant.mill.installed_power_kw}
    if plant.water_limit_m3_t > 0.0:
        checks["water_within_capacity"] = m["water_intensity_m3_t"] <= plant.water_limit_m3_t
    return {"outputs": {k: m[k] for k in OUTPUTS}, "checks": checks, "flags": [f["code"] for f in result.flags],
            "balance": m["balance_max_relative_error"]}


def uncertainty(case: CaseDef, point: OperatingPoint, samples: int | None = None, seed: int | None = None) -> dict[str, Any]:
    names = inputs_for(case)
    widths = _half_widths(names)
    n = int(constant("uncertainty.samples")) if samples is None else samples
    seed = int(constant("uncertainty.seed")) if seed is None else seed
    unit = np.asarray(latin_hypercube(n, len(names), seed))
    factors = 1.0 - np.asarray(widths) + 2.0 * np.asarray(widths) * unit
    drawn = [_evaluate(case, point, dict(zip(names, map(float, row)))) for row in factors]
    rows = [r for r in drawn if "refused" not in r]
    # the design rows the outputs belong to, so a view pairs each value with its own draw (M-01)
    solved = [i for i, r in enumerate(drawn) if "refused" not in r]
    refused: dict[str, int] = {}
    for r in drawn:
        if "refused" in r:
            refused[r["refused"]] = refused.get(r["refused"], 0) + 1
    base = _evaluate(case, point, {})
    levels = [float(q) for q in constant("uncertainty.quantiles")]
    outputs = {}
    for key in OUTPUTS:
        values = np.array([r["outputs"][key] for r in rows])
        quantiles = np.quantile(values, levels)
        outputs[key] = {"p05": float(quantiles[0]), "p50": float(quantiles[1]), "p95": float(quantiles[2]),
                        "mean": float(np.mean(values)), "std": float(np.std(values, ddof=1)), "base": base["outputs"][key],
                        "values": [float(v) for v in values]}
    checks = list(base["checks"])
    # over every draw: an ore the circuit cannot bring to a steady state meets no constraint
    probabilities = {c: float(sum(r["checks"][c] for r in rows)) / len(drawn) for c in checks}
    probabilities["all_constraints"] = float(sum(all(r["checks"].values()) for r in rows)) / len(drawn)
    flag_counts: dict[str, int] = {}
    for r in rows:
        for code in r["flags"]:
            flag_counts[code] = flag_counts.get(code, 0) + 1
    return {
        "status": "computed",
        "samples": n,
        "seed": seed,
        "design": "Latin hypercube",
        "generator": "SplitMix64",
        "inputs": {name: {"half_width": w} for name, w in zip(names, widths)},
        "factors": [[float(v) for v in row] for row in factors],
        # the quantiles are over these draws, the ones with a steady state; the probabilities over every draw (M-02)
        "solved": solved,
        "outputs": outputs,
        "probabilities": probabilities,
        # draws with no steady state (E-01), by code; the outputs are over the solved draws only
        "refused": refused,
        "base_checks": base["checks"],
        "flag_counts": flag_counts,
        "max_balance_error": max(r["balance"] for r in rows),
    }


def _analyze(problem: dict[str, Any], y: np.ndarray, seed: int) -> Any:
    """SALib's estimators with a bootstrap that every admitted seed reproduces. SALib seeds its resampling only for a
    truthy seed and otherwise draws from NumPy's global generator, so at seed 0 the half-widths changed from call to
    call (M-13): the global generator is seeded for the call and restored after it."""
    kwargs = {"calc_second_order": False, "num_resamples": int(constant("sensitivity.resamples")),
              "conf_level": float(constant("sensitivity.confidence"))}
    if seed:
        return sobol_analyze.analyze(problem, y, seed=seed, **kwargs)
    state = np.random.get_state()
    try:
        np.random.seed(0)
        return sobol_analyze.analyze(problem, y, **kwargs)
    finally:
        np.random.set_state(state)


def sensitivity(case: CaseDef, point: OperatingPoint, base_samples: int | None = None, seed: int | None = None) -> dict[str, Any]:
    names = inputs_for(case)
    widths = _half_widths(names)
    n = int(constant("sensitivity.base_samples")) if base_samples is None else base_samples
    seed = int(constant("uncertainty.seed")) if seed is None else seed
    problem = {"num_vars": len(names), "names": list(names),
               "bounds": [[1.0 - w, 1.0 + w] for w in widths]}
    design = sobol_sample.sample(problem, n, calc_second_order=False, scramble=True, seed=seed)
    results = {key: np.empty(len(design)) for key in OUTPUTS}
    refused: dict[str, int] = {}
    for i, row in enumerate(design):
        evaluation = _evaluate(case, point, dict(zip(names, map(float, row))))
        if "refused" in evaluation:
            refused[evaluation["refused"]] = refused.get(evaluation["refused"], 0) + 1
            continue
        for key in OUTPUTS:
            results[key][i] = evaluation["outputs"][key]
    if refused:
        # a Saltelli design cannot drop rows: no indices where any draw has no steady state (M-08)
        return {"status": "refused_draws", "base_samples": n, "evaluations": len(design), "seed": seed, "refused": refused,
                "inputs": {name: {"half_width": w} for name, w in zip(names, widths)}}
    indices = {}
    for key in OUTPUTS:
        y = results[key]
        # constant up to round-off, not only exactly: a mill at installed power at every sample has the
        # same grinding energy to the last bits, and the indices of that spread would rank noise
        if float(np.ptp(y)) <= float(constant("sensitivity.constant_tolerance")) * float(np.max(np.abs(y))):
            indices[key] = {"constant": True}
            continue
        analysis = _analyze(problem, y, seed)
        indices[key] = {part: {name: float(v) for name, v in zip(names, analysis[part])}
                        for part in ("S1", "S1_conf", "ST", "ST_conf")}
    return {"status": "computed", "base_samples": n, "evaluations": len(design), "seed": seed,
            "inputs": {name: {"half_width": w} for name, w in zip(names, widths)}, "indices": indices}
