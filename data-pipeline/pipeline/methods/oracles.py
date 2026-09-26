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

from ..cases.catalog import CASE_BY_ID, CASES
from ..engine.circuit import simulate
from ..engine.comminution import operating_work_index
from ..engine.grid import grid
from ..engine.grinding import GrindingCircuit
from ..engine.model import Carrier, Cyclone, Flags, Mill, MineralSpec, OperatingPoint, Ore, Payable, Plant
from ..engine.ore import resolve

DATA = Path(__file__).resolve().parent / "data" / "oracles.json"


@lru_cache(maxsize=1)
def oracle_data() -> dict[str, Any]:
    return json.loads(DATA.read_text(encoding="utf-8"))


def _relative(engine: float, published: float) -> float:
    return (engine - published) / published


def molycop() -> dict[str, Any]:
    d = oracle_data()["molycop"]
    pub, par, aut = d["published"], d["parameters"], d["authored"]
    wi = aut["work_index_kwh_t"]
    ore = Ore(minerals=(MineralSpec(id="chalcopyrite"), MineralSpec(id="quartz")),
              payables=(Payable("Cu", "%", (Carrier("chalcopyrite", 1.0),), aut["head_grade_pct"]),),
              work_index_kwh_t=wi, crushing_work_index_kwh_t=wi)
    mill = Mill(installed_power_kw=math.inf, alpha0=par["alpha0"], alpha1=par["alpha1"], alpha2=par["alpha2"],
                critical_size_um=par["critical_size_um"], reference_work_index_kwh_t=wi, beta0=par["beta0"],
                beta1=par["beta1"], beta2=par["beta2"], discharge_solids=pub["discharge_solids"])
    cyclone = Cyclone(sharpness=aut["cyclone_sharpness"], underflow_solids=aut["underflow_solids"],
                      diameter_cm=pub["cyclone_diameter_cm"], inlet_cm=aut["inlet_cm"], vortex_cm=aut["vortex_cm"],
                      apex_cm=aut["apex_cm"], free_vortex_height_cm=aut["free_vortex_height_cm"])
    # the crusher is not part of this oracle: the new feed is the published F80 directly
    plant = Plant(family="rougher", crusher=CASES[0].plant.crusher, mill=mill, cyclone=cyclone)
    op = OperatingPoint(throughput_tph=pub["feed_tph"], target_p80_um=pub["p80_um"], circulating_load=pub["circulating_load"],
                        water_m3_t=aut["overflow_water_m3_t"], crusher_css_mm=CASES[0].nominal.crusher_css_mm,
                        work_index_kwh_t=wi, head_grade=aut["head_grade_pct"])
    resolved = resolve(ore, op)
    shape = grid().rosin_rammler(pub["feed_f80_um"], aut["feed_slope"])
    feed = {m: pub["feed_tph"] * resolved.fraction[m] * shape for m in resolved.ids}
    result = GrindingCircuit(resolved, plant, op, feed, Flags()).solve()
    engine = {"p80_um": result.p80_um, "circulating_load": result.circulating_load,
              "gross_specific_energy_kwh_t": result.specific_energy_kwh_t}
    return {"id": "molycop", "source": d["source"], "published": pub, "parameters": par, "authored": aut, "engine": engine,
            "relative_error": {k: _relative(engine[k], pub[k]) for k in engine}, "tolerance": d["tolerance"],
            "within_tolerance": all(abs(_relative(engine[k], pub[k])) <= d["tolerance"][k] for k in engine)}


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
