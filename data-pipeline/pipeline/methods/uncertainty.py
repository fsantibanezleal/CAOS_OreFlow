"""Seeded uncertainty and variance-based sensitivity of an operating point (PE-28).

Four ore properties are uncertain: the Bond work index, the head grade, the liberation size of the
valuable minerals and their floatability (the magnetite circuit has no flotation, so three there).
Each varies uniformly on ``[1 - h, 1 + h]`` times its value at the operating point, with the declared
half-widths ``h``. The uncertainty record propagates a seeded, scrambled Latin hypercube of 128
samples through the engine and reports P05, P50 and P95 of recovery, grade, grinding energy and
recovered metal, and the probability of meeting each constraint of the optimizer (grade
specification, installed power, process-water capacity). The sensitivity record estimates
first-order and total Sobol indices with the Saltelli design and estimators (Saltelli et al. 2010,
doi:10.1016/j.cpc.2009.09.018) through SALib (Herman and Usher 2017, doi:10.21105/joss.00097).
"""
from __future__ import annotations

from dataclasses import replace
from typing import Any

import numpy as np
from SALib.analyze import sobol as sobol_analyze
from SALib.sample import sobol as sobol_sample
from scipy.stats import qmc

from ..cases.catalog import CaseDef
from ..engine.circuit import simulate
from ..engine.constants import constant
from ..engine.model import OperatingPoint, Ore

INPUTS = ("work_index", "head_grade", "liberation_size", "floatability")
OUTPUTS = ("recovery_pct", "concentrate_grade", "specific_energy_grinding_kwh_t", "recovered_primary_tph")


def inputs_for(case: CaseDef) -> tuple[str, ...]:
    return tuple(n for n in INPUTS if n != "floatability" or case.plant.flotation is not None)


def _half_widths(names: tuple[str, ...]) -> list[float]:
    table = constant("uncertainty.half_widths")
    return [float(table[n]) for n in names]


def perturbed(case: CaseDef, point: OperatingPoint, factors: dict[str, float]) -> tuple[Ore, OperatingPoint]:
    """The ore and operating point with each uncertain property multiplied by its factor."""
    minerals = []
    for m in case.ore.minerals:
        if m.liberation_size_um > 0.0:   # the valuable minerals: liberation is declared for them
            flotation = m.flotation
            if flotation is not None and "floatability" in factors:
                flotation = replace(flotation, floatability=flotation.floatability * factors["floatability"])
            m = replace(m, liberation_size_um=m.liberation_size_um * factors.get("liberation_size", 1.0), flotation=flotation)
        minerals.append(m)
    ore = replace(case.ore, minerals=tuple(minerals))
    new_point = point.with_values(work_index_kwh_t=point.work_index_kwh_t * factors.get("work_index", 1.0),
                                  head_grade=point.head_grade * factors.get("head_grade", 1.0))
    return ore, new_point


def _evaluate(case: CaseDef, point: OperatingPoint, factors: dict[str, float]) -> dict[str, Any]:
    ore, p = perturbed(case, point, factors)
    result = simulate(ore, case.plant, p)
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
    unit = qmc.LatinHypercube(d=len(names), scramble=True, rng=np.random.default_rng(seed)).random(n)
    factors = 1.0 - np.asarray(widths) + 2.0 * np.asarray(widths) * unit
    rows = [_evaluate(case, point, dict(zip(names, map(float, row)))) for row in factors]
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
    probabilities = {c: float(np.mean([r["checks"][c] for r in rows])) for c in checks}
    probabilities["all_constraints"] = float(np.mean([all(r["checks"].values()) for r in rows]))
    flag_counts: dict[str, int] = {}
    for r in rows:
        for code in r["flags"]:
            flag_counts[code] = flag_counts.get(code, 0) + 1
    return {
        "status": "computed",
        "samples": n,
        "seed": seed,
        "design": "scrambled Latin hypercube",
        "inputs": {name: {"half_width": w} for name, w in zip(names, widths)},
        "factors": [[float(v) for v in row] for row in factors],
        "outputs": outputs,
        "probabilities": probabilities,
        "base_checks": base["checks"],
        "flag_counts": flag_counts,
        "max_balance_error": max(r["balance"] for r in rows),
    }


def sensitivity(case: CaseDef, point: OperatingPoint, base_samples: int | None = None, seed: int | None = None) -> dict[str, Any]:
    names = inputs_for(case)
    widths = _half_widths(names)
    n = int(constant("sensitivity.base_samples")) if base_samples is None else base_samples
    seed = int(constant("uncertainty.seed")) if seed is None else seed
    problem = {"num_vars": len(names), "names": list(names),
               "bounds": [[1.0 - w, 1.0 + w] for w in widths]}
    design = sobol_sample.sample(problem, n, calc_second_order=False, scramble=True, seed=seed)
    results = {key: np.empty(len(design)) for key in OUTPUTS}
    for i, row in enumerate(design):
        outputs = _evaluate(case, point, dict(zip(names, map(float, row))))["outputs"]
        for key in OUTPUTS:
            results[key][i] = outputs[key]
    indices = {}
    for key in OUTPUTS:
        y = results[key]
        if float(np.var(y)) == 0.0:
            indices[key] = {"constant": True}
            continue
        analysis = sobol_analyze.analyze(problem, y, calc_second_order=False,
                                         num_resamples=int(constant("sensitivity.resamples")),
                                         conf_level=float(constant("sensitivity.confidence")), seed=seed)
        indices[key] = {part: {name: float(v) for name, v in zip(names, analysis[part])}
                        for part in ("S1", "S1_conf", "ST", "ST_conf")}
    return {"status": "computed", "base_samples": n, "evaluations": len(design), "seed": seed,
            "inputs": {name: {"half_width": w} for name, w in zip(names, widths)}, "indices": indices}
