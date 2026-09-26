"""PE-21 to PE-25: every physical claim the product makes is a test."""
from __future__ import annotations

import numpy as np
import pytest

from engine_helpers import flotation_cases, run_point, run_variant
from pipeline.cases.catalog import CASE_BY_ID

NO_SLIMES_REJECTION = [c for c in flotation_cases() if CASE_BY_ID[c].plant.family != "deslime_rougher"]
WITH_AIR_VARIANT = [c for c in NO_SLIMES_REJECTION if any(v["id"] == "more_air" for v in CASE_BY_ID[c].variants)]


@pytest.mark.parametrize("case_id", flotation_cases())
def test_collector_trades_grade_for_recovery(case_id):
    case = CASE_BY_ID[case_id]
    doses = [case.nominal.collector_gpt * f for f in (1.0, 1.6, 3.0)]
    metrics = [run_point(case_id, case.nominal.with_values(collector_gpt=d)).metrics for d in doses]
    recoveries = [m["recovery_pct"] for m in metrics]
    grades = [m["concentrate_grade"] for m in metrics]
    assert recoveries[0] <= recoveries[1] + 1e-9 <= recoveries[2] + 2e-9
    assert grades[2] < grades[0]


@pytest.mark.parametrize("case_id", NO_SLIMES_REJECTION + ["iron_magnetite_fine"])
def test_hardness_effects(case_id):
    case = CASE_BY_ID[case_id]
    harder = case.nominal.with_values(work_index_kwh_t=case.nominal.work_index_kwh_t * 1.25)
    free = run_point(case_id, case.nominal, unlimited_power=True).metrics
    free_hard = run_point(case_id, harder, unlimited_power=True).metrics
    assert free_hard["specific_energy_grinding_kwh_t"] > free["specific_energy_grinding_kwh_t"]
    nominal = run_variant(case_id, "nominal").metrics
    limited = run_variant(case_id, "harder_ore").metrics
    assert limited["power_limited"] == 1.0
    assert limited["p80_um"] > nominal["p80_um"]
    if case_id != "iron_magnetite_fine":
        assert limited["recovery_pct"] <= nominal["recovery_pct"] + 1e-9


def test_desliming_coarser_product_reduces_slimes_loss():
    case = CASE_BY_ID["phosphate_clay"]
    fine = run_point(case.id, case.nominal.with_values(target_p80_um=120.0), unlimited_power=True).metrics
    coarse = run_point(case.id, case.nominal.with_values(target_p80_um=200.0), unlimited_power=True).metrics
    assert coarse["slimes_loss_pct"] < fine["slimes_loss_pct"]


@pytest.mark.parametrize("case_id", NO_SLIMES_REJECTION)
def test_throughput_effects(case_id):
    nominal = run_variant(case_id, "nominal").metrics
    higher = run_variant(case_id, "higher_throughput").metrics
    assert higher["rougher_residence_min"] < nominal["rougher_residence_min"]
    assert higher["recovery_pct"] <= nominal["recovery_pct"] + 1e-9


@pytest.mark.parametrize("case_id", WITH_AIR_VARIANT)
def test_aeration_raises_entrainment(case_id):
    nominal = run_variant(case_id, "nominal")
    more_air = run_variant(case_id, "more_air")
    assert more_air.metrics["rougher_water_recovery_pct"] > nominal.metrics["rougher_water_recovery_pct"]

    def entrained(result):
        f = result.flotation
        return sum(float(np.sum(f.rougher_feed_species[d.id] * f.rougher.recovery[d.id] * f.rougher.entrained_share[d.id]))
                   for d in f.defs if d.kind == "free")

    assert entrained(more_air) > entrained(nominal)


@pytest.mark.parametrize("case_id", ["copper_porphyry_soft", "zinc_sulfide", "nickel_sulphide", "iron_magnetite_fine"])
def test_grind_energy_and_liberation(case_id):
    case = CASE_BY_ID[case_id]
    coarse = run_point(case_id, case.nominal.with_values(target_p80_um=case.nominal.target_p80_um * 1.3), unlimited_power=True)
    fine = run_point(case_id, case.nominal.with_values(target_p80_um=case.nominal.target_p80_um * 0.8), unlimited_power=True)
    assert fine.metrics["specific_energy_grinding_kwh_t"] > coarse.metrics["specific_energy_grinding_kwh_t"]

    def liberated_share(result):
        primary_carrier = result.ore.valuable[0]
        species = result.grinding.overflow_species
        liberated = float(np.sum(species[f"{primary_carrier}:liberated"]))
        total = float(np.sum(result.streams["cyclone_overflow"].solids[primary_carrier]))
        return liberated / total

    assert liberated_share(fine) > liberated_share(coarse)
