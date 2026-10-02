"""Published-example oracles computed by the engine and recorded beside the published values.

The published values and the authored inputs live in ``data/oracles.json`` with their sources. The
tests assert the tolerances and trends (PE-08, PE-09, PE-18, PE-19); the bake stores the same records
in the benchmark, so the page that shows them and the gate that checks them read one computation.
"""
from __future__ import annotations

import json
import math
from dataclasses import replace
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from ..cases.catalog import CASE_BY_ID, CASES
from ..engine.circuit import simulate
from ..engine.comminution import operating_work_index
from ..engine.constants import constant
from ..engine.cyclone import plitt_cut, plitt_pressure, size_cluster
from ..engine.grid import grid
from ..engine.grinding import GrindingCircuit
from ..engine.model import Carrier, Cyclone, Flags, Mill, MineralSpec, OperatingPoint, Ore, Payable, Plant
from ..engine.ore import resolve

INCH_CM = 2.54
PSI_KPA = 6.894757

DATA = Path(__file__).resolve().parent / "data" / "oracles.json"


@lru_cache(maxsize=1)
def oracle_data() -> dict[str, Any]:
    return json.loads(DATA.read_text(encoding="utf-8"))


def _relative(engine: float, published: float) -> float:
    return (engine - published) / published


def molycop_feed() -> np.ndarray:
    """The published BallSim_Direct fresh feed on the engine grid: the cumulative passing interpolated in log size,
    extended below the last sieve by the Gaudin-Schuhmann slope of the last two (authored)."""
    pub = oracle_data()["molycop"]["published"]
    g = grid()
    size = np.asarray(pub["size_um"], float)
    passing = np.asarray(pub["feed_passing_pct"], float) / 100.0
    slope = math.log(passing[-2] / passing[-1]) / math.log(size[-2] / size[-1])
    cum = np.array([1.0 if u >= size[0] else passing[-1] * (u / size[-1]) ** slope if u <= size[-1]
                    else float(np.interp(math.log(u), np.log(size[::-1]), passing[::-1])) for u in g.upper])
    mass = np.append(cum[:-1] - cum[1:], cum[-1])
    return mass / mass.sum()


def passing_at(mass: np.ndarray, sizes: list[float]) -> list[float]:
    """Cumulative percent passing of a class distribution at given sizes (log interpolation on the grid bounds)."""
    g = grid()
    upper, passing = np.log(g.upper[::-1]), g.passing(mass)[::-1]
    return [100.0 * float(np.interp(math.log(s), upper, passing)) for s in sizes]


def _pair(engine: float, published: float) -> dict[str, float]:
    return {"published": published, "engine": engine, "relative_error": _relative(engine, published)}


def _cyclone(state: dict[str, Any], underflow_solids: float) -> Cyclone:
    return Cyclone(sharpness=state["plitt_parameter"], underflow_solids=underflow_solids, diameter_cm=state["diameter_in"] * INCH_CM,
                   inlet_cm=state["inlet_in"] * INCH_CM, vortex_cm=state["vortex_in"] * INCH_CM, apex_cm=state["apex_in"] * INCH_CM,
                   free_vortex_height_cm=state["height_in"] * INCH_CM)


def _plitt_at(state: dict[str, Any], rho: float, underflow_solids: float) -> dict[str, Any]:
    """The engine's uncalibrated Plitt equations at a published classifier state (E-07): the cut and pressure at the
    published flow per cyclone, the cluster the engine sizes for the published cut, and the factors on the cut and
    pressure coefficients that would reproduce the state."""
    c = _cyclone(state, underflow_solids)
    solids = state["ore_t_h"] / rho
    water = state["water_m3_h"]
    cv = 100.0 * solids / (solids + water)
    flow = (solids + water) * float(constant("units.litres_per_m3")) / float(constant("time.minutes_per_hour")) / state["cyclones"]
    cut, pressure = plitt_cut(c, flow, cv, rho), plitt_pressure(c, flow, cv)
    sized = size_cluster(c, state["d50c_um"], solids, water, state["ore_t_h"], water * float(constant("water.density_t_m3")))
    published = {"cyclones": state["cyclones"], "pressure_kpa": state["pressure_psi"] * PSI_KPA, "d50c_um": state["d50c_um"]}
    return {"published": published, "feed_solids_vol_pct": cv,
            "plitt_at_published_flow": {"cut_um": cut, "pressure_kpa": pressure},
            "sized_for_published_cut": {"cyclones": sized.cyclones, "pressure_kpa": sized.pressure_kpa},
            "calibration": {"cut": state["d50c_um"] / cut, "pressure": published["pressure_kpa"] / pressure},
            "molycop_constants": state["constants"]}


def molycop() -> dict[str, Any]:
    """PE-08 and E-07: the Moly-Cop BallSim_Direct base case with every input it publishes and its own breakage
    parameters. P80 and circulating load are inputs the solver meets; the net specific energy, the corrected cut, the
    water bypass and the overflow size distribution are compared with the published ones. The Plitt sizing is compared
    with both published classifier states."""
    d = oracle_data()["molycop"]
    pub, par, aut = d["published"], d["parameters"], d["authored"]
    state = pub["classifiers"]["BallSim_Direct"]
    wi = aut["work_index_kwh_t"]
    ore = Ore(minerals=(MineralSpec(id="chalcopyrite"), MineralSpec(id="quartz")),
              payables=(Payable("Cu", "%", (Carrier("chalcopyrite", 1.0),), aut["head_grade_pct"]),),
              work_index_kwh_t=wi, crushing_work_index_kwh_t=wi)
    mill = Mill(installed_power_kw=math.inf, alpha0=par["alpha0"], alpha1=par["alpha1"], alpha2=par["alpha2"],
                critical_size_um=par["critical_size_um"], reference_work_index_kwh_t=wi, beta0=par["beta0"],
                beta1=par["beta1"], beta2=par["beta2"], discharge_solids=pub["discharge_solids"])
    # the crusher is not part of this oracle: the new feed is the published distribution directly
    plant = Plant(family="rougher", crusher=CASES[0].plant.crusher, mill=mill, cyclone=_cyclone(state, pub["underflow_solids"]))
    # the overflow water per tonne of new feed follows from the published overflow solids
    water = (1.0 - pub["overflow_solids"]) / pub["overflow_solids"]
    op = OperatingPoint(throughput_tph=pub["feed_tph"], target_p80_um=pub["p80_um"], circulating_load=pub["circulating_load"],
                        water_m3_t=water, crusher_css_mm=CASES[0].nominal.crusher_css_mm, work_index_kwh_t=wi,
                        head_grade=aut["head_grade_pct"])
    resolved = resolve(ore, op)
    shape = molycop_feed()
    feed = {m: pub["feed_tph"] * resolved.fraction[m] * shape for m in resolved.ids}
    result = GrindingCircuit(resolved, plant, op, feed, Flags()).solve()
    overflow = passing_at(sum(result.streams["cyclone_overflow"].solids.values()), pub["size_um"])
    net = result.specific_energy_kwh_t   # Herbst and Fuerstenau's selection function is normalised by net power
    comparison = {
        "net_specific_energy_kwh_t": _pair(net, pub["net_power_kw"] / pub["feed_tph"]),
        "gross_specific_energy_kwh_t": _pair(net / (1.0 - pub["power_losses"]), pub["gross_specific_energy_kwh_t"]),
        "cut_um": _pair(result.cut_um, state["d50c_um"]),
        "water_bypass": _pair(result.bypass, state["water_bypass"]),
        "overflow_passing_max_abs_difference_pct": max(abs(e - q) for e, q in zip(overflow, pub["overflow_passing_pct"])),
    }
    inputs = {"p80_um": _pair(result.p80_um, pub["p80_um"]), "circulating_load": _pair(result.circulating_load, pub["circulating_load"])}
    sizing = {k: _plitt_at(s, pub["ore_density_t_m3"], pub["underflow_solids"]) for k, s in pub["classifiers"].items()}
    a, b = sizing["BallSim_Direct"], sizing["BallParam_Direct"]
    ka, kb = a["molycop_constants"], b["molycop_constants"]
    ratio = {"engine_cut": b["calibration"]["cut"] / a["calibration"]["cut"], "engine_pressure": b["calibration"]["pressure"] / a["calibration"]["pressure"],
             "molycop_a2": kb["a2"] / ka["a2"], "molycop_a1": kb["a1"] / ka["a1"]}
    tolerance = d["tolerance"]
    return {"id": "molycop", "source": d["source"], "published": pub, "parameters": par, "authored": aut,
            "inputs": inputs, "engine": {"overflow_passing_pct": overflow}, "comparison": comparison,
            "tolerance": tolerance, "tolerance_basis": d["tolerance_basis"],
            "within_tolerance": (abs(comparison["net_specific_energy_kwh_t"]["relative_error"]) <= tolerance["net_specific_energy_kwh_t"]
                                 and all(abs(v["relative_error"]) <= 1e-6 for v in inputs.values())),
            "sizing": {"examples": sizing, "ratio": ratio}}


def gmg() -> dict[str, Any]:
    d = oracle_data()["gmg"]
    rows = []
    for example in d["examples"]:
        energy = example.get("specific_energy_kwh_t", example.get("power_kw", 0.0) / example.get("throughput_tph", 1.0))
        engine = operating_work_index(energy, example["f80_um"], example["p80_um"])
        rows.append({**example, "specific_energy_kwh_t": energy, "engine_operating_work_index_kwh_t": engine,
                     "error_kwh_t": engine - example["operating_work_index_kwh_t"]})
    return {"id": "gmg", "source": d["source"], "examples": rows, "tolerance_abs_kwh_t": d["tolerance_abs_kwh_t"],
            "within_tolerance": all(abs(r["error_kwh_t"]) <= d["tolerance_abs_kwh_t"] for r in rows)}


def laplante() -> dict[str, Any]:
    d = oracle_data()["laplante"]
    case = CASE_BY_ID["gold_free_milling"]
    recovery, gold_cl, ore_cl = [], [], []
    for bleed in d["published"]["bleed"]:
        m = simulate(case.ore, case.plant, case.nominal.with_values(gravity_bleed=bleed)).metrics
        recovery.append(m["gravity_recovery_pct"])
        gold_cl.append(m["gold_circulating_load_pct"])
        ore_cl.append(m["circulating_load_pct"])
    steps = [b - a for a, b in zip(recovery, recovery[1:])]
    return {"id": "laplante", "source": d["source"], "why": d["why"], "published": d["published"],
            "engine": {"bleed": d["published"]["bleed"], "gravity_recovery_pct": recovery, "gold_circulating_load_pct": gold_cl,
                       "ore_circulating_load_pct": ore_cl},
            "rising": all(s > 0.0 for s in steps), "diminishing": all(b <= a for a, b in zip(steps, steps[1:])),
            "gold_above_ore": all(g > o for g, o in zip(gold_cl, ore_cl))}


def zandrivierspoort() -> dict[str, Any]:
    d = oracle_data()["zandrivierspoort"]
    case = CASE_BY_ID["iron_magnetite_fine"]
    plant = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=math.inf))   # the published grinds
    grades, recoveries = [], []
    for p80 in d["published"]["grind_p80_um"]:
        m = simulate(case.ore, plant, case.nominal.with_values(target_p80_um=p80)).metrics
        grades.append(m["concentrate_grade"])
        recoveries.append(m["magnetite_recovery_pct"])
    published = d["published"]["concentrate_fe_pct"]
    return {"id": "zandrivierspoort", "source": d["source"], "why": d["why"], "published": d["published"],
            "engine": {"grind_p80_um": d["published"]["grind_p80_um"], "concentrate_fe_pct": grades,
                       "magnetite_recovery_pct": recoveries},
            "finer_grind_raises_grade": grades[1] > grades[0],
            "grade_difference_pct_points": {"engine": grades[1] - grades[0], "published": published[1] - published[0]}}


def all_oracles() -> dict[str, Any]:
    return {"molycop": molycop(), "gmg": gmg(), "laplante": laplante(), "zandrivierspoort": zandrivierspoort()}
