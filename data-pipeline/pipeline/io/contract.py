"""CONTRACT 1: strict ingestion for a mineral-processing operating point.

Missing, non-numeric, non-finite and physically impossible values are rejected.
Plausible but unusual values are accepted with a flag for review.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from .schema import FeedParams

REQUIRED_COLUMNS: tuple[str, ...] = (
    "case_id", "feed_tph", "feed_grade_pct", "feed_p80_um", "hardness_kwh_t",
    "density_t_m3", "grind_p80_um", "classifier_cut_um", "flotation_time_min",
    "air_rate_m3_min", "reagent_gpt", "water_m3_t",
)

RANGES: dict[str, tuple[float, float, str]] = {
    "feed_tph": (1.0, 50_000.0, "t/h"),
    "feed_grade_pct": (0.001, 80.0, "%"),
    "feed_p80_um": (100.0, 500_000.0, "µm"),
    "hardness_kwh_t": (0.1, 80.0, "kWh/t"),
    "density_t_m3": (1.2, 6.0, "t/m³"),
    "grind_p80_um": (5.0, 100_000.0, "µm"),
    "classifier_cut_um": (5.0, 100_000.0, "µm"),
    "flotation_time_min": (0.1, 120.0, "min"),
    "air_rate_m3_min": (0.01, 20.0, "m³/min"),
    "reagent_gpt": (0.0, 10_000.0, "g/t"),
    "water_m3_t": (0.01, 20.0, "m³/t"),
}
FLAG_LIMITS = {"feed_tph": 5_000.0, "reagent_gpt": 1_500.0, "water_m3_t": 8.0}


@dataclass
class ContractReport:
    accepted: list[FeedParams]
    rejected: list[dict[str, Any]]
    flagged: list[dict[str, Any]]

    @property
    def ok(self) -> bool:
        return bool(self.accepted) and not self.rejected

    def summary(self) -> str:
        return f"{len(self.accepted)} accepted, {len(self.rejected)} rejected, {len(self.flagged)} flagged"


def validate_rows(raw_rows: list[dict[str, Any]]) -> ContractReport:
    accepted: list[FeedParams] = []
    rejected: list[dict[str, Any]] = []
    flagged: list[dict[str, Any]] = []
    numeric = tuple(k for k in REQUIRED_COLUMNS if k != "case_id")

    for i, row in enumerate(raw_rows):
        cid = str(row.get("case_id", f"row{i}"))
        missing = [c for c in REQUIRED_COLUMNS if c not in row or row[c] in (None, "")]
        if missing:
            rejected.append({"row": i, "case_id": cid, "reason": f"missing/empty columns: {missing}"})
            continue
        try:
            vals = {k: float(row[k]) for k in numeric}
        except (TypeError, ValueError):
            rejected.append({"row": i, "case_id": cid, "reason": "non-numeric process value"})
            continue
        if any(math.isnan(v) or math.isinf(v) for v in vals.values()):
            rejected.append({"row": i, "case_id": cid, "reason": "NaN/Inf value"})
            continue
        bad: list[str] = []
        for name, (lo, hi, _unit) in RANGES.items():
            if not lo <= vals[name] <= hi:
                bad.append(f"{name}={vals[name]:g} out of [{lo:g},{hi:g}]")
        if vals["grind_p80_um"] >= vals["feed_p80_um"]:
            bad.append("grind_p80_um must be smaller than feed_p80_um")
        if vals["classifier_cut_um"] < vals["grind_p80_um"] * 0.5:
            bad.append("classifier_cut_um is below half the grind P80")
        if bad:
            rejected.append({"row": i, "case_id": cid, "reason": "; ".join(bad)})
            continue
        row_flags = [f"{name} above review threshold" for name, limit in FLAG_LIMITS.items() if vals[name] > limit]
        if vals["feed_grade_pct"] < 0.02:
            row_flags.append("very low head grade; recovery/grade trade-off is sensitive")
        if row_flags:
            flagged.append({"case_id": cid, "flags": row_flags})
        try:
            seed = int(float(row.get("seed") or 42))
        except (TypeError, ValueError):
            seed = 42
        accepted.append(FeedParams(case_id=cid, **vals, seed=seed))
    return ContractReport(accepted=accepted, rejected=rejected, flagged=flagged)
