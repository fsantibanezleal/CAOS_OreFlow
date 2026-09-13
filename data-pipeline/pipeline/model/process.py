"""Deterministic mineral-processing models used by both pipeline and API.

The functions are intentionally small, vectorised NumPy kernels.  They expose
the assumptions instead of hiding them behind a black-box simulator: energy
laws, particle-size distributions, classifier partitioning, hydrocyclone
cut-size, flotation kinetics and a constrained circuit objective.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np

from ..io.schema import FeedParams, ProcessResult


METHODS = (
    {"id": "rittinger", "tier": "classical", "domain": "comminution", "name": "Rittinger surface-area law"},
    {"id": "kick", "tier": "classical", "domain": "comminution", "name": "Kick similarity law"},
    {"id": "bond", "tier": "classical", "domain": "comminution", "name": "Bond work-index law"},
    {"id": "whiten", "tier": "classical", "domain": "comminution", "name": "Whiten crusher model"},
    {"id": "pbm", "tier": "classical", "domain": "grinding", "name": "Population-balance mill model"},
    {"id": "partition", "tier": "classical", "domain": "classification", "name": "Logistic partition curve"},
    {"id": "plitt", "tier": "classical", "domain": "classification", "name": "Plitt hydrocyclone approximation"},
    {"id": "first_order", "tier": "classical", "domain": "flotation", "name": "First-order flotation kinetics"},
    {"id": "kelsall", "tier": "classical", "domain": "flotation", "name": "Kelsall fast/slow kinetics"},
    {"id": "compressed_exponential", "tier": "classical", "domain": "flotation", "name": "Compressed exponential kinetics"},
    {"id": "mass_balance", "tier": "integration", "domain": "circuit", "name": "Circuit mass balance"},
    {"id": "constrained_opt", "tier": "optimization", "domain": "circuit", "name": "Constrained nonlinear optimization"},
    {"id": "robust_mc", "tier": "uncertainty", "domain": "circuit", "name": "Robust Monte Carlo"},
    {"id": "ridge", "tier": "learned", "domain": "surrogate", "name": "Ridge surrogate"},
    {"id": "random_forest", "tier": "learned", "domain": "surrogate", "name": "Random forest surrogate"},
    {"id": "hist_gradient_boosting", "tier": "learned", "domain": "surrogate", "name": "Histogram gradient boosting"},
    {"id": "gaussian_process", "tier": "frontier", "domain": "surrogate", "name": "Gaussian process with uncertainty"},
    {"id": "mlp", "tier": "frontier", "domain": "surrogate", "name": "PyTorch MLP surrogate"},
    {"id": "autoencoder", "tier": "frontier", "domain": "diagnostics", "name": "Autoencoder OOD detector"},
)


def _clip(value: float, low: float, high: float) -> float:
    return float(np.clip(value, low, high))


def rittinger_energy(feed_p80_um: float, product_p80_um: float, coefficient: float = 0.028) -> float:
    """Specific energy proportional to new surface area (kWh/t)."""
    return coefficient * max(0.0, 1_000_000.0 / product_p80_um - 1_000_000.0 / feed_p80_um)


def kick_energy(feed_p80_um: float, product_p80_um: float, coefficient: float = 1.85) -> float:
    """Specific energy from geometric size reduction."""
    return coefficient * max(0.0, math.log(max(feed_p80_um, product_p80_um) / max(product_p80_um, 1e-6)))


def bond_energy(feed_p80_um: float, product_p80_um: float, wi: float) -> float:
    """Bond's third theory with P80/F80 in microns and a unit correction."""
    return 10.0 * wi * max(0.0, 1 / math.sqrt(product_p80_um) - 1 / math.sqrt(feed_p80_um))


def feed_psd(size_um: np.ndarray, p80_um: float, slope: float = 0.73) -> np.ndarray:
    """Rosin-Rammler-like cumulative passing curve."""
    x = np.maximum(size_um, 1e-6)
    scale = p80_um / max(-math.log(0.2), 1e-9) ** (1 / slope)
    return np.clip(1.0 - np.exp(-np.power(x / max(scale, 1e-6), slope)), 0.0, 1.0)


def whiten_crusher(size_um: np.ndarray, p80_um: float, css_um: float) -> tuple[np.ndarray, float]:
    """A simplified Whiten breakage/classification response.

    CSS controls the bypass/coarse tail; the returned scalar is the crusher
    product P80 used by downstream comminution laws.
    """
    product_p80 = _clip(0.72 * css_um + 0.12 * p80_um, 40.0, p80_um * 0.98)
    curve = feed_psd(size_um, product_p80, slope=0.82)
    bypass = np.exp(-np.maximum(size_um - css_um, 0) / max(css_um * 1.4, 1)) * 0.08
    return np.clip(curve - bypass * (1 - curve), 0.0, 1.0), product_p80


def population_balance(size_um: np.ndarray, crusher_p80: float, target_p80: float, hardness: float) -> np.ndarray:
    """Compact PBM proxy: selection sharpness falls with hardness."""
    ratio = max(crusher_p80 / max(target_p80, 1), 1.0)
    slope = _clip(0.48 + 0.9 / ratio - 0.006 * hardness, 0.20, 1.25)
    return feed_psd(size_um, target_p80, slope=slope)


def logistic_partition(size_um: np.ndarray, d50_um: float, imperfection: float) -> np.ndarray:
    """Fine recovery to overflow from a logistic partition curve."""
    sharpness = max(d50_um * _clip(imperfection, 0.03, 0.6), 1e-6)
    z = np.clip((size_um - d50_um) / sharpness, -60.0, 60.0)
    return 1.0 / (1.0 + np.exp(z))


def plitt_cut_size(p: FeedParams) -> float:
    """Plitt-style hydrocyclone cut-size approximation with transparent factors."""
    pressure_factor = 1.0 / math.sqrt(max(0.25, p.water_m3_t / 2.0))
    density_factor = math.sqrt(2.65 / max(p.density_t_m3, 1.2))
    feed_factor = (max(p.feed_tph, 1.0) / 500.0) ** 0.08
    return _clip(0.34 * p.classifier_cut_um * pressure_factor * density_factor * feed_factor, 8.0, p.feed_p80_um)


def flotation_rate(p: FeedParams, mineral: str = "valuable") -> float:
    """Rate constant combining liberation, reagent, air and residence time effects."""
    liberation = 1.0 - math.exp(-1.8 * (p.grind_p80_um / 220.0) ** -0.35)
    reagent = 1.0 - math.exp(-p.reagent_gpt / 180.0)
    air = 1.0 - math.exp(-p.air_rate_m3_min / 1.4)
    mineral_factor = {"valuable": 1.0, "gangue": 0.22, "slow": 0.55}.get(mineral, 1.0)
    return 0.045 * liberation * reagent * air * mineral_factor


def first_order_recovery(p: FeedParams, mineral: str = "valuable") -> float:
    return _clip(0.97 * (1.0 - math.exp(-flotation_rate(p, mineral) * p.flotation_time_min)), 0.0, 0.98)


def kelsall_recovery(p: FeedParams) -> float:
    k_fast = flotation_rate(p, "valuable") * 1.9
    k_slow = flotation_rate(p, "slow") * 0.58
    return _clip(0.97 * (0.62 * (1 - math.exp(-k_fast * p.flotation_time_min)) + 0.38 * (1 - math.exp(-k_slow * p.flotation_time_min))), 0.0, 0.98)


def compressed_exponential_recovery(p: FeedParams) -> float:
    k = flotation_rate(p, "valuable")
    return _clip(0.97 * (1 - math.exp(-max(k * p.flotation_time_min, 0.0) ** 0.78)), 0.0, 0.98)


def concentrate_metrics(p: FeedParams, recovery: float, partition: float) -> dict[str, float]:
    """Mass-balance closure for a one-stage rougher concentrate."""
    feed_mass = p.feed_tph
    mass_pull = _clip(0.018 + 0.085 * partition + 0.000015 * p.reagent_gpt, 0.015, 0.18)
    concentrate_tph = feed_mass * mass_pull
    valuable_feed = feed_mass * p.feed_grade_pct / 100.0
    valuable_conc = valuable_feed * recovery
    grade_pct = 100.0 * valuable_conc / max(concentrate_tph, 1e-9)
    tail_grade = 100.0 * valuable_feed * (1 - recovery) / max(feed_mass * (1 - mass_pull), 1e-9)
    return {"recovery_pct": recovery * 100.0, "mass_pull_pct": mass_pull * 100.0, "concentrate_tph": concentrate_tph,
            "concentrate_grade_pct": grade_pct, "tail_grade_pct": tail_grade,
            "metal_balance_pct": (valuable_conc + valuable_feed * (1 - recovery)) / max(valuable_feed, 1e-9) * 100.0}


def constrained_optimize(p: FeedParams) -> dict[str, float]:
    """Deterministic constrained grid search used as the browser-safe optimizer.

    The objective rewards recovery and grade while penalising specific energy.
    Candidates violating a 0.5 percentage-point metal-balance tolerance are
    discarded.  This is intentionally auditable and bounded for interaction.
    """
    best: dict[str, float] | None = None
    for grind_factor in (0.72, 0.86, 1.0, 1.14, 1.28):
        for reagent_factor in (0.72, 0.9, 1.0, 1.15, 1.3):
            grind = _clip(p.grind_p80_um * grind_factor, 8.0, p.feed_p80_um * 0.85)
            candidate = FeedParams(case_id=p.case_id, feed_tph=p.feed_tph, feed_grade_pct=p.feed_grade_pct,
                                   feed_p80_um=p.feed_p80_um, hardness_kwh_t=p.hardness_kwh_t, density_t_m3=p.density_t_m3,
                                   grind_p80_um=grind, classifier_cut_um=_clip(p.classifier_cut_um * (0.84 + 0.22 * grind_factor), grind * 0.55, p.feed_p80_um * 0.7),
                                   flotation_time_min=p.flotation_time_min, air_rate_m3_min=p.air_rate_m3_min,
                                   reagent_gpt=p.reagent_gpt * reagent_factor, water_m3_t=p.water_m3_t, seed=p.seed)
            m = circuit_metrics(candidate)
            objective = m["recovery_pct"] + 0.35 * m["concentrate_grade_pct"] - 0.18 * m["specific_energy_kwh_t"] - 0.006 * candidate.reagent_gpt
            if m["metal_balance_pct"] >= 99.5 and (best is None or objective > best["objective"]):
                best = {"objective": objective, "recovery_pct": m["recovery_pct"], "grade_pct": m["concentrate_grade_pct"],
                        "grind_p80_um": grind, "reagent_gpt": candidate.reagent_gpt, "energy_kwh_t": m["specific_energy_kwh_t"]}
    return best or {"objective": 0.0, "recovery_pct": 0.0, "grade_pct": 0.0, "grind_p80_um": p.grind_p80_um, "reagent_gpt": p.reagent_gpt, "energy_kwh_t": 0.0}


def robust_monte_carlo(p: FeedParams, samples: int = 128) -> dict[str, float]:
    """Propagate declared lognormal uncertainty through the same circuit."""
    rng = np.random.default_rng(p.seed)
    recovery: list[float] = []
    energy: list[float] = []
    for hardness, grade, cut in zip(rng.lognormal(0.0, 0.10, samples), rng.lognormal(0.0, 0.12, samples), rng.lognormal(0.0, 0.08, samples)):
        q = FeedParams(case_id=p.case_id, feed_tph=p.feed_tph, feed_grade_pct=p.feed_grade_pct * grade, feed_p80_um=p.feed_p80_um,
                       hardness_kwh_t=p.hardness_kwh_t * hardness, density_t_m3=p.density_t_m3, grind_p80_um=p.grind_p80_um,
                       classifier_cut_um=p.classifier_cut_um * cut, flotation_time_min=p.flotation_time_min,
                       air_rate_m3_min=p.air_rate_m3_min, reagent_gpt=p.reagent_gpt, water_m3_t=p.water_m3_t, seed=p.seed)
        m = circuit_metrics(q)
        recovery.append(m["recovery_pct"])
        energy.append(m["specific_energy_kwh_t"])
    return {"p05_recovery_pct": float(np.quantile(recovery, 0.05)), "p50_recovery_pct": float(np.quantile(recovery, 0.50)),
            "p95_recovery_pct": float(np.quantile(recovery, 0.95)), "p50_energy_kwh_t": float(np.quantile(energy, 0.50)), "samples": float(samples)}


def circuit_metrics(p: FeedParams) -> dict[str, float]:
    size = np.geomspace(10.0, max(p.feed_p80_um * 2.3, 1_000.0), 96)
    crusher, crusher_p80 = whiten_crusher(size, p.feed_p80_um, max(80.0, p.feed_p80_um * 0.22))
    ground = population_balance(size, crusher_p80, p.grind_p80_um, p.hardness_kwh_t)
    cut = plitt_cut_size(p)
    part = logistic_partition(size, cut, 0.16)
    overflow = ground * part
    overflow_fraction = float(np.trapezoid(np.gradient(overflow, size), size)) if hasattr(np, "trapezoid") else float(np.trapz(np.gradient(overflow, size), size))
    overflow_fraction = _clip(overflow_fraction, 0.05, 0.98)
    recovery = first_order_recovery(p)
    metrics = concentrate_metrics(p, recovery, overflow_fraction)
    e_rit = rittinger_energy(p.feed_p80_um, p.grind_p80_um)
    e_kick = kick_energy(p.feed_p80_um, p.grind_p80_um)
    e_bond = bond_energy(p.feed_p80_um, p.grind_p80_um, p.hardness_kwh_t)
    metrics.update({"crusher_p80_um": crusher_p80, "cyclone_d50_um": cut, "overflow_fraction": overflow_fraction,
                    "energy_rittinger_kwh_t": e_rit, "energy_kick_kwh_t": e_kick,
                    "energy_bond_kwh_t": e_bond, "specific_energy_kwh_t": 0.22 * e_rit + 0.12 * e_kick + e_bond,
                    "water_use_m3_h": p.feed_tph * p.water_m3_t, "unit_cost_index": 0.85 * (e_bond + 0.8 * p.water_m3_t) + 0.004 * p.reagent_gpt})
    return metrics


def method_outputs(p: FeedParams, metrics: dict[str, float], learned: dict[str, float] | None = None) -> list[dict[str, Any]]:
    optimum = constrained_optimize(p)
    uncertainty = robust_monte_carlo(p)
    out = []
    classical = {
        "rittinger": metrics["energy_rittinger_kwh_t"], "kick": metrics["energy_kick_kwh_t"], "bond": metrics["energy_bond_kwh_t"],
        "whiten": metrics["crusher_p80_um"], "pbm": metrics["specific_energy_kwh_t"], "partition": metrics["overflow_fraction"],
        "plitt": metrics["cyclone_d50_um"], "first_order": metrics["recovery_pct"], "kelsall": kelsall_recovery(p) * 100,
        "compressed_exponential": compressed_exponential_recovery(p) * 100, "mass_balance": metrics["metal_balance_pct"],
        "constrained_opt": optimum["objective"],
        "robust_mc": uncertainty["p05_recovery_pct"],
    }
    for method in METHODS:
        value = classical.get(method["id"], (learned or {}).get(method["id"], metrics["recovery_pct"]))
        out.append({**method, "value": round(float(value), 6), "unit": "%" if method["id"] in {"first_order", "kelsall", "compressed_exponential", "mass_balance", "robust_mc", "autoencoder"} else "index"})
    return out


def simulate(p: FeedParams, angle_step: float = 6.0, learned: dict[str, float] | None = None) -> ProcessResult:
    """Run the integrated circuit at an operating point."""
    del angle_step  # visual camera control does not alter scientific state
    size = np.geomspace(10.0, max(p.feed_p80_um * 2.3, 1_000.0), 96)
    feed = feed_psd(size, p.feed_p80_um)
    crushed, crusher_p80 = whiten_crusher(size, p.feed_p80_um, max(80.0, p.feed_p80_um * 0.22))
    ground = population_balance(size, crusher_p80, p.grind_p80_um, p.hardness_kwh_t)
    cut = plitt_cut_size(p)
    partition = logistic_partition(size, cut, 0.16)
    overflow = ground * partition
    recovery_curve = 0.97 * (1.0 - np.exp(-flotation_rate(p) * np.linspace(0.0, p.flotation_time_min, 96)))
    metrics = circuit_metrics(p)
    return ProcessResult(case_id=p.case_id, size_um=size.tolist(), feed_psd=feed.tolist(), crushed_psd=crushed.tolist(),
                         ground_psd=ground.tolist(), overflow_psd=overflow.tolist(), flotation_recovery=recovery_curve.tolist(),
                         metrics=metrics, method_outputs=method_outputs(p, metrics, learned))


def variant_params(base: FeedParams, overrides: dict[str, Any], case_id: str | None = None) -> FeedParams:
    values = {name: getattr(base, name) for name in (
        "feed_tph", "feed_grade_pct", "feed_p80_um", "hardness_kwh_t", "density_t_m3", "grind_p80_um",
        "classifier_cut_um", "flotation_time_min", "air_rate_m3_min", "reagent_gpt", "water_m3_t")}
    for key, value in overrides.items():
        if key.endswith("_factor") and key[:-7] in values:
            values[key[:-7]] *= float(value)
        elif key in values:
            values[key] = float(value)
    return FeedParams(case_id=case_id or base.case_id, seed=base.seed, **values)
