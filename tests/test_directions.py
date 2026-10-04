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
    # E-17: more collector never lowers recovery by more than 0.01 points over one to three times the dose (past
    # its peak the oxide copper loses 0.009 points); the grade falls
    case = CASE_BY_ID[case_id]
    doses = [case.nominal.collector_gpt * f for f in (1.0, 1.6, 2.0, 2.5, 3.0)]
    metrics = [run_point(case_id, case.nominal.with_values(collector_gpt=d)).metrics for d in doses]
    recoveries = [m["recovery_pct"] for m in metrics]
    grades = [m["concentrate_grade"] for m in metrics]
    assert all(r >= max(recoveries[:i + 1]) - 0.01 for i, r in enumerate(recoveries))
    assert recoveries[1] > recoveries[0]
    assert grades[-1] < grades[0]


def test_oxide_collector_peak():
    """E-17: the one case whose recovery passes a peak inside three times the dose, and by how little."""
    case = CASE_BY_ID["copper_oxide"]
    rec = {f: run_point("copper_oxide", case.nominal.with_values(collector_gpt=case.nominal.collector_gpt * f)).metrics["recovery_pct"]
           for f in (2.0, 2.5, 3.0)}
    assert rec[2.5] > rec[2.0] and rec[2.5] > rec[3.0]
    assert 0.005 < rec[2.5] - rec[3.0] < 0.01


def test_head_grade_direction():
    """E-13: the direction the Methodology states, between each case's head-grade bounds in the contract: recovery falls
    in nine cases (the zinc most), is flat in the two gold cases and rises in the magnetite case."""
    from pipeline.io.contract import build_contract

    bounds = build_contract()["cases"]
    change = {}
    for case_id, case in CASE_BY_ID.items():
        b = bounds[case_id]["inputs"]["head_grade"]
        r = [run_point(case_id, case.nominal.with_values(head_grade=g)).metrics["recovery_pct"] for g in (b["min"], b["max"])]
        change[case_id] = r[1] - r[0]
    flat = sorted(c for c, d in change.items() if abs(d) < 0.05)
    assert flat == ["gold_free_milling", "refractory_gold"]
    assert [c for c, d in change.items() if d >= 0.05] == ["iron_magnetite_fine"]
    falls = {c: d for c, d in change.items() if d <= -0.05}
    assert len(falls) == 9
    assert min(falls, key=falls.get) == "zinc_sulfide" and round(-falls["zinc_sulfide"], 1) == 6.3


def test_installed_power_margin():
    """E-14: installed power is authored 1.02 to 1.20 times each nominal requirement, so every +25% variant is limited."""
    ratios = {}
    for case_id in CASE_BY_ID:
        m = run_variant(case_id, "nominal").metrics
        ratios[case_id] = m["installed_mill_power_kw"] / m["required_mill_power_kw"]
    assert round(min(ratios.values()), 2) == 1.02 and min(ratios, key=ratios.get) == "copper_porphyry_hard"
    assert round(max(ratios.values()), 2) == 1.20 and max(ratios, key=ratios.get) == "copper_oxide"
    others = [r for c, r in ratios.items() if c not in ("copper_porphyry_hard", "copper_oxide")]
    assert 1.115 <= min(others) and max(others) <= 1.135
    assert max(ratios.values()) < 1.25


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


def test_aeration_raises_grade_through_the_cleaners():
    """E-16: more air dilutes every rougher concentrate and shortens the cleaner residence; the final grade still rises
    in seven of the nine cases (falling in the nickel and the refractory gold), through the cleaners."""
    rises = []
    for case_id in WITH_AIR_VARIANT:
        n, a = run_variant(case_id, "nominal").metrics, run_variant(case_id, "more_air").metrics
        assert a["rougher_concentrate_grade"] < n["rougher_concentrate_grade"], case_id
        assert a["cleaner_residence_min"] < n["cleaner_residence_min"], case_id
        if a["concentrate_grade"] > n["concentrate_grade"]:
            rises.append(case_id)
    assert len(WITH_AIR_VARIANT) == 9 and len(rises) == 7
    assert sorted(set(WITH_AIR_VARIANT) - set(rises)) == ["nickel_sulphide", "refractory_gold"]


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
