"""Energy report: crushing, grinding, Bond requirement, operating work index, comparison laws.

Bond: ``W = Wi (10/sqrt(P80) - 10/sqrt(F80))``, operating work index
``Wi_o = W / (10/sqrt(P80) - 10/sqrt(F80))`` (GMG01-MP-2021). Rittinger ``K_R (1/P - 1/F)`` and
Kick ``K_K ln(F/P)`` are calibrated so that both equal Bond at the declared reference reduction;
they are comparison laws and never enter the reported energy. docs/frameworks/energy.
"""
from __future__ import annotations

import math

import numpy as np

from .comminution import bond_energy, operating_work_index
from .constants import constant


def reference_constants(work_index: float) -> tuple[float, float]:
    f_ref = float(constant("bond.reference_feed_um"))
    p_ref = float(constant("bond.reference_product_um"))
    reference = bond_energy(work_index, f_ref, p_ref)
    k_rittinger = reference / (1.0 / p_ref - 1.0 / f_ref)
    k_kick = reference / math.log(f_ref / p_ref)
    return k_rittinger, k_kick


def rittinger(work_index: float, f80: float, p80: float) -> float:
    k, _ = reference_constants(work_index)
    return k * (1.0 / p80 - 1.0 / f80)


def kick(work_index: float, f80: float, p80: float) -> float:
    _, k = reference_constants(work_index)
    return k * math.log(f80 / p80)


def energy_report(work_index: float, crushing_work_index: float, crusher_feed_f80: float, crusher_p80: float,
                  grinding_energy: float, mill_f80: float, mill_p80: float) -> dict[str, float]:
    crushing = bond_energy(crushing_work_index, crusher_feed_f80, crusher_p80)
    wio = operating_work_index(grinding_energy, mill_f80, mill_p80)
    return {
        "specific_energy_crushing_kwh_t": float(crushing),
        "specific_energy_grinding_kwh_t": float(grinding_energy),
        "specific_energy_total_kwh_t": float(crushing + grinding_energy),
        "bond_energy_kwh_t": float(bond_energy(work_index, mill_f80, mill_p80)),
        "operating_work_index_kwh_t": float(wio),
        "bond_efficiency_ratio": float(work_index / wio),
        "energy_rittinger_kwh_t": float(rittinger(work_index, mill_f80, mill_p80)),
        "energy_kick_kwh_t": float(kick(work_index, mill_f80, mill_p80)),
    }


def law_curves(work_index: float, f80: float, p80_values: np.ndarray) -> dict[str, list[float]]:
    return {
        "p80_um": [float(p) for p in p80_values],
        "bond": [float(bond_energy(work_index, f80, p)) for p in p80_values],
        "rittinger": [float(rittinger(work_index, f80, p)) for p in p80_values],
        "kick": [float(kick(work_index, f80, p)) for p in p80_values],
    }
