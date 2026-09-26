"""Request boundary of the live simulation.

Only types are checked here. The operating envelope is Contract 1: the router applies the same
interpreter the browser runs over the same exported JSON, so both reject the same states with the
same error codes (PE-30).
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SimulationRequest(BaseModel):
    case_id: str = Field(min_length=1, max_length=80)
    point: dict[str, Any] = Field(default_factory=dict, max_length=64)
