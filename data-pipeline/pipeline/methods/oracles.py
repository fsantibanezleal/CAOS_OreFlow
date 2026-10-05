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
from ..engine.comminution import crush
from ..engine.model import Carrier, Cyclone, Flags, GrainSize, GravityPlant, Mill, MineralSpec, OperatingPoint, Ore, Payable, Plant
from ..engine.ore import resolve


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
    inch_cm = float(constant("units.cm_per_inch"))
    return Cyclone(sharpness=state["plitt_parameter"], underflow_solids=underflow_solids, diameter_cm=state["diameter_in"] * inch_cm,
                   inlet_cm=state["inlet_in"] * inch_cm, vortex_cm=state["vortex_in"] * inch_cm, apex_cm=state["apex_in"] * inch_cm,
                   free_vortex_height_cm=state["height_in"] * inch_cm)


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
    published = {"cyclones": state["cyclones"], "pressure_kpa": state["pressure_psi"] * float(constant("units.kpa_per_psi")), "d50c_um": state["d50c_um"]}
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
                                 and all(abs(v["relative_error"]) <= float(constant("oracles.input_match_relative")) for v in inputs.values())),
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


_FIT_STEPS = 30   # bisection steps on the unit's maximum recovery: 2^-30 of its bracket


def grg_grains(record: dict[str, Any]) -> GrainSize:
    """A GRG vector given as percent of the gold per class (coarsest first, the last class below the last sieve) as the
    engine's grain distribution."""
    classes = record["class_pct_of_gold"]
    if classes[0] != 0.0:
        raise ValueError("GRG retained on the top sieve has no upper size")
    total = left = float(sum(classes))
    passing = []
    for share in classes[:-1]:
        left -= share          # what passes sieve i is every class finer than it
        passing.append(left / total)
    return GrainSize(tuple(record["size_um"]), tuple(passing), record["lower_um"])


def _laplante_run(pub: dict[str, Any], grains: GrainSize, bleed: float, max_recovery: float, scale_um: float) -> dict[str, float]:
    """The published example's grinding circuit with the gravity unit on a share of the mill discharge (E-11)."""
    case = CASE_BY_ID["gold_free_milling"]
    share = pub["grg_share_of_gold"]
    fractions = oracle_data()["laplante"]["authored"]["ore_fractions"]
    ore = Ore(minerals=(MineralSpec(id="electrum", gravity=True, grains=grains), MineralSpec(id="pyrite", fraction=fractions["pyrite"]),
                        MineralSpec(id="silicate_fe", fraction=fractions["silicate_fe"]), MineralSpec(id="quartz")),
              payables=(Payable("Au", "g/t", (Carrier("electrum", share), Carrier("pyrite", 1.0 - share, "trace")), pub["head_grade_gpt"]),),
              work_index_kwh_t=case.ore.work_index_kwh_t, crushing_work_index_kwh_t=case.ore.crushing_work_index_kwh_t)
    plant = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=math.inf),
                    cyclone=replace(case.plant.cyclone, underflow_solids=pub["underflow_solids"]),
                    gravity=GravityPlant(max_recovery=max_recovery, size_scale_um=scale_um, composite_recovery=case.plant.gravity.composite_recovery,
                                         gangue_yield=case.plant.gravity.gangue_yield, position=pub["bleed_stream"]))
    op = case.nominal.with_values(throughput_tph=pub["feed_tph"], target_p80_um=pub["p80_um"], circulating_load=pub["circulating_load"],
                                  water_m3_t=(1.0 - pub["overflow_solids"]) / pub["overflow_solids"], head_grade=pub["head_grade_gpt"],
                                  gravity_bleed=bleed)
    resolved = resolve(ore, op)
    g = grid()
    rock = g.rosin_rammler(plant.crusher.feed_f80_um, plant.crusher.feed_slope)
    grain = g.from_passing(grains.size_um, grains.passing, grains.lower_um)
    css = op.crusher_css_mm * float(constant("units.um_per_mm"))
    feed = {m: pub["feed_tph"] * resolved.fraction[m] * grain if m == "electrum"
            else crush(pub["feed_tph"] * resolved.fraction[m] * rock, css, plant.crusher) for m in resolved.ids}
    s = GrindingCircuit(resolved, plant, op, feed, Flags()).solve().streams
    grg_feed = s["new_feed"].mineral_tph("electrum")
    au = lambda name: s[name].species_tph("Au", resolved.composition)  # noqa: E731
    discharge = s["mill_discharge"].solids["electrum"]
    out = {"grg_circulating_load_pct": 100.0 * s["cyclone_underflow"].mineral_tph("electrum") / grg_feed,
           "grg_to_overflow_pct": 100.0 * s["cyclone_overflow"].mineral_tph("electrum") / grg_feed,
           "discharge_grg_below_150um_pct": passing_at(discharge, [pub["discharge_size_um"]])[0],
           "ore_circulating_load_pct": 100.0 * s["cyclone_underflow"].tph() / pub["feed_tph"]}
    if "gravity_concentrate" in s:
        out["grg_recovery_pct"] = 100.0 * s["gravity_concentrate"].mineral_tph("electrum") / grg_feed
        out["gold_recovery_pct"] = 100.0 * au("gravity_concentrate") / au("new_feed")
    else:
        under, over = s["cyclone_underflow"], s["cyclone_overflow"]
        out["underflow_over_overflow_au_grade"] = under.grade("Au", resolved.composition) / over.grade("Au", resolved.composition)
        out["underflow_grg_share"] = under.mineral_tph("electrum") * resolved.composition["electrum"]["Au"] / au("cyclone_underflow")
        out["overflow_grg_share"] = over.mineral_tph("electrum") * resolved.composition["electrum"]["Au"] / au("cyclone_overflow")
    return out


def _fit_max_recovery(pub: dict[str, Any], grains: GrainSize, fit: dict[str, Any], scale_um: float) -> tuple[float, bool]:
    """The unit's maximum recovery that meets the printed GRG recovery at the fit row, by bisection; at a bound when
    the target lies beyond it, on either side (until 0.09.000 only the upper bound was checked, so a target below the
    lower bound's recovery was reported as an interior fit, review of 2026-10-04, M-12)."""
    row = pub["bleed"].index(fit["row"])
    target = pub["grg_recovery_pct"][row]
    lo, hi = (float(v) for v in fit["bounds"])
    if _laplante_run(pub, grains, fit["row"], hi, scale_um)["grg_recovery_pct"] < target:
        return hi, True
    if _laplante_run(pub, grains, fit["row"], lo, scale_um)["grg_recovery_pct"] >= target:
        return lo, True
    for _ in range(_FIT_STEPS):
        mid = 0.5 * (lo + hi)
        if _laplante_run(pub, grains, fit["row"], mid, scale_um)["grg_recovery_pct"] < target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi), False


def laplante() -> dict[str, Any]:
    """E-11: the published simulator example run like for like. The engine takes the printed inputs, an ore of 80.4%
    GRG with Snip's measured GRG by size, and the unit on a share of the mill discharge; the unit's maximum recovery
    is fitted at the 30% row; the GRG recovery and GRG circulating load at every bleed are compared within the
    tolerances set before the first run. A diagnosis reruns it without the GRG finer than 25 um."""
    d = oracle_data()["laplante"]
    pub, fit, tol = d["published"], d["fit"], d["tolerance"]
    scale = d["authored"]["unit_size_scale_um"]

    def series(grains: GrainSize) -> dict[str, Any]:
        r_max, at_bound = _fit_max_recovery(pub, grains, fit, scale)
        rows = [_laplante_run(pub, grains, b, r_max, scale) for b in pub["bleed"]]
        out: dict[str, Any] = {"max_recovery": r_max, "fit_at_bound": at_bound}
        for key in ("grg_recovery_pct", "gold_recovery_pct", "grg_circulating_load_pct", "grg_to_overflow_pct",
                    "discharge_grg_below_150um_pct", "ore_circulating_load_pct"):
            out[key] = [row[key] for row in rows]
        out["grg_recovery_difference_points"] = [e - q for e, q in zip(out["grg_recovery_pct"], pub["grg_recovery_pct"])]
        out["grg_circulating_load_relative_error"] = [_relative(e, q) for e, q in zip(out["grg_circulating_load_pct"], pub["grg_circulating_load_pct"])]
        out["within_tolerance"] = (all(abs(x) <= tol["grg_recovery_points"] for x in out["grg_recovery_difference_points"])
                                   and all(abs(x) <= tol["grg_circulating_load_relative"] for x in out["grg_circulating_load_relative_error"]))
        return out

    grains = grg_grains(d["grg"])
    engine = series(grains)
    coarse = dict(d["grg"])
    coarse["class_pct_of_gold"] = d["grg"]["class_pct_of_gold"][:-1] + [0.0]
    without_fines = series(grg_grains(coarse))
    audit = _laplante_run(pub, grains, 0.0, engine["max_recovery"], scale)
    recovery = engine["grg_recovery_pct"]
    steps = [b - a for a, b in zip(recovery, recovery[1:])]
    return {"id": "laplante", "source": d["source"], "why": d["why"], "published": pub, "grg": d["grg"], "fit": fit,
            "tolerance": tol, "tolerance_basis": d["tolerance_basis"], "engine": {"bleed": pub["bleed"], **engine},
            "without_grg_below_25um": without_fines, "audit": audit,
            "within_tolerance": engine["within_tolerance"],
            "rising": all(s > 0.0 for s in steps), "diminishing": all(b <= a for a, b in zip(steps, steps[1:])),
            # without gravity the GRG circulates far above the ore, as every audited plant shows
            "grg_above_ore_without_gravity": audit["grg_circulating_load_pct"] > audit["ore_circulating_load_pct"]}


def zandrivierspoort() -> dict[str, Any]:
    """E-10: the magnetite case at the published grinds, with installed power unlimited. The grade step is the trend
    compared; the levels, the gap, the silica and the rougher stage at 75 um are recorded beside it."""
    d = oracle_data()["zandrivierspoort"]
    pub = d["published"]
    case = CASE_BY_ID["iron_magnetite_fine"]
    plant = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=math.inf))   # the published grinds
    grades, silica, recoveries, rougher = [], [], [], None
    for p80 in pub["grind_p80_um"]:
        result = simulate(case.ore, plant, case.nominal.with_values(target_p80_um=p80))
        m = result.metrics
        grades.append(m["concentrate_grade"])
        silica.append(m["concentrate_SiO2"])
        recoveries.append(m["magnetite_recovery_pct"])
        if rougher is None:   # the rougher stage at the first (75 um) grind only, as published
            s = result.streams
            comp = simulate_compositions(case)
            rougher = {"magnetite_recovery_pct": 100.0 * s["lims_rougher_concentrate"].mineral_tph("magnetite") / s["lims_feed"].mineral_tph("magnetite"),
                       "concentrate_fe_pct": 100.0 * s["lims_rougher_concentrate"].grade("Fe", comp),
                       "concentrate_silica_pct": 100.0 * s["lims_rougher_concentrate"].grade("SiO2", comp)}
    published = pub["concentrate_fe_pct"]
    return {"id": "zandrivierspoort", "source": d["source"], "why": d["why"], "published": pub,
            "engine": {"grind_p80_um": pub["grind_p80_um"], "concentrate_fe_pct": grades, "concentrate_silica_pct": silica,
                       "magnetite_recovery_pct": recoveries, "rougher_75": rougher},
            "gap_fe_pct_points": [e - q for e, q in zip(grades, published)],
            "finer_grind_raises_grade": grades[1] > grades[0],
            "grade_difference_pct_points": {"engine": grades[1] - grades[0], "published": published[1] - published[0]}}


def simulate_compositions(case: Any) -> dict[str, dict[str, float]]:
    """The resolved mineral compositions of a case, for assaying its streams."""
    return resolve(case.ore, case.nominal).composition


def all_oracles() -> dict[str, Any]:
    return {"molycop": molycop(), "gmg": gmg(), "laplante": laplante(), "zandrivierspoort": zandrivierspoort()}
