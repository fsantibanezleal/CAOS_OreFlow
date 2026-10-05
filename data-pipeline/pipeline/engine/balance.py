"""Independent conservation audit.

The audit re-sums the solids of every mineral, every reported species and the water entering and
leaving each unit from the named streams alone (review finding B3). Where no breakage acts it also closes every size
class of every mineral, so a stream shifted between classes fails; a breakage operator is audited by the residual of
its own steady-state equation instead (review of 2026-10-04, K-01). Many units define one output as the feed less
the others, so their closure is an identity of the code; page 10 lists them. A unit that creates or destroys mass by
more than the tolerance fails PE-02 and raises ``balance_not_closed``.
"""
from __future__ import annotations

import numpy as np

from .ore import ResolvedOre
from .streams import Stream


def _relative(inflow: float, outflow: float) -> float:
    scale = max(abs(inflow), abs(outflow))
    return abs(inflow - outflow) / scale if scale > 0.0 else 0.0


def unit_closure(inputs: list[Stream], outputs: list[Stream], ore: ResolvedOre, water_in: float = 0.0,
                 by_class: bool = False) -> dict[str, float]:
    errors: dict[str, float] = {}
    for m in ore.ids:
        errors[f"solids:{m}"] = _relative(sum(s.mineral_tph(m) for s in inputs), sum(s.mineral_tph(m) for s in outputs))
        if by_class:
            # every size class, against the mineral's flow through the unit (K-01)
            fin = sum(s.solids[m] for s in inputs)
            fout = sum(s.solids[m] for s in outputs)
            scale = max(float(np.sum(np.abs(fin))), float(np.sum(np.abs(fout))))
            errors[f"classes:{m}"] = float(np.max(np.abs(fin - fout))) / scale if scale > 0.0 else 0.0
    for species in ore.species:
        errors[f"species:{species}"] = _relative(sum(s.species_tph(species, ore.composition) for s in inputs),
                                                 sum(s.species_tph(species, ore.composition) for s in outputs))
    errors["water"] = _relative(sum(s.water for s in inputs) + water_in, sum(s.water for s in outputs))
    return errors


BREAKAGE_UNITS = frozenset({"crusher", "mill", "regrind", "circuit"})


def residual(matrix: np.ndarray, product: np.ndarray, feed: np.ndarray) -> float:
    """Relative residual of a breakage operator's steady state ``T^-1 p = m`` per class, against the feed's flow."""
    scale = float(np.sum(np.abs(feed)))
    return float(np.max(np.abs(matrix @ product - feed))) / scale if scale > 0.0 else 0.0


def audit(units: list[tuple[str, list[Stream], list[Stream], float]], ore: ResolvedOre,
          equations: dict[str, float] | None = None) -> dict[str, object]:
    """Every unit's closure (by class where no breakage acts) and the breakage operators' residuals (``equations``)."""
    report = {}
    worst = 0.0
    for name, inputs, outputs, water_in in units:
        errors = unit_closure(inputs, outputs, ore, water_in, by_class=name not in BREAKAGE_UNITS)
        report[name] = max(errors.values()) if errors else 0.0
        worst = max(worst, report[name])
    for name, error in (equations or {}).items():
        report[name] = float(error)
        worst = max(worst, report[name])
    return {"units": report, "max_relative_error": float(worst)}


def nonnegative(streams: dict[str, Stream], tolerance: float) -> list[str]:
    """Names of streams carrying a class mass below minus ``tolerance`` times that mineral's flow in the stream (K-10)."""
    bad = []
    for name, stream in streams.items():
        for mass in stream.solids.values():
            if np.any(mass < -tolerance * float(np.sum(np.abs(mass)))):
                bad.append(name)
                break
    return bad
