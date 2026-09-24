"""Stage 2: make the leakage-safe design matrix from case variants."""
from __future__ import annotations

from typing import Any

import numpy as np

from ..cases.catalog import CASES
from ..model.process import circuit_metrics, variant_params

FEATURE_NAMES = ("feed_tph", "feed_grade_pct", "feed_p80_um", "hardness_kwh_t", "density_t_m3",
                 "grind_p80_um", "classifier_cut_um", "flotation_time_min", "air_rate_m3_min",
                 "reagent_gpt", "water_m3_t", "is_gravity_rougher", "is_magnetic", "is_deslime_rougher")


def vector(params) -> np.ndarray:
    return np.array([params.feed_tph / 1000.0, params.feed_grade_pct / 5.0, params.feed_p80_um / 15_000.0,
                     params.hardness_kwh_t / 20.0, params.density_t_m3 / 3.0, params.grind_p80_um / 200.0,
                     params.classifier_cut_um / 150.0, params.flotation_time_min / 20.0,
                     params.air_rate_m3_min / 2.5, params.reagent_gpt / 250.0, params.water_m3_t / 3.0,
                     float(params.process_family == "gravity_rougher"), float(params.process_family == "magnetic"),
                     float(params.process_family == "deslime_rougher")], dtype=np.float64)


def run(seed: int = 42, samples: int = 720) -> dict[str, Any]:
    rng = np.random.default_rng(seed)
    rows: list[dict[str, Any]] = []
    for i in range(samples):
        case = CASES[i % len(CASES)]
        factors = {name: float(rng.lognormal(0.0, 0.10)) for name in (
            "feed_tph", "feed_grade_pct", "feed_p80_um", "hardness_kwh_t", "density_t_m3",
            "grind_p80_um", "classifier_cut_um", "flotation_time_min", "air_rate_m3_min", "reagent_gpt", "water_m3_t")}
        p = variant_params(case.params, {f"{name}_factor": value for name, value in factors.items()}, case_id=f"design_{i:04d}")
        if p.grind_p80_um >= p.feed_p80_um:
            p = variant_params(p, {"grind_p80_um": p.feed_p80_um * 0.25}, p.case_id)
        m = circuit_metrics(p)
        rows.append({"case_id": p.case_id, "category": case.category, "x": vector(p).tolist(),
                     "target_recovery": m["recovery_pct"], "target_grade": m["concentrate_grade_pct"],
                     "target_energy": m["specific_energy_kwh_t"]})
    rng.shuffle(rows)
    n = len(rows)
    train = int(n * 0.70)
    validation = int(n * 0.15)
    return {"feature_names": list(FEATURE_NAMES), "rows": rows,
            "splits": {"train": train, "validation": validation, "test": n - train - validation}, "seed": seed}
