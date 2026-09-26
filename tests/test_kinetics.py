"""PE-26: lumped kinetic records are least-squares fits to the engine's batch curve, each reporting its
parameters, fit RMSE and the projection to the rougher bank under the tanks-in-series residence
distribution; the projection is compared with the exact distributed bank recovery."""
from __future__ import annotations

import math

import numpy as np
import pytest

from engine_helpers import all_variants, flotation_cases, run_variant
from pipeline.cases.catalog import CASE_BY_ID, variant_point
from pipeline.engine.constants import constant
from pipeline.engine.grid import grid
from pipeline.engine.kinetics import (FIRST_ORDER, GAMMA, KELSALL, KLIMPEL, MODELS, STRETCHED, _erlang_mean, batch_curve,
                                      distributed_bank, kinetic_record, levenberg_marquardt)

TIMES = [float(v) for v in constant("batch.times_min")]


def _theta_for(model, natural):
    """Invert the reparameterization for a known natural parameter set."""
    logit = lambda p: math.log(p / (1.0 - p))  # noqa: E731
    if model is FIRST_ORDER or model is KLIMPEL:
        return [logit(natural[0]), math.log(natural[1])]
    if model is KELSALL:
        a, phi, kf, ks = natural
        return [logit(a), logit(phi), math.log(ks), math.log(kf - ks)]
    if model is GAMMA:
        return [logit(natural[0]), math.log(natural[1]), math.log(natural[2])]
    low, high = (float(v) for v in constant("kinetics.beta_bounds"))
    return [logit(natural[0]), math.log(natural[1]), logit((natural[2] - low) / (high - low))]


@pytest.mark.parametrize("model, truth", [
    (FIRST_ORDER, [0.9, 0.4]),
    (KELSALL, [0.93, 0.3, 1.1, 0.12]),
    (KLIMPEL, [0.95, 0.8]),
    (GAMMA, [0.9, 0.3, 2.0]),
    (STRETCHED, [0.92, 0.35, 0.7]),
    (STRETCHED, [0.92, 0.35, 1.6]),
])
def test_exact_curves_are_recovered(model, truth):
    observed = [model.value(t, truth) for t in TIMES]
    start = [v + 0.3 for v in _theta_for(model, truth)]
    fit = levenberg_marquardt(model, start, TIMES, observed)
    assert fit.converged
    assert math.sqrt(fit.sse / len(TIMES)) < 1e-9
    assert np.allclose(model.natural(fit.theta), truth, rtol=1e-6)


@pytest.mark.parametrize("cells", [1, 3, 8, 12])
@pytest.mark.parametrize("k_tau", [0.1, 1.0, 5.0])
def test_quadrature_matches_closed_forms(cells, k_tau):
    tau = 2.0
    k = k_tau / tau
    first = _erlang_mean(lambda t: math.exp(-k * t), cells, tau)
    assert first == pytest.approx((1.0 + k * tau) ** -cells, rel=1e-10)
    q = [0.9, k]
    klimpel_quadrature = 0.9 * (1.0 - _erlang_mean(lambda t: -math.expm1(-k * t) / (k * t), cells, tau))
    assert KLIMPEL.project(q, cells, tau) == pytest.approx(klimpel_quadrature, rel=1e-9)
    # a gamma model with p = 1 and a stretched exponential with beta = 1 have closed forms too
    assert GAMMA.project([0.9, k, 1.0], cells, tau) == pytest.approx(
        0.9 * (1.0 - _erlang_mean(lambda t: 1.0 / (1.0 + k * t), cells, tau)), rel=1e-12)
    assert STRETCHED.project([0.9, k, 1.0], cells, tau) == pytest.approx(FIRST_ORDER.project([0.9, k], cells, tau), rel=1e-10)


def test_single_rate_feed_has_no_lumping_error():
    n = grid().n
    rates = {"fast": np.full(n, 0.35), "inert": np.zeros(n)}
    feed = {"fast": np.full(n, 0.9 / n), "inert": np.full(n, 0.1 / n)}
    content = {"fast": 1.0, "inert": 1.0}
    observed = batch_curve(rates, feed, content, TIMES)
    fit = levenberg_marquardt(FIRST_ORDER, [0.0, 0.0], TIMES, observed)
    q = FIRST_ORDER.natural(fit.theta)
    assert np.allclose(q, [0.9, 0.35], rtol=1e-8)
    for cells in (3, 8):
        exact = distributed_bank(rates, feed, content, cells, 3.0)
        assert FIRST_ORDER.project(q, cells, 3.0) == pytest.approx(exact, rel=1e-8)


@pytest.mark.parametrize("case_id", flotation_cases())
def test_fits_and_bank_projection(case_id):
    result = run_variant(case_id, "nominal")
    cells = CASE_BY_ID[case_id].nominal.rougher_cells
    record = kinetic_record(result.flotation, result.ore, cells, result.metrics["rougher_recovery_pct"])
    assert record["status"] == "computed" and record["times_min"] == TIMES
    batch = record["batch_recovery_pct"]
    assert all(b > a for a, b in zip(batch, batch[1:])) and 0.0 < batch[0] and batch[-1] < 100.0
    bank = record["bank"]
    assert bank["exact_true_flotation_pct"] <= bank["engine_rougher_pct"] + 1e-9   # entrainment only adds
    ids = [m["id"] for m in record["models"]]
    assert ids == [m.id for m in MODELS]
    by_id = {m["id"]: m for m in record["models"]}
    for m in record["models"]:
        assert m["converged"], (case_id, m["id"])
        assert len(m["fitted_pct"]) == len(TIMES) and len(m["dense_pct"]) == len(record["dense_times_min"])
        assert 0.0 < m["bank_projection_pct"] <= m["parameters"]["R_inf"] + 1e-9
        assert m["lumping_error_pct"] == pytest.approx(m["bank_projection_pct"] - bank["exact_true_flotation_pct"], abs=1e-9)
        rmse = math.sqrt(sum((f - b) ** 2 for f, b in zip(m["fitted_pct"], batch)) / len(TIMES))
        assert m["rmse_pct"] == pytest.approx(rmse, rel=1e-9)
        assert m["ultimate_gap_pct"] == pytest.approx(m["parameters"]["R_inf"] - m["fitted_pct"][-1], abs=1e-9)
        assert m["ultimate_gap_pct"] > 0.0
    # a distribution of rates is not first order: the two-rate and gamma forms fit better
    assert by_id["kelsall"]["rmse_pct"] < by_id["first_order"]["rmse_pct"]
    assert by_id["gamma"]["rmse_pct"] < by_id["first_order"]["rmse_pct"]
    assert by_id["kelsall"]["rmse_pct"] < 0.5 and by_id["gamma"]["rmse_pct"] < 0.5


def test_magnetic_circuit_has_no_kinetic_record():
    from pipeline.engine.trace import trace

    result = run_variant("iron_magnetite_fine", "nominal")
    body = trace(result, CASE_BY_ID["iron_magnetite_fine"].nominal, "magnetic")
    assert body["methods"]["kinetics"]["status"] == "not_applicable"


def _record(case_id: str, variant_id: str) -> dict:
    case = CASE_BY_ID[case_id]
    point = variant_point(case, next(v for v in case.variants if v["id"] == variant_id))
    result = run_variant(case_id, variant_id)
    return kinetic_record(result.flotation, result.ore, point.rougher_cells, result.metrics["rougher_recovery_pct"])


def test_every_baked_variant_fit_converges():
    for case_id, variant_id in all_variants():
        if CASE_BY_ID[case_id].plant.flotation is None:
            continue
        for m in _record(case_id, variant_id)["models"]:
            assert m["converged"], (case_id, variant_id, m["id"], m["iterations"])


def test_documented_findings_on_nominal_cases():
    # docs/methodologies/11_kinetic-fits.md states these ranges; this keeps the page and the engine in step.
    first, rmse, lumping, betas = [], [], [], []
    for case_id in flotation_cases():
        by_id = {m["id"]: m for m in _record(case_id, "nominal")["models"]}
        first.append(by_id["first_order"]["lumping_error_pct"])
        rmse += [by_id["kelsall"]["rmse_pct"], by_id["gamma"]["rmse_pct"]]
        lumping += [abs(by_id["kelsall"]["lumping_error_pct"]), abs(by_id["gamma"]["lumping_error_pct"])]
        betas.append(by_id["stretched_exponential"]["parameters"]["beta"])
    assert all(-7.0 <= v <= -3.0 for v in first), first          # "underestimates by 3 to 7 points"
    assert max(rmse) < 0.2, rmse                                   # "within 0.2 points RMSE"
    assert max(lumping) < 1.7, lumping                             # "project within about 1.6 points"
    assert all(0.84 <= b <= 0.94 for b in betas), betas            # "beta between 0.84 and 0.94"
