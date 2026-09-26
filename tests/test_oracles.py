"""Published-example oracles: Moly-Cop base case (PE-08), Laplante gravity trend (PE-18),
Zandrivierspoort grind-grade trend (PE-19). Each is a published example, not plant data."""
from __future__ import annotations

import pytest

from engine_helpers import run_point
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.model import (Carrier, Crusher, Cyclone, Flags, Mill, MineralSpec, OperatingPoint, Ore, Payable,
                                   Plant)
from pipeline.engine.grid import grid
from pipeline.engine.grinding import GrindingCircuit
from pipeline.engine.ore import resolve


def test_molycop_base_case():
    # BallSim_Direct base case: 504 t/h, F80 6913 um, P80 169.4 um, CL 277%, gross 8.56 kWh/t,
    # BallParam_Direct defaults alpha0 0.0091, alpha1 0.651, alpha2 2.5, dcrit 6514 um, beta 0.2/0.249/4.02.
    ore = Ore(minerals=(MineralSpec(id="chalcopyrite"), MineralSpec(id="quartz")),
              payables=(Payable("Cu", "%", (Carrier("chalcopyrite", 1.0),), 0.5),),
              work_index_kwh_t=12.0, crushing_work_index_kwh_t=12.0)
    mill = Mill(installed_power_kw=1e9, alpha0=0.0091, alpha1=0.651, alpha2=2.5, critical_size_um=6514.0,
                reference_work_index_kwh_t=12.0, beta0=0.2, beta1=0.249, beta2=4.02, discharge_solids=0.72)
    cyclone = Cyclone(sharpness=1.66, underflow_solids=0.75, diameter_cm=66.0, inlet_cm=19.0, vortex_cm=24.0,
                      apex_cm=14.0, free_vortex_height_cm=200.0)
    plant = Plant(family="rougher", crusher=Crusher(60000.0, 0.9, 0.8, 2.3, 2.3, 0.4, 0.7, 3.5), mill=mill, cyclone=cyclone)
    op = OperatingPoint(throughput_tph=504.0, target_p80_um=169.4, circulating_load=2.77, water_m3_t=1.857,
                        crusher_css_mm=8.0, work_index_kwh_t=12.0, head_grade=0.5)
    resolved = resolve(ore, op)
    feed = {m: 504.0 * resolved.fraction[m] * grid().rosin_rammler(6913.0, 0.9) for m in resolved.ids}
    result = GrindingCircuit(resolved, plant, op, feed, Flags()).solve()
    assert result.p80_um == pytest.approx(169.4, rel=0.005)
    assert result.circulating_load == pytest.approx(2.77, rel=0.005)
    assert result.specific_energy_kwh_t == pytest.approx(8.56, rel=0.20)


def test_laplante_trend():
    # Laplante and Staunton simulator example: gravity gold recovery rises with the fraction of
    # underflow treated, with diminishing returns, and gold circulating load far exceeds the ore's.
    case = CASE_BY_ID["gold_free_milling"]
    points = [run_point(case.id, case.nominal.with_values(gravity_bleed=b)).metrics for b in (0.1, 0.3, 0.6)]
    assert points[0]["gravity_recovery_pct"] < points[1]["gravity_recovery_pct"] < points[2]["gravity_recovery_pct"]
    assert (points[1]["gravity_recovery_pct"] - points[0]["gravity_recovery_pct"]) / 0.2 > \
           (points[2]["gravity_recovery_pct"] - points[1]["gravity_recovery_pct"]) / 0.3
    assert points[0]["gold_circulating_load_pct"] > points[2]["gold_circulating_load_pct"] > points[2]["circulating_load_pct"]


def test_zandrivierspoort_trend():
    # Muthaphuli (2014): a finer grind raises LIMS concentrate Fe grade (64.9% at 80% -75 um,
    # 69.0% at 80% -45 um) while magnetite recovery stays above 98% in the rougher.
    case = CASE_BY_ID["iron_magnetite_fine"]
    coarse = run_point(case.id, case.nominal.with_values(target_p80_um=75.0), unlimited_power=True).metrics
    fine = run_point(case.id, case.nominal.with_values(target_p80_um=45.0), unlimited_power=True).metrics
    assert fine["concentrate_grade"] - coarse["concentrate_grade"] > 1.5
    assert 62.0 < coarse["concentrate_grade"] < 67.0 and 66.0 < fine["concentrate_grade"] < 71.0
