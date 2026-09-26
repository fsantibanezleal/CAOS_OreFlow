"""Low-intensity magnetic separation and desliming.

LIMS: liberated magnetite is captured with ``p_max (1 - exp(-d/d_f))``; composites with a capture
that rises with their magnetite content, ``p_max (1 - exp(-c/c0)) (1 - exp(-d/d_f))``; free gangue
reports by entrapment ``e0 + e1 exp(-d/d_e)``, scaled down in the cleaner drum. Concentrate Fe
grade therefore follows liberation, and so the grind (Muthaphuli 2014, JSAIMM 114(7)).
Desliming: a cyclone at a fine cut sends slimes to tailings with a water bypass to the underflow.
Sources: docs/frameworks/magnetic-separation and docs/frameworks/desliming.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .cyclone import corrected_cut, reduced_partition
from .grid import grid
from .model import DeslimePlant, MagneticPlant
from .ore import ResolvedOre
from .species import SpeciesDef, partition_species, species_defs, to_minerals
from .streams import Stream


def lims_capture(defs: list[SpeciesDef], ore: ResolvedOre, mp: MagneticPlant, entrapment_factor: float) -> dict[str, np.ndarray]:
    size = grid().size
    fine = 1.0 - np.exp(-size / mp.fine_scale_um)
    entrapment = entrapment_factor * (mp.entrapment_base + mp.entrapment_fines * np.exp(-size / mp.entrapment_scale_um))
    out: dict[str, np.ndarray] = {}
    for d in defs:
        magnetic = ore.spec[d.mineral].magnetic
        if magnetic and d.kind == "liberated":
            out[d.id] = mp.max_capture * fine
        elif magnetic and d.kind == "composite":
            c = ore.spec[d.mineral].composite_content
            out[d.id] = mp.max_capture * (1.0 - math.exp(-c / mp.composite_threshold)) * fine
        else:
            out[d.id] = entrapment
    return out


@dataclass
class MagneticResult:
    streams: dict[str, Stream]
    capture_rougher: dict[str, np.ndarray]
    capture_cleaner: dict[str, np.ndarray]
    defs: list[SpeciesDef]


def _split_water(mags_solids: float, feed_water: float, solids_fraction: float) -> float:
    return min(feed_water, mags_solids * (1.0 - solids_fraction) / solids_fraction)


def run_magnetic(x: dict[str, np.ndarray], feed_water: float, ore: ResolvedOre, mp: MagneticPlant) -> MagneticResult:
    defs = species_defs(ore)
    cap_r = lims_capture(defs, ore, mp, 1.0)
    cap_c = lims_capture(defs, ore, mp, mp.cleaner_factor)
    mags_r = {k: cap_r[k] * x[k] for k in x}
    tail_r = {k: x[k] - mags_r[k] for k in x}
    water_mags_r = _split_water(sum(float(np.sum(v)) for v in mags_r.values()), feed_water, mp.concentrate_solids)
    mags_c = {k: cap_c[k] * mags_r[k] for k in x}
    tail_c = {k: mags_r[k] - mags_c[k] for k in x}
    water_mags_c = _split_water(sum(float(np.sum(v)) for v in mags_c.values()), water_mags_r, mp.concentrate_solids)

    def stream(species: dict[str, np.ndarray], water: float) -> Stream:
        return Stream(to_minerals(species, defs, ore), water)

    return MagneticResult({
        "lims_feed": stream(x, feed_water),
        "lims_rougher_concentrate": stream(mags_r, water_mags_r),
        "lims_rougher_tail": stream(tail_r, feed_water - water_mags_r),
        "lims_cleaner_concentrate": stream(mags_c, water_mags_c),
        "lims_cleaner_tail": stream(tail_c, water_mags_r - water_mags_c),
    }, cap_r, cap_c, defs)


@dataclass
class DeslimeResult:
    underflow: Stream
    slimes: Stream
    partition: dict[str, np.ndarray]
    underflow_species: dict[str, np.ndarray]
    underflow_water: float


def run_deslime(x: dict[str, np.ndarray], feed_water: float, ore: ResolvedOre, dp: DeslimePlant, cut_um: float) -> DeslimeResult:
    defs = species_defs(ore)
    rho_ref = ore.density[ore.host]
    partition: dict[str, np.ndarray] = {}
    for d in defs:
        partition[d.id] = dp.bypass + (1.0 - dp.bypass) * reduced_partition(corrected_cut(cut_um, rho_ref, d.density), dp.sharpness)
    under, over = partition_species(x, partition)
    water_under = dp.bypass * feed_water
    return DeslimeResult(Stream(to_minerals(under, defs, ore), water_under),
                         Stream(to_minerals(over, defs, ore), feed_water - water_under), partition, under, water_under)
