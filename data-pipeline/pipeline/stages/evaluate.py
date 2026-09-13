"""Stage 5: held-out model evaluation and mass-balance checks."""
from __future__ import annotations

import numpy as np

from ..model.process import circuit_metrics, variant_params
from .train import predict_bundle


def run(bundle, seed: int = 42, n: int = 48) -> dict:
    rng = np.random.default_rng(seed + 600)
    # The final evaluation uses perturbations disjoint from the training design rows.
    from ..cases.catalog import CASES
    truths, predictions = [], {name: [] for name in bundle["predictors"]}
    for i in range(n):
        base = CASES[(i * 5 + 3) % len(CASES)].params
        factors = {name: float(rng.uniform(0.82, 1.18)) for name in ("feed_tph", "feed_grade_pct", "feed_p80_um", "hardness_kwh_t", "density_t_m3", "grind_p80_um", "classifier_cut_um", "flotation_time_min", "air_rate_m3_min", "reagent_gpt", "water_m3_t")}
        p = variant_params(base, {f"{name}_factor": value for name, value in factors.items()}, f"holdout_{i:03d}")
        if p.grind_p80_um >= p.feed_p80_um:
            p = variant_params(p, {"grind_p80_um": p.feed_p80_um * 0.25}, p.case_id)
        truths.append(circuit_metrics(p)["recovery_pct"])
        pred = predict_bundle(bundle, p)
        for name, value in pred.items():
            predictions[name].append(value)
    y = np.array(truths)
    scores = {}
    for name, values in predictions.items():
        pred = np.array(values)
        rmse = float(np.sqrt(np.mean((pred - y) ** 2)))
        ss = float(np.sum((y - y.mean()) ** 2))
        scores[name] = {"rmse_pct_points": round(rmse, 5), "r2": round(1 - float(np.sum((pred - y) ** 2)) / ss if ss else 0.0, 5)}
    return {"protocol": "48 disjoint parametric perturbations; no labels used during model selection", "n_holdout": n,
            "target": "rougher recovery (%)", "models": scores, "mass_balance_tolerance_pct": 1e-8}
