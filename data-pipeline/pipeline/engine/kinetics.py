"""Lumped batch-flotation kinetics fitted to the engine's own batch curve, projected to the rougher bank.

A virtual batch test floats the rougher feed with the rougher's true-flotation rate constants (no
entrainment) and samples the recovery of the primary payable at the laboratory times. Five lumped
models are fitted to that curve by one deterministic Levenberg-Marquardt routine (Marquardt 1963):

- first order ``R = A (1 - exp(-k t))``;
- Kelsall, modified by Jowett, ``R = A [(1 - phi)(1 - exp(-k_f t)) + phi (1 - exp(-k_s t))]``;
- Klimpel, a uniform distribution of rates on ``[0, k]``, ``R = A [1 - (1 - exp(-k t))/(k t)]``;
- gamma, Imaizumi and Inoue, ``R = A [1 - (1 + a t)^-p]``;
- compressed or stretched exponential ``R = A (1 - exp(-(k t)^beta))``.

Each fit is projected to the rougher bank under its residence distribution, N perfectly mixed cells of
residence ``tau_c`` (an Erlang distribution): closed forms for the first three, Gauss-Laguerre
quadrature with the exported node table for the other two. The projection is compared with the exact
distributed bank recovery of the same rate constants; the difference is the error of lumping a
distribution of rates into a few parameters (Polat and Chander 2000, doi:10.1016/S0301-7516(99)00069-1).
Bounds are imposed by reparameterization, so the least-squares problem is unconstrained, and every
sum runs in a fixed order so that the browser port reproduces it (PE-26, PE-31).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

import numpy as np

from .constants import constant
from .species import species_content

Vector = list[float]


def _logistic(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _logit(p: float) -> float:
    return math.log(p / (1.0 - p))


def _beta_bounds() -> tuple[float, float]:
    low, high = constant("kinetics.beta_bounds")
    return float(low), float(high)


# ---- models: natural parameters from theta, the curve and its gradient in natural parameters ----

@dataclass(frozen=True)
class Model:
    id: str
    names: tuple[str, ...]
    units: tuple[str, ...]
    natural: Callable[[Vector], Vector]             # theta -> natural parameters
    chain: Callable[[Vector], list[Vector]]         # d natural / d theta
    value: Callable[[float, Vector], float]         # R(t)
    gradient: Callable[[float, Vector], Vector]     # dR / d natural
    project: Callable[[Vector, int, float], float]  # bank recovery for N cells of residence tau_c
    start: Callable[[float, float], Vector]         # theta0 from (A0, k0)


def _first_value(t: float, q: Vector) -> float:
    a, k = q
    return a * -math.expm1(-k * t)


def _first_gradient(t: float, q: Vector) -> Vector:
    a, k = q
    return [-math.expm1(-k * t), a * t * math.exp(-k * t)]


def _mixers(k: float, cells: int, tau_c: float) -> float:
    """Unfloated fraction of a first-order class after ``cells`` perfect mixers: ``(1 + k tau_c)^-N``."""
    return (1.0 + k * tau_c) ** -cells


FIRST_ORDER = Model(
    "first_order", ("R_inf", "k"), ("1", "1/min"),
    natural=lambda th: [_logistic(th[0]), math.exp(th[1])],
    chain=lambda th: [[_logistic(th[0]) * (1.0 - _logistic(th[0])), 0.0], [0.0, math.exp(th[1])]],
    value=_first_value, gradient=_first_gradient,
    project=lambda q, n, tau: q[0] * (1.0 - _mixers(q[1], n, tau)),
    start=lambda a0, k0: [_logit(a0), math.log(k0)],
)


def _kelsall_value(t: float, q: Vector) -> float:
    a, phi, kf, ks = q
    return a * ((1.0 - phi) * -math.expm1(-kf * t) + phi * -math.expm1(-ks * t))


def _kelsall_gradient(t: float, q: Vector) -> Vector:
    a, phi, kf, ks = q
    ef, es = math.exp(-kf * t), math.exp(-ks * t)
    return [(1.0 - phi) * -math.expm1(-kf * t) + phi * -math.expm1(-ks * t), a * (ef - es),
            a * (1.0 - phi) * t * ef, a * phi * t * es]


def _kelsall_chain(th: Vector) -> list[Vector]:
    la, lp = _logistic(th[0]), _logistic(th[1])
    ks, gap = math.exp(th[2]), math.exp(th[3])
    return [[la * (1.0 - la), 0.0, 0.0, 0.0],
            [0.0, lp * (1.0 - lp), 0.0, 0.0],
            [0.0, 0.0, ks, gap],                  # k_f = k_s + gap
            [0.0, 0.0, ks, 0.0]]


KELSALL = Model(
    "kelsall", ("R_inf", "phi", "k_fast", "k_slow"), ("1", "1", "1/min", "1/min"),
    natural=lambda th: [_logistic(th[0]), _logistic(th[1]), math.exp(th[2]) + math.exp(th[3]), math.exp(th[2])],
    chain=_kelsall_chain, value=_kelsall_value, gradient=_kelsall_gradient,
    project=lambda q, n, tau: q[0] * ((1.0 - q[1]) * (1.0 - _mixers(q[2], n, tau)) + q[1] * (1.0 - _mixers(q[3], n, tau))),
    start=lambda a0, k0: [_logit(a0), 0.0, math.log(k0), math.log(k0)],
)


def _klimpel_h(x: float) -> float:
    return 0.0 if x == 0.0 else 1.0 - -math.expm1(-x) / x


def _klimpel_dh(x: float) -> float:
    return 0.0 if x == 0.0 else (-math.expm1(-x) - x * math.exp(-x)) / (x * x)


def _klimpel_project(q: Vector, cells: int, tau: float) -> float:
    a, k = q
    x = k * tau
    if cells == 1:
        unfloated = math.log1p(x) / x
    else:
        unfloated = -math.expm1((1 - cells) * math.log1p(x)) / ((cells - 1) * x)
    return a * (1.0 - unfloated)


KLIMPEL = Model(
    "klimpel", ("R_inf", "k"), ("1", "1/min"),
    natural=lambda th: [_logistic(th[0]), math.exp(th[1])],
    chain=lambda th: [[_logistic(th[0]) * (1.0 - _logistic(th[0])), 0.0], [0.0, math.exp(th[1])]],
    value=lambda t, q: q[0] * _klimpel_h(q[1] * t),
    gradient=lambda t, q: [_klimpel_h(q[1] * t), q[0] * t * _klimpel_dh(q[1] * t)],
    project=_klimpel_project,
    start=lambda a0, k0: [_logit(a0), math.log(k0)],
)


def _erlang_mean(f: Callable[[float], float], cells: int, tau: float) -> float:
    """``E[f(t)]`` for t Erlang with N stages of mean ``tau``: Gauss-Laguerre on ``t = tau v``."""
    nodes = contract_laguerre()
    total = 0.0
    for v, w in zip(nodes[0], nodes[1]):
        term = w
        for m in range(1, cells):
            term *= v / m
        total += term * f(tau * v)
    return total


def _gamma_value(t: float, q: Vector) -> float:
    a, rate, p = q
    return a * -math.expm1(-p * math.log1p(rate * t))


def _gamma_gradient(t: float, q: Vector) -> Vector:
    a, rate, p = q
    base = math.log1p(rate * t)
    remaining = math.exp(-p * base)
    return [-math.expm1(-p * base), a * p * t * remaining / (1.0 + rate * t), a * remaining * base]


GAMMA = Model(
    "gamma", ("R_inf", "a", "p"), ("1", "1/min", "1"),
    natural=lambda th: [_logistic(th[0]), math.exp(th[1]), math.exp(th[2])],
    chain=lambda th: [[_logistic(th[0]) * (1.0 - _logistic(th[0])), 0.0, 0.0], [0.0, math.exp(th[1]), 0.0],
                      [0.0, 0.0, math.exp(th[2])]],
    value=_gamma_value, gradient=_gamma_gradient,
    project=lambda q, n, tau: q[0] * (1.0 - _erlang_mean(lambda t: math.exp(-q[2] * math.log1p(q[1] * t)), n, tau)),
    start=lambda a0, k0: [_logit(a0), math.log(k0), 0.0],
)


def _stretched_beta(theta: float) -> float:
    low, high = _beta_bounds()
    return low + (high - low) * _logistic(theta)


def _stretched_value(t: float, q: Vector) -> float:
    a, k, beta = q
    return 0.0 if t == 0.0 else a * -math.expm1(-math.exp(beta * math.log(k * t)))


def _stretched_gradient(t: float, q: Vector) -> Vector:
    a, k, beta = q
    log_kt = math.log(k * t)
    z = math.exp(beta * log_kt)
    ez = math.exp(-z)
    return [-math.expm1(-z), a * ez * z * beta / k, a * ez * z * log_kt]


def _stretched_chain(th: Vector) -> list[Vector]:
    low, high = _beta_bounds()
    la, lb = _logistic(th[0]), _logistic(th[2])
    return [[la * (1.0 - la), 0.0, 0.0], [0.0, math.exp(th[1]), 0.0], [0.0, 0.0, (high - low) * lb * (1.0 - lb)]]


def _stretched_start(a0: float, k0: float) -> Vector:
    low, high = _beta_bounds()
    return [_logit(a0), math.log(k0), _logit((1.0 - low) / (high - low))]


STRETCHED = Model(
    "stretched_exponential", ("R_inf", "k", "beta"), ("1", "1/min", "1"),
    natural=lambda th: [_logistic(th[0]), math.exp(th[1]), _stretched_beta(th[2])],
    chain=_stretched_chain, value=_stretched_value, gradient=_stretched_gradient,
    project=lambda q, n, tau: q[0] * (1.0 - _erlang_mean(lambda t: math.exp(-math.exp(q[2] * math.log(q[1] * t))) if t > 0.0 else 1.0, n, tau)),
    start=_stretched_start,
)

MODELS: tuple[Model, ...] = (FIRST_ORDER, KELSALL, KLIMPEL, GAMMA, STRETCHED)


# ---- deterministic least squares ----

def solve_small(matrix: list[Vector], rhs: Vector) -> Vector:
    """Gaussian elimination with partial pivoting for the small normal systems (n <= 4)."""
    n = len(rhs)
    a = [list(row) + [rhs[i]] for i, row in enumerate(matrix)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(a[r][col]))
        a[col], a[pivot] = a[pivot], a[col]
        if a[col][col] == 0.0:
            raise ZeroDivisionError("singular normal matrix")
        for r in range(col + 1, n):
            factor = a[r][col] / a[col][col]
            for c in range(col, n + 1):
                a[r][c] -= factor * a[col][c]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        s = a[r][n]
        for c in range(r + 1, n):
            s -= a[r][c] * x[c]
        x[r] = s / a[r][r]
    return x


@dataclass
class Fit:
    theta: Vector
    sse: float
    iterations: int
    converged: bool


def _residuals(model: Model, theta: Vector, times: Vector, observed: Vector) -> tuple[Vector, list[Vector]]:
    q = model.natural(theta)
    chain = model.chain(theta)
    residual, jacobian = [], []
    for t, y in zip(times, observed):
        residual.append(model.value(t, q) - y)
        g = model.gradient(t, q)
        jacobian.append([sum(g[m] * chain[m][j] for m in range(len(q))) for j in range(len(theta))])
    return residual, jacobian


def levenberg_marquardt(model: Model, theta0: Vector, times: Vector, observed: Vector) -> Fit:
    lam = float(constant("numerics.lm_initial_damping"))
    factor = float(constant("numerics.lm_damping_factor"))
    lam_min, lam_max = (float(v) for v in constant("numerics.lm_damping_bounds"))
    floor = float(constant("numerics.lm_diagonal_floor"))
    tol = float(constant("numerics.lm_tolerance"))
    theta = list(theta0)
    r, jac = _residuals(model, theta, times, observed)
    sse = sum(v * v for v in r)
    n = len(theta)
    for iteration in range(1, int(constant("numerics.lm_max_iterations")) + 1):
        normal = [[sum(row[a] * row[b] for row in jac) for b in range(n)] for a in range(n)]
        grad = [sum(row[a] * ri for row, ri in zip(jac, r)) for a in range(n)]
        while True:
            damped = [[normal[a][b] + (lam * max(normal[a][a], floor) if a == b else 0.0) for b in range(n)] for a in range(n)]
            try:
                step = solve_small(damped, [-g for g in grad])
            except ZeroDivisionError:
                step = None
            if step is not None:
                trial = [theta[a] + step[a] for a in range(n)]
                try:
                    r_t, jac_t = _residuals(model, trial, times, observed)
                    sse_t = sum(v * v for v in r_t)
                except (OverflowError, ValueError, ZeroDivisionError):
                    sse_t = math.inf
                if math.isfinite(sse_t) and sse_t < sse:
                    break
            lam *= factor
            if lam > lam_max:
                return Fit(theta, sse, iteration, True)   # no step lowers the residual: a minimum in double precision
        decrease = sse - sse_t
        small_step = max(abs(s) for s in step) <= tol * (1.0 + max(abs(v) for v in theta))
        theta, r, jac, sse = trial, r_t, jac_t, sse_t
        lam = max(lam / factor, lam_min)
        if decrease <= tol * max(sse, floor) or small_step:
            return Fit(theta, sse, iteration, True)
    return Fit(theta, sse, int(constant("numerics.lm_max_iterations")), False)


# ---- the record ----

_LAGUERRE: tuple[Vector, Vector] | None = None


def contract_laguerre() -> tuple[Vector, Vector]:
    """The Gauss-Laguerre table exported with Contract 1 (same order as numpy's laggauss)."""
    global _LAGUERRE
    if _LAGUERRE is None:
        nodes, weights = np.polynomial.laguerre.laggauss(int(constant("numerics.laguerre_nodes")))
        _LAGUERRE = ([float(v) for v in nodes], [float(v) for v in weights])
    return _LAGUERRE


def batch_curve(rates: dict[str, np.ndarray], feed: dict[str, np.ndarray], content: dict[str, float], times: Vector) -> Vector:
    """True-flotation batch recovery of a species at each time, summed over classes and sizes."""
    total = sum(content[k] * float(np.sum(feed[k])) for k in feed)
    out = []
    for t in times:
        floated = sum(content[k] * float(np.sum(feed[k] * -np.expm1(-rates[k] * t))) for k in feed)
        out.append(floated / total)
    return out


def distributed_bank(rates: dict[str, np.ndarray], feed: dict[str, np.ndarray], content: dict[str, float],
                     cells: int, tau_c: float) -> float:
    """Exact true-flotation recovery of the same classes in N perfect mixers (no lumping)."""
    total = sum(content[k] * float(np.sum(feed[k])) for k in feed)
    floated = sum(content[k] * float(np.sum(feed[k] * (1.0 - (1.0 + rates[k] * tau_c) ** -cells))) for k in feed)
    return floated / total


def _half_time_rate(times: Vector, observed: Vector, ultimate: float) -> float:
    target = ultimate / 2.0
    previous_t, previous_y = 0.0, 0.0
    for t, y in zip(times, observed):
        if y >= target:
            t_half = previous_t + (target - previous_y) * (t - previous_t) / (y - previous_y)
            return math.log(2.0) / t_half
        previous_t, previous_y = t, y
    return math.log(2.0) / times[-1]


def kinetic_record(flotation: object, ore: object, cells: int, engine_rougher_pct: float) -> dict[str, object]:
    """Batch curve, the five fits and their bank projections for one flotation circuit."""
    defs = flotation.defs
    primary = ore.primary
    content = {d.id: species_content(d, ore, primary) for d in defs}
    rates = flotation.rates_rougher
    feed = flotation.rougher_feed_species
    times = [float(v) for v in constant("batch.times_min")]
    observed = batch_curve(rates, feed, content, times)
    tau_c = flotation.rougher.tau_cell_min
    exact = distributed_bank(rates, feed, content, cells, tau_c)
    last = times[-1]
    dense_count = int(constant("kinetics.dense_points"))
    dense = [last * i / (dense_count - 1) for i in range(dense_count)]
    ultimate0 = (1.0 + max(observed)) / 2.0
    k0 = _half_time_rate(times, observed, ultimate0)
    models = []
    for model in MODELS:
        fit = levenberg_marquardt(model, model.start(ultimate0, k0), times, observed)
        q = model.natural(fit.theta)
        fitted = [model.value(t, q) for t in times]
        projection = model.project(q, cells, tau_c)
        parameters = {}
        for name, unit, value in zip(model.names, model.units, q):
            parameters[name] = 100.0 * value if name in ("R_inf", "phi") else value
        models.append({
            "id": model.id,
            "parameters": parameters,
            "parameter_units": {name: ("%" if name in ("R_inf", "phi") else unit) for name, unit in zip(model.names, model.units)},
            "rmse_pct": 100.0 * math.sqrt(fit.sse / len(times)),
            "iterations": fit.iterations,
            "converged": fit.converged,
            "fitted_pct": [100.0 * v for v in fitted],
            "dense_pct": [100.0 * model.value(t, q) for t in dense],
            "bank_projection_pct": 100.0 * projection,
            "lumping_error_pct": 100.0 * (projection - exact),
            # share of the fitted ultimate recovery beyond the last batch time: how much of the bank
            # projection rests on extrapolation rather than on the measured curve
            "ultimate_gap_pct": 100.0 * (q[0] - fitted[-1]),
        })
    return {
        "status": "computed",
        "species": primary,
        "times_min": times,
        "batch_recovery_pct": [100.0 * v for v in observed],
        "dense_times_min": dense,
        "bank": {"cells": cells, "cell_residence_min": tau_c, "residence_min": tau_c * cells,
                 "exact_true_flotation_pct": 100.0 * exact, "engine_rougher_pct": engine_rougher_pct},
        "models": models,
    }
