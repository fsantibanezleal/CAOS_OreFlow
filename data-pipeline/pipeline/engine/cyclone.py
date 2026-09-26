"""Hydrocyclone partition and Plitt cluster sizing.

Partition to underflow per particle class (Plitt, Rosin-Rammler form):
``y = Rf + (1 - Rf)(1 - exp(-ln 2 (d/d50c)^m))`` with the cut corrected for particle density,
``d50c_k = d50c sqrt((rho_ref - 1)/(rho_k - 1))`` (from Plitt's (rho_s - rho_l)^-0.5 dependence).
Plitt (1976) CIM Bull. 69(776):114-123, equations as documented in SysCAD.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .constants import constant
from .grid import grid
from .model import Cyclone


def corrected_cut(d50_ref: float, rho_ref: float, rho: float) -> float:
    water = float(constant("water.density_t_m3"))
    return d50_ref * math.sqrt((rho_ref - water) / (rho - water))


def reduced_partition(d50: float, sharpness: float) -> np.ndarray:
    """Corrected (bypass-free) fraction of each class reporting to underflow."""
    size = grid().size
    return 1.0 - np.exp(-math.log(2.0) * np.power(size / d50, sharpness))


@dataclass
class PlittSizing:
    cyclones: int
    flow_l_min: float
    d50c_um: float
    required_d50c_um: float
    pressure_kpa: float
    volume_split: float
    sharpness: float
    feed_solids_vol_pct: float
    in_pressure_window: bool


def _k(name: str) -> float:
    return float(constant(f"plitt.{name}"))


def plitt_cut(c: Cyclone, flow_l_min: float, cv_pct: float, rho_s: float) -> float:
    water = float(constant("water.density_t_m3"))
    numerator = (_k("d50_coefficient") * c.diameter_cm ** _k("d50_exp_dc") * c.inlet_cm ** _k("d50_exp_di")
                 * c.vortex_cm ** _k("d50_exp_do") * math.exp(_k("d50_cv_coefficient") * cv_pct))
    denominator = (c.apex_cm ** _k("d50_exp_du") * c.free_vortex_height_cm ** _k("d50_exp_h")
                   * flow_l_min ** _k("d50_exp_q") * (rho_s - water) ** _k("d50_exp_density"))
    return numerator / denominator


def plitt_flow_for_cut(c: Cyclone, d50_um: float, cv_pct: float, rho_s: float) -> float:
    """Flow per cyclone (L/min) at which Plitt's equation gives the requested cut."""
    reference = plitt_cut(c, 1.0, cv_pct, rho_s)
    return (reference / d50_um) ** (1.0 / _k("d50_exp_q"))


def plitt_pressure(c: Cyclone, flow_l_min: float, cv_pct: float) -> float:
    return (_k("pressure_coefficient") * flow_l_min ** _k("pressure_exp_q") * math.exp(_k("pressure_cv_coefficient") * cv_pct)
            / (c.diameter_cm ** _k("pressure_exp_dc") * c.inlet_cm ** _k("pressure_exp_di")
               * c.free_vortex_height_cm ** _k("pressure_exp_h")
               * (c.apex_cm ** 2 + c.vortex_cm ** 2) ** _k("pressure_exp_area")))


def plitt_split(c: Cyclone, head_m: float, cv_pct: float) -> float:
    s = (_k("split_coefficient") * (c.apex_cm / c.vortex_cm) ** _k("split_exp_ratio")
         * c.free_vortex_height_cm ** _k("split_exp_h") * (c.apex_cm ** 2 + c.vortex_cm ** 2) ** _k("split_exp_area")
         * math.exp(_k("split_cv_coefficient") * cv_pct)) / (head_m ** _k("split_exp_head") * c.diameter_cm ** _k("split_exp_dc"))
    return s / (1.0 + s)


def plitt_sharpness(c: Cyclone, flow_l_min: float, volume_split: float) -> float:
    return (_k("sharpness_coefficient") * math.exp(-_k("sharpness_rv_coefficient") * volume_split)
            * (c.diameter_cm ** 2 * c.free_vortex_height_cm / flow_l_min) ** _k("sharpness_exp"))


def size_cluster(c: Cyclone, required_d50_um: float, solids_m3_h: float, water_m3_h: float,
                 solids_t_h: float, water_t_h: float) -> PlittSizing:
    """Number of cyclones and operating point that deliver the required cut (Plitt)."""
    litres = float(constant("units.litres_per_m3"))
    minutes = float(constant("time.minutes_per_hour"))
    volume = solids_m3_h + water_m3_h
    cv_pct = 100.0 * solids_m3_h / volume
    rho_s = solids_t_h / solids_m3_h
    total_l_min = volume * litres / minutes
    per_cyclone = plitt_flow_for_cut(c, required_d50_um, cv_pct, rho_s)
    count = max(1, int(round(total_l_min / per_cyclone)))
    flow = total_l_min / count
    pressure = plitt_pressure(c, flow, cv_pct)
    rho_feed = (solids_t_h + water_t_h) / volume
    head = pressure / (float(constant("gravity.acceleration_m_s2")) * rho_feed)
    split = plitt_split(c, head, cv_pct)
    lo, hi = (float(v) for v in constant("plitt.pressure_window_kpa"))
    return PlittSizing(count, flow, plitt_cut(c, flow, cv_pct, rho_s), required_d50_um, pressure, split,
                       plitt_sharpness(c, flow, split), cv_pct, lo <= pressure <= hi)
