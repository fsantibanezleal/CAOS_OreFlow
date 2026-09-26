"""Breakage matrices, the Whiten crusher and the energy-specific ball-mill operator.

Sources (docs/frameworks/comminution): Whiten crusher form as reproduced in Andrejev et al. (2021),
doi:10.3390/min11111256; energy-specific selection after Herbst and Fuerstenau (1980),
doi:10.1016/0301-7516(80)90034-4, in the Moly-Cop form; Austin breakage function; three perfect
mixers after Austin, Klimpel and Luckie (1984).
"""
from __future__ import annotations

import numpy as np

from .constants import constant
from .grid import grid
from .model import Crusher, Mill


def breakage_matrix(beta0: float, beta1: float, beta2: float) -> np.ndarray:
    """Strictly lower-triangular b[i, j]: fraction of broken class-j mass reporting to class i.

    ``B(i, j) = beta0 (x_i/x_{j+1})^beta1 + (1 - beta0)(x_i/x_{j+1})^beta2`` is the cumulative
    fraction of primary products of class j finer than the upper bound ``x_i`` of class i; the
    column of every breakable class sums to one and the pan column is zero.
    """
    g = grid()
    n = g.n
    b = np.zeros((n, n))
    for j in range(n - 1):
        ratio = g.upper[j + 1:] / g.upper[j + 1]
        cumulative = beta0 * np.power(ratio, beta1) + (1.0 - beta0) * np.power(ratio, beta2)
        column = np.empty(n - j - 1)
        column[:-1] = cumulative[:-1] - cumulative[1:]
        column[-1] = cumulative[-1]
        b[j + 1:, j] = column
    return b


def whiten_classification(css_um: float, crusher: Crusher) -> np.ndarray:
    """Probability that a particle of each class enters the breakage zone."""
    g = grid()
    k1 = crusher.k1_css * css_um
    k2 = crusher.k2_css * css_um
    size = g.size
    c = np.where(size < k1, 0.0, np.where(size > k2, 1.0, 1.0 - np.power(np.clip((k2 - size) / (k2 - k1), 0.0, 1.0), crusher.k3)))
    c[-1] = 0.0
    return c


def crush(feed: np.ndarray, css_um: float, crusher: Crusher) -> np.ndarray:
    """Whiten crusher product ``p = (I - C)(I - B C)^-1 f`` for one mineral's feed vector."""
    b = breakage_matrix(crusher.beta0, crusher.beta1, crusher.beta2)
    c = whiten_classification(css_um, crusher)
    n = grid().n
    internal = np.linalg.solve(np.eye(n) - b * c[None, :], feed)
    return (1.0 - c) * internal


def selection_energy(mill: Mill, work_index: float) -> np.ndarray:
    """Energy-specific selection function S^E (t/kWh) by class; the pan does not break."""
    g = grid()
    s = mill.alpha0 * (mill.reference_work_index_kwh_t / work_index) * np.power(g.size, mill.alpha1)
    s = s / (1.0 + np.power(g.size / mill.critical_size_um, mill.alpha2))
    s[-1] = 0.0
    return s


class MillOperator:
    """``T^-1(e) = prod_k (I + e f_k D)`` for one mineral, expanded once in powers of D."""

    def __init__(self, selection: np.ndarray, b: np.ndarray) -> None:
        n = grid().n
        self.d = (np.eye(n) - b) * selection[None, :]
        self.d2 = self.d @ self.d
        self.d3 = self.d2 @ self.d
        f1, f2, f3 = (float(v) for v in constant("mill.mixer_fractions"))
        self.c1 = f1 + f2 + f3
        self.c2 = f1 * f2 + f1 * f3 + f2 * f3
        self.c3 = f1 * f2 * f3
        self.eye = np.eye(n)

    def inverse(self, energy_per_pass: float) -> np.ndarray:
        e = energy_per_pass
        return self.eye + (self.c1 * e) * self.d + (self.c2 * e * e) * self.d2 + (self.c3 * e * e * e) * self.d3


def bond_energy(work_index: float, f80_um: float, p80_um: float) -> float:
    """Bond specific energy (kWh/t) for a reduction from F80 to P80 (GMG01-MP-2021)."""
    k = float(constant("bond.coefficient"))
    return work_index * (k / np.sqrt(p80_um) - k / np.sqrt(f80_um))


def operating_work_index(energy: float, f80_um: float, p80_um: float) -> float:
    k = float(constant("bond.coefficient"))
    return energy / (k / np.sqrt(p80_um) - k / np.sqrt(f80_um))
