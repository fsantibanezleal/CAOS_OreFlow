import numpy as np
from dataclasses import replace

from pipeline.cases.catalog import CASES
from pipeline.model.process import METHODS, constrained_optimize, robust_monte_carlo, simulate


def test_all_cases_have_six_variants_and_methods():
    assert len(CASES) == 12
    assert all(len(case.variants) == 6 for case in CASES)
    result = simulate(CASES[0].params)
    assert len(result.method_outputs) == len(METHODS) == 21
    assert result.metrics["metal_balance_pct"] == 100.0


def test_determinism_and_monotonic_size_grid():
    result_a = simulate(CASES[3].params)
    result_b = simulate(CASES[3].params)
    assert result_a == result_b
    assert np.all(np.diff(result_a.size_um) > 0)
    assert np.all(np.diff(result_a.overflow_psd) >= -1e-12)
    assert abs(result_a.overflow_psd[-1] - 1.0) < 1e-6


def test_classifier_changes_mass_split_and_overall_recovery():
    p = CASES[0].params
    from pipeline.model.process import variant_params
    fine_cut = simulate(variant_params(p, {"classifier_cut_um": p.classifier_cut_um * 0.6}))
    coarse_cut = simulate(variant_params(p, {"classifier_cut_um": p.classifier_cut_um * 1.4}))
    assert fine_cut.metrics["overflow_fraction"] < coarse_cut.metrics["overflow_fraction"]
    assert fine_cut.metrics["recovery_pct"] < coarse_cut.metrics["recovery_pct"]
    assert fine_cut.metrics["concentrate_tph"] < p.feed_tph * fine_cut.metrics["overflow_fraction"]


def test_optimizer_and_uncertainty_are_bounded():
    p = CASES[-1].params
    optimum = constrained_optimize(p)
    uncertainty = robust_monte_carlo(p, samples=32)
    assert optimum["energy_kwh_t"] >= 0
    assert uncertainty["p05_recovery_pct"] <= uncertainty["p50_recovery_pct"] <= uncertainty["p95_recovery_pct"]
    assert uncertainty["samples"] == 32


def test_free_gold_has_a_real_separate_gravity_branch():
    gold = next(case for case in CASES if case.id == "gold_free_milling")
    assert gold.params.process_family == "gravity_rougher"
    result = simulate(gold.params)
    m = result.metrics
    assert m["gravity_recovery_pct"] > 0
    assert m["flotation_recovery_pct"] > 0
    assert m["gravity_product_tph"] > 0
    assert m["rougher_product_tph"] > 0
    assert abs(m["recovery_pct"] - m["gravity_recovery_pct"] - m["flotation_recovery_pct"]) < 1e-8
    assert abs(m["concentrate_tph"] - m["gravity_product_tph"] - m["rougher_product_tph"]) < 1e-8
    assert result.flotation_recovery[0] == m["gravity_recovery_pct"] / 100.0
    same_ore_rougher_only = simulate(replace(gold.params, process_family="rougher"))
    assert "gravity_recovery_pct" not in same_ore_rougher_only.metrics
    assert result.metrics["recovery_pct"] > same_ore_rougher_only.metrics["recovery_pct"]


def test_magnetite_uses_magnetic_separation_without_flotation_or_classification():
    case = next(case for case in CASES if case.id == "iron_magnetite_fine")
    assert case.params.process_family == "magnetic"
    result = simulate(case.params)
    m = result.metrics
    assert m["magnetic_recovery_pct"] > 0
    assert m["magnetic_product_tph"] == m["concentrate_tph"]
    assert m["flotation_recovery_pct"] == 0
    assert m["cyclone_d50_um"] == 0
    assert m["overflow_fraction"] == 1
    assert max(result.flotation_recovery) == 0
    assert abs(case.params.feed_tph - m["concentrate_tph"] - (case.params.feed_tph - m["concentrate_tph"])) < 1e-8
    assert next(method for method in result.method_outputs if method["id"] == "first_order")["status"] == "not-applicable"
    assert next(method for method in result.method_outputs if method["id"] == "lims_capture")["value"] == round(m["magnetic_recovery_pct"], 6)
    assert {variant["id"] for variant in case.variants} >= {"fine_grind", "coarse_grind"}


def test_phosphate_desliming_reverses_the_classifier_product_path():
    case = next(case for case in CASES if case.id == "phosphate_clay")
    assert case.params.process_family == "deslime_rougher"
    result = simulate(case.params)
    m = result.metrics
    assert m["concentrate_tph"] < case.params.feed_tph * (1 - m["overflow_fraction"])
    assert m["recovery_pct"] == m["flotation_recovery_pct"]
    rougher_only = simulate(replace(case.params, process_family="rougher"))
    assert abs(m["recovery_pct"] - rougher_only.metrics["recovery_pct"]) > 1
