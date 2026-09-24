"""Pydantic request/response boundary for the read-only service and live engine."""
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal


class SimRequest(BaseModel):
    case_id: str = Field(min_length=1, max_length=80)
    process_family: Literal["rougher", "gravity_rougher", "magnetic", "deslime_rougher"] | None = None
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
