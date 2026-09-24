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
    {"id": "whiten", "tier": "classical", "domain": "comminution", "name": "Whiten-style crusher proxy"},
    {"id": "pbm", "tier": "classical", "domain": "grinding", "name": "Distribution-shape mill proxy"},
    {"id": "partition", "tier": "classical", "domain": "classification", "name": "Logistic partition curve"},
    {"id": "plitt", "tier": "classical", "domain": "classification", "name": "Plitt-style cut-size proxy"},
    {"id": "gravity_window", "tier": "classical", "domain": "gravity", "name": "Free-gold gravity size-window proxy"},
    {"id": "lims_capture", "tier": "classical", "domain": "magnetic", "name": "Magnetic size-window capture proxy"},
    {"id": "first_order", "tier": "classical", "domain": "flotation", "name": "First-order flotation kinetics"},
    {"id": "kelsall", "tier": "classical", "domain": "flotation", "name": "Kelsall fast/slow kinetics"},
    {"id": "compressed_exponential", "tier": "classical", "domain": "flotation", "name": "Compressed exponential kinetics"},
    {"id": "mass_balance", "tier": "integration", "domain": "circuit", "name": "Circuit mass balance"},
    {"id": "constrained_opt", "tier": "optimization", "domain": "circuit", "name": "Bounded grid search"},
    {"id": "robust_mc", "tier": "uncertainty", "domain": "circuit", "name": "Scenario perturbation ensemble"},
    {"id": "ridge", "tier": "learned", "domain": "surrogate", "name": "Ridge surrogate"},
    {"id": "random_forest", "tier": "learned", "domain": "surrogate", "name": "Random forest surrogate"},
    {"id": "hist_gradient_boosting", "tier": "learned", "domain": "surrogate", "name": "Histogram gradient boosting"},
    {"id": "gaussian_process", "tier": "frontier", "domain": "surrogate", "name": "Gaussian process surrogate"},
    {"id": "mlp", "tier": "frontier", "domain": "surrogate", "name": "PyTorch MLP surrogate"},
    {"id": "autoencoder", "tier": "frontier", "domain": "diagnostics", "name": "Autoencoder reconstruction diagnostic"},
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


def classify_size_distribution(size_um: np.ndarray, feed_cdf: np.ndarray, d50_um: float,
                               imperfection: float = 0.16) -> tuple[np.ndarray, float]:
    """Apply a partition to size-bin masses, then normalize the overflow CDF.

    A cumulative passing curve is not a mass in a size class: multiplying its
    ordinates by a partition curve can produce a decreasing, non-physical CDF.
    The last bin includes the unrepresented coarse tail so the two streams
    conserve the unit feed mass on the finite display grid.
    """
    bin_mass = np.diff(np.r_[0.0, np.clip(feed_cdf, 0.0, 1.0)])
    bin_mass[-1] += max(0.0, 1.0 - float(bin_mass.sum()))
    overflow_bin_mass = bin_mass * logistic_partition(size_um, d50_um, imperfection)
    split = float(overflow_bin_mass.sum())
    overflow_cdf = np.cumsum(overflow_bin_mass) / max(split, 1e-12)
    return np.clip(overflow_cdf, 0.0, 1.0), split


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
    mass_pull = min(_clip(0.018 + 0.085 * partition + 0.000015 * p.reagent_gpt, 0.015, 0.18), partition * 0.95)
    concentrate_tph = feed_mass * mass_pull
    valuable_feed = feed_mass * p.feed_grade_pct / 100.0
    valuable_conc = valuable_feed * recovery
    grade_pct = 100.0 * valuable_conc / max(concentrate_tph, 1e-9)
    tail_grade = 100.0 * valuable_feed * (1 - recovery) / max(feed_mass * (1 - mass_pull), 1e-9)
    return {"recovery_pct": recovery * 100.0, "mass_pull_pct": mass_pull * 100.0, "concentrate_tph": concentrate_tph,
            "concentrate_grade_pct": grade_pct, "tail_grade_pct": tail_grade,
            "metal_balance_pct": (valuable_conc + valuable_feed * (1 - recovery)) / max(valuable_feed, 1e-9) * 100.0}


def gravity_branch(p: FeedParams, size: np.ndarray, ground: np.ndarray, cut: float, overflow_fraction: float) -> dict[str, float]:
    """Authored one-pass gravity branch on classifier underflow, followed by rougher on overflow.

    The size window and 18% gravity-product grade are explicit research assumptions,
    not fitted GRG testwork or a centrifugal concentrator performance guarantee.
    """
    bins = np.diff(np.r_[0.0, np.clip(ground, 0.0, 1.0)])
    bins[-1] += max(0.0, 1.0 - float(bins.sum()))
    underflow = bins * (1.0 - logistic_partition(size, cut, 0.16))
    window = (1.0 - np.exp(-size / 45.0)) * np.exp(-size / 700.0)
    gravity_recovery = float(min(0.95, 0.82 * np.sum(underflow * window)))
    flotation_recovery = first_order_recovery(p) * overflow_fraction
    recovery = min(0.98, gravity_recovery + flotation_recovery)
    float_mass_pull = min(_clip(0.018 + 0.085 * overflow_fraction + 0.000015 * p.reagent_gpt, 0.015, 0.18), overflow_fraction * 0.95)
    gravity_mass_pull = min(max(0.0, 1.0 - overflow_fraction) * 0.012,
                            (p.feed_grade_pct / 100.0) * gravity_recovery / 0.18)
    mass_pull = float_mass_pull + gravity_mass_pull
    valuable_feed = p.feed_tph * p.feed_grade_pct / 100.0
    product_tph = p.feed_tph * mass_pull
    valuable_product = valuable_feed * recovery
    return {"recovery_pct": 100.0 * recovery, "flotation_recovery_pct": 100.0 * flotation_recovery,
            "gravity_recovery_pct": 100.0 * gravity_recovery,
            "gravity_product_tph": p.feed_tph * gravity_mass_pull,
            "rougher_product_tph": p.feed_tph * float_mass_pull,
            "concentrate_tph": product_tph, "mass_pull_pct": 100.0 * mass_pull,
            "concentrate_grade_pct": 100.0 * valuable_product / max(product_tph, 1e-9),
            "tail_grade_pct": 100.0 * (valuable_feed - valuable_product) / max(p.feed_tph - product_tph, 1e-9),
            "metal_balance_pct": 100.0}


def magnetic_branch(p: FeedParams, size: np.ndarray, ground: np.ndarray) -> dict[str, float]:
    """Size-window LIMS proxy for magnetite; no cyclone or flotation in this path.

    Capture shape and 62% product grade are authored assumptions, not measured
    susceptibility, separator field strength, or magnetite liberation testwork.
    """
    bins = np.diff(np.r_[0.0, np.clip(ground, 0.0, 1.0)])
    bins[-1] += max(0.0, 1.0 - float(bins.sum()))
    capture = 0.91 * (1.0 - np.exp(-size / 25.0)) * np.exp(-size / 1800.0)
    recovery = float(np.clip(np.sum(bins * capture), 0.0, 0.98))
    valuable_feed = p.feed_tph * p.feed_grade_pct / 100.0
    product_tph = valuable_feed * recovery / 0.62
    tail_tph = p.feed_tph - product_tph
    return {"recovery_pct": 100.0 * recovery, "magnetic_recovery_pct": 100.0 * recovery,
            "flotation_recovery_pct": 0.0, "concentrate_grade_pct": 62.0,
            "concentrate_tph": product_tph, "magnetic_product_tph": product_tph,
            "mass_pull_pct": 100.0 * product_tph / p.feed_tph,
            "tail_grade_pct": 100.0 * valuable_feed * (1.0 - recovery) / max(tail_tph, 1e-9),
            "metal_balance_pct": 100.0}


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
            candidate = FeedParams(case_id=p.case_id, process_family=p.process_family, feed_tph=p.feed_tph, feed_grade_pct=p.feed_grade_pct,
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
        q = FeedParams(case_id=p.case_id, process_family=p.process_family, feed_tph=p.feed_tph, feed_grade_pct=p.feed_grade_pct * grade, feed_p80_um=p.feed_p80_um,
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
    cut = plitt_cut_size(p) if p.process_family != "magnetic" else 0.0
    _, overflow_fraction = classify_size_distribution(size, ground, cut) if p.process_family != "magnetic" else (ground, 1.0)
    rougher_feed_fraction = 1.0 - overflow_fraction if p.process_family == "deslime_rougher" else overflow_fraction
    recovery = first_order_recovery(p) * rougher_feed_fraction
    metrics = (gravity_branch(p, size, ground, cut, overflow_fraction) if p.process_family == "gravity_rougher"
               else magnetic_branch(p, size, ground) if p.process_family == "magnetic"
               else concentrate_metrics(p, recovery, rougher_feed_fraction))
    if p.process_family in {"rougher", "deslime_rougher"}:
        metrics["flotation_recovery_pct"] = metrics["recovery_pct"]
    e_rit = rittinger_energy(p.feed_p80_um, p.grind_p80_um)
    e_kick = kick_energy(p.feed_p80_um, p.grind_p80_um)
    e_bond = bond_energy(p.feed_p80_um, p.grind_p80_um, p.hardness_kwh_t)
    metrics.update({"crusher_p80_um": crusher_p80, "cyclone_d50_um": cut, "overflow_fraction": overflow_fraction,
                    "energy_rittinger_kwh_t": e_rit, "energy_kick_kwh_t": e_kick,
                    "energy_bond_kwh_t": e_bond, "specific_energy_kwh_t": 0.22 * e_rit + 0.12 * e_kick + e_bond,
                    "water_use_m3_h": p.feed_tph * p.water_m3_t, "unit_cost_index": 0.85 * (e_bond + 0.8 * p.water_m3_t) + 0.004 * p.reagent_gpt})
    return metrics


def method_outputs(p: FeedParams, metrics: dict[str, float], learned: dict[str, float] | None = None) -> list[dict[str, Any]]:
    optimum = constrained_optimize(p) if p.process_family != "magnetic" else None
    uncertainty = robust_monte_carlo(p)
    out = []
    classical = {
        "rittinger": metrics["energy_rittinger_kwh_t"], "kick": metrics["energy_kick_kwh_t"], "bond": metrics["energy_bond_kwh_t"],
        "whiten": metrics["crusher_p80_um"], "pbm": p.grind_p80_um, "partition": metrics["overflow_fraction"] * 100,
        "plitt": metrics["cyclone_d50_um"] if p.process_family != "magnetic" else None,
        "gravity_window": metrics.get("gravity_recovery_pct"),
        "lims_capture": metrics.get("magnetic_recovery_pct"),
        "first_order": metrics["flotation_recovery_pct"] if p.process_family != "magnetic" else None,
        "kelsall": kelsall_recovery(p) * (1.0 - metrics["overflow_fraction"] if p.process_family == "deslime_rougher" else metrics["overflow_fraction"]) * 100 if p.process_family != "magnetic" else None,
        "compressed_exponential": compressed_exponential_recovery(p) * (1.0 - metrics["overflow_fraction"] if p.process_family == "deslime_rougher" else metrics["overflow_fraction"]) * 100 if p.process_family != "magnetic" else None,
        "mass_balance": metrics["metal_balance_pct"],
        "constrained_opt": optimum["objective"] if optimum else None,
        "robust_mc": uncertainty["p05_recovery_pct"],
    }
    for method in METHODS:
        value = classical.get(method["id"], (learned or {}).get(method["id"]))
        if p.process_family == "magnetic" and method["id"] == "partition":
            value = None
        unit = ("kWh/t" if method["id"] in {"rittinger", "kick", "bond"} else
                "µm" if method["id"] in {"whiten", "pbm", "plitt"} else
                "score" if method["id"] == "constrained_opt" else
                "MSE" if method["id"] == "autoencoder" else "%")
        not_applicable = (method["id"] == "gravity_window" and p.process_family != "gravity_rougher"
                          or method["id"] == "lims_capture" and p.process_family != "magnetic"
                          or p.process_family == "magnetic" and method["id"] in {
                              "partition", "plitt", "first_order", "kelsall", "compressed_exponential", "constrained_opt"})
        out.append({**method, "value": round(float(value), 6) if value is not None else None,
                    "unit": unit, "status": "precomputed" if value is not None else "not-applicable" if not_applicable else "unavailable"})
    return out


def simulate(p: FeedParams, angle_step: float = 6.0, learned: dict[str, float] | None = None) -> ProcessResult:
    """Run the integrated circuit at an operating point."""
    del angle_step  # visual camera control does not alter scientific state
    size = np.geomspace(10.0, max(p.feed_p80_um * 2.3, 1_000.0), 96)
    feed = feed_psd(size, p.feed_p80_um)
    crushed, crusher_p80 = whiten_crusher(size, p.feed_p80_um, max(80.0, p.feed_p80_um * 0.22))
    ground = population_balance(size, crusher_p80, p.grind_p80_um, p.hardness_kwh_t)
    cut = plitt_cut_size(p) if p.process_family != "magnetic" else 0.0
    overflow, overflow_fraction = classify_size_distribution(size, ground, cut) if p.process_family != "magnetic" else (ground, 1.0)
    metrics = circuit_metrics(p)
    rougher_feed_fraction = 1.0 - overflow_fraction if p.process_family == "deslime_rougher" else overflow_fraction
    recovery_curve = rougher_feed_fraction * 0.97 * (1.0 - np.exp(-flotation_rate(p) * np.linspace(0.0, p.flotation_time_min, 96)))
    if p.process_family == "gravity_rougher":
        recovery_curve += metrics["gravity_recovery_pct"] / 100.0
    elif p.process_family == "magnetic":
        recovery_curve[:] = 0.0
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
    return FeedParams(case_id=case_id or base.case_id, seed=base.seed, process_family=base.process_family, **values)
