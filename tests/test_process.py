import numpy as np

from pipeline.cases.catalog import CASES
from pipeline.model.process import METHODS, constrained_optimize, robust_monte_carlo, simulate


def test_all_cases_have_six_variants_and_methods():
    assert len(CASES) == 12
    assert all(len(case.variants) == 6 for case in CASES)
    result = simulate(CASES[0].params)
    assert len(result.method_outputs) == len(METHODS) == 19
    assert result.metrics["metal_balance_pct"] == 100.0


def test_determinism_and_monotonic_size_grid():
    result_a = simulate(CASES[3].params)
    result_b = simulate(CASES[3].params)
    assert result_a == result_b
    assert np.all(np.diff(result_a.size_um) > 0)


def test_optimizer_and_uncertainty_are_bounded():
    p = CASES[-1].params
    optimum = constrained_optimize(p)
    uncertainty = robust_monte_carlo(p, samples=32)
    assert optimum["energy_kwh_t"] >= 0
    assert uncertainty["p05_recovery_pct"] <= uncertainty["p50_recovery_pct"] <= uncertainty["p95_recovery_pct"]
    assert uncertainty["samples"] == 32
