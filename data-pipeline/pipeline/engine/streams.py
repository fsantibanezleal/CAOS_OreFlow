"""Streams: dry mass flow by mineral and size class, plus water."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .grid import grid


@dataclass
class Stream:
    """Mass flow in t/h: ``solids[mineral]`` is a vector over the size grid; ``water`` in t/h."""

    solids: dict[str, np.ndarray] = field(default_factory=dict)
    water: float = 0.0

    def copy(self) -> "Stream":
        return Stream({k: v.copy() for k, v in self.solids.items()}, float(self.water))

    def total(self) -> np.ndarray:
        out = np.zeros(grid().n)
        for mass in self.solids.values():
            out += mass
        return out

    def tph(self) -> float:
        return float(sum(float(np.sum(m)) for m in self.solids.values()))

    def mineral_tph(self, mineral: str) -> float:
        return float(np.sum(self.solids.get(mineral, 0.0)))

    def species_tph(self, species: str, compositions: dict[str, dict[str, float]]) -> float:
        """Mass flow of an element or oxide species, given each mineral's content of it."""
        return float(sum(compositions[m].get(species, 0.0) * float(np.sum(mass)) for m, mass in self.solids.items()))

    def grade(self, species: str, compositions: dict[str, dict[str, float]]) -> float:
        """Mass fraction of a species in the solids (0 when the stream is empty)."""
        solids = self.tph()
        return self.species_tph(species, compositions) / solids if solids > 0.0 else 0.0

    def pct_solids(self) -> float:
        solids = self.tph()
        total = solids + self.water
        return solids / total if total > 0.0 else 0.0

    def p80(self) -> float:
        return grid().p80(self.total())

    def volume_m3_h(self, densities: dict[str, float], water_density: float) -> tuple[float, float]:
        """Solids and water volumetric flows in m3/h."""
        solids = sum(float(np.sum(mass)) / densities[m] for m, mass in self.solids.items())
        return solids, self.water / water_density


def add(*streams: Stream) -> Stream:
    out = Stream({}, 0.0)
    for stream in streams:
        for mineral, mass in stream.solids.items():
            out.solids[mineral] = out.solids.get(mineral, np.zeros(grid().n)) + mass
        out.water += stream.water
    return out
