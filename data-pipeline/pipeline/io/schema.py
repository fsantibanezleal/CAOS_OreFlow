"""Typed records shared by the offline process lab and browser workbench."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FeedParams:
    """One operating point in the OreFlow process contract."""

    case_id: str
    feed_tph: float
    feed_grade_pct: float
    feed_p80_um: float
    hardness_kwh_t: float
    density_t_m3: float
    grind_p80_um: float
    classifier_cut_um: float
    flotation_time_min: float
    air_rate_m3_min: float
    reagent_gpt: float
    water_m3_t: float
    seed: int = 42


@dataclass(frozen=True)
class FeatureRow:
    """Feature vector used by the learned tiers."""

    case_id: str
    feed_tph: float
    feed_grade_pct: float
    feed_p80_um: float
    hardness_kwh_t: float
    density_t_m3: float
    grind_p80_um: float
    classifier_cut_um: float
    flotation_time_min: float
    air_rate_m3_min: float
    reagent_gpt: float
    water_m3_t: float


@dataclass(frozen=True)
class ProcessResult:
    """Canonical response for one circuit simulation."""

    case_id: str
    size_um: list[float]
    feed_psd: list[float]
    crushed_psd: list[float]
    ground_psd: list[float]
    overflow_psd: list[float]
    flotation_recovery: list[float]
    metrics: dict[str, float]
    method_outputs: list[dict[str, Any]]


@dataclass(frozen=True)
class Case:
    id: str
    category: str
    title: str
    description: str
    params: FeedParams
    variants: tuple[dict[str, Any], ...]
    expected_band: str
    provenance: str
