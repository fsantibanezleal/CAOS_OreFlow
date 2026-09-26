"""Particle classes at a separation: liberated grains, binary composites and free gangue.

Mineral streams carry mass by mineral and size. A separation acts on particles, so the product of
breakage is split, size class by size class, into liberated valuable grains (fraction ``L`` of the
valuable mass), composite particles of the valuable with the host gangue at declared content
``c``, and the remaining free gangue. The split applies only to a product of breakage (mill
product, regrind product); separations carry particle classes forward unchanged. When a class holds
less host gangue than the default composites would lock (a concentrate after regrind), the
composites are limited by the host available, which liberates the balance of the valuable mineral.
The split is exact and reversible: ``to_minerals`` recovers the mineral masses.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .grid import grid
from .model import Flags
from .ore import ResolvedOre
from .streams import Stream


@dataclass(frozen=True)
class SpeciesDef:
    id: str
    mineral: str                      # the mineral whose response governs the class
    kind: str                         # "liberated", "composite" or "free"
    makeup: tuple[tuple[str, float], ...]   # (mineral, mass fraction) of the particle
    density: float


def species_defs(ore: ResolvedOre) -> list[SpeciesDef]:
    out: list[SpeciesDef] = []
    for m in ore.valuable:
        spec = ore.spec[m]
        out.append(SpeciesDef(f"{m}:liberated", m, "liberated", ((m, 1.0),), ore.density[m]))
        if spec.composite_content > 0.0:
            c = spec.composite_content
            out.append(SpeciesDef(f"{m}:composite", m, "composite", ((m, c), (ore.host, 1.0 - c)), ore.composite_density(m)))
    for m in ore.ids:
        if m not in ore.valuable:
            out.append(SpeciesDef(f"{m}:free", m, "free", ((m, 1.0),), ore.density[m]))
    return out


def to_species(stream: Stream, ore: ResolvedOre, defs: list[SpeciesDef], flags: Flags | None = None) -> dict[str, np.ndarray]:
    """Split a product of breakage into particle classes (host-limited composites)."""
    n = grid().n
    out = {d.id: np.zeros(n) for d in defs}
    host = stream.solids.get(ore.host, np.zeros(n))
    demand: dict[str, np.ndarray] = {}
    for m in ore.valuable:
        c = ore.spec[m].composite_content
        if c > 0.0:
            demand[m] = (1.0 - ore.liberation[m]) * stream.solids.get(m, np.zeros(n)) * (1.0 - c) / c
    total_demand = np.zeros(n)
    for value in demand.values():
        total_demand += value
    scale = np.ones(n)
    short = total_demand > host
    scale[short] = host[short] / total_demand[short]
    locked = np.zeros(n)
    for m in ore.valuable:
        mass = stream.solids.get(m, np.zeros(n))
        c = ore.spec[m].composite_content
        if m in demand:
            host_locked = demand[m] * scale
            composite = host_locked / (1.0 - c)
            out[f"{m}:composite"] = composite
            out[f"{m}:liberated"] = mass - c * composite
            locked += host_locked
        else:
            out[f"{m}:liberated"] = mass.copy()
    for m in ore.ids:
        if m in ore.valuable:
            continue
        mass = stream.solids.get(m, np.zeros(n))
        out[f"{m}:free"] = mass - locked if m == ore.host else mass.copy()
    return out


def partition_species(species: dict[str, np.ndarray], fractions: dict[str, np.ndarray]) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
    """Split particle classes by per-class fractions to the first product."""
    first = {k: fractions[k] * v for k, v in species.items()}
    second = {k: v - first[k] for k, v in species.items()}
    return first, second


def to_minerals(species: dict[str, np.ndarray], defs: list[SpeciesDef], ore: ResolvedOre) -> dict[str, np.ndarray]:
    n = grid().n
    out = {m: np.zeros(n) for m in ore.ids}
    for d in defs:
        for mineral, share in d.makeup:
            out[mineral] += share * species[d.id]
    return out


def species_content(d: SpeciesDef, ore: ResolvedOre, name: str) -> float:
    return sum(share * ore.content(m, name) for m, share in d.makeup)
