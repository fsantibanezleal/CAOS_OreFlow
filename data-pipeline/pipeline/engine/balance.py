"""Independent conservation audit.

The audit re-sums the solids of every mineral, every reported species and the water entering and
leaving each unit from the named streams alone, so it cannot pass by construction (review finding
B3). A unit that creates or destroys mass by more than the tolerance fails PE-02.
"""
from __future__ import annotations

import numpy as np

from .ore import ResolvedOre
from .streams import Stream


def _relative(inflow: float, outflow: float) -> float:
    scale = max(abs(inflow), abs(outflow))
    return abs(inflow - outflow) / scale if scale > 0.0 else 0.0


def unit_closure(inputs: list[Stream], outputs: list[Stream], ore: ResolvedOre, water_in: float = 0.0) -> dict[str, float]:
    errors: dict[str, float] = {}
    for m in ore.ids:
        errors[f"solids:{m}"] = _relative(sum(s.mineral_tph(m) for s in inputs), sum(s.mineral_tph(m) for s in outputs))
    for species in ore.species:
        errors[f"species:{species}"] = _relative(sum(s.species_tph(species, ore.composition) for s in inputs),
                                                 sum(s.species_tph(species, ore.composition) for s in outputs))
    errors["water"] = _relative(sum(s.water for s in inputs) + water_in, sum(s.water for s in outputs))
    return errors


def audit(units: list[tuple[str, list[Stream], list[Stream], float]], ore: ResolvedOre) -> dict[str, object]:
    report = {}
    worst = 0.0
    for name, inputs, outputs, water_in in units:
        errors = unit_closure(inputs, outputs, ore, water_in)
        report[name] = max(errors.values()) if errors else 0.0
        worst = max(worst, report[name])
    return {"units": report, "max_relative_error": float(worst)}


def nonnegative(streams: dict[str, Stream], tolerance: float) -> list[str]:
    """Names of streams carrying a negative class mass beyond the tolerance."""
    bad = []
    for name, stream in streams.items():
        for mass in stream.solids.values():
            if np.any(mass < -tolerance):
                bad.append(name)
                break
    return bad
