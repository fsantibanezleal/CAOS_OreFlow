"""Bracketed scalar root finding for decreasing functions (Illinois variant of regula falsi).

Both circuit solves are roots of decreasing functions of a log variable: circulating load falls as
the cut coarsens, and product size falls as energy rises. Non-finite values can only occur on the
low side (a vanishing cut traps the pan), and are treated as positive infinity. Written as plain
arithmetic so the TypeScript engine repeats the same iterates.
"""
from __future__ import annotations

import math
from typing import Callable

import numpy as np

from .constants import constant


class RootError(ValueError):
    pass


def _value(f: Callable[[float], float], x: float) -> float:
    try:
        v = f(x)
    except (RootError, FloatingPointError, np.linalg.LinAlgError):
        return math.inf
    return v if math.isfinite(v) else math.inf


def bracket_decreasing(f: Callable[[float], float], x0: float, step: float, lo: float, hi: float) -> tuple[float, float, float, float]:
    """Return ``a < b`` with finite ``f(a) > 0 >= f(b)``."""
    cap = int(constant("numerics.root_max_iterations"))
    x = min(max(x0, lo), hi)
    fx = _value(f, x)
    if fx > 0.0:
        a, fa = x, fx
        for _ in range(cap):
            b = min(hi, a + step)
            fb = _value(f, b)
            if fb <= 0.0:
                break
            if b >= hi:
                raise RootError("no sign change below the upper limit")
            a, fa = b, fb
            step *= 2.0
        else:
            raise RootError("upper bracket search did not converge")
    else:
        b, fb = x, fx
        for _ in range(cap):
            a = max(lo, b - step)
            fa = _value(f, a)
            if fa > 0.0:
                break
            if a <= lo:
                raise RootError("no sign change above the lower limit")
            b, fb = a, fa
            step *= 2.0
        else:
            raise RootError("lower bracket search did not converge")
    for _ in range(cap):
        if math.isfinite(fa):
            return a, b, fa, fb
        m = 0.5 * (a + b)
        fm = _value(f, m)
        if fm > 0.0:
            a, fa = m, fm
        else:
            b, fb = m, fm
    raise RootError("could not find a finite positive bracket end")


def illinois(f: Callable[[float], float], a: float, b: float, fa: float, fb: float) -> float:
    """Root of ``f`` in ``[a, b]`` given finite ``f(a) > 0 >= f(b)``."""
    if fb == 0.0:
        return b
    tol = float(constant("numerics.root_rel_tolerance"))
    side = 0
    c = a
    for _ in range(int(constant("numerics.root_max_iterations"))):
        previous = c
        c = (a * fb - b * fa) / (fb - fa)
        fc = _value(f, c)
        if fc == 0.0 or abs(c - previous) <= tol * max(1.0, abs(c)):
            return c
        if fc < 0.0:
            b, fb = c, fc
            if side == -1:
                fa *= 0.5
            side = -1
        else:
            a, fa = c, fc
            if side == 1:
                fb *= 0.5
            side = 1
    return c


def solve_decreasing(f: Callable[[float], float], x0: float, step: float, lo: float, hi: float) -> float:
    a, b, fa, fb = bracket_decreasing(f, x0, step, lo, hi)
    return illinois(f, a, b, fa, fb)
