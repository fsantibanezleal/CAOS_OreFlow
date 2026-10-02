"""The fixed fourth-root-of-two size grid shared by every stream.

Class ``i`` (0-based) spans ``[upper[i+1], upper[i])``; the last class is the pan below
``upper[-1]``. Cumulative passing at ``upper[i]`` is the mass in classes ``i`` and finer.
"""
from __future__ import annotations

import math
from functools import lru_cache

import numpy as np

from .constants import constant


class SizeGrid:
    def __init__(self) -> None:
        top = float(constant("grid.top_um"))
        per_octave = int(constant("grid.classes_per_octave"))
        self.n = int(constant("grid.n_classes"))
        self.ratio = 2.0 ** (1.0 / per_octave)
        self.upper = top / self.ratio ** np.arange(self.n, dtype=float)
        rep = np.empty(self.n)
        rep[:-1] = np.sqrt(self.upper[:-1] * self.upper[1:])
        rep[-1] = self.upper[-1] / math.sqrt(self.ratio)
        self.size = rep

    def passing(self, mass: np.ndarray) -> np.ndarray:
        """Cumulative fraction passing each upper bound."""
        total = float(np.sum(mass))
        if total <= 0.0:
            return np.zeros(self.n)
        return np.cumsum(mass[::-1])[::-1] / total

    def percentile(self, mass: np.ndarray, level: float) -> float:
        """Size at which ``level`` of the mass passes, interpolated in (log size, passing)."""
        passing = self.passing(mass)
        if passing[-1] >= level:
            return float(self.size[-1])
        for i in range(self.n - 1):
            upper_pass, lower_pass = passing[i], passing[i + 1]
            if upper_pass >= level > lower_pass:
                fraction = (level - lower_pass) / (upper_pass - lower_pass)
                log_size = math.log(self.upper[i + 1]) + fraction * (math.log(self.upper[i]) - math.log(self.upper[i + 1]))
                return float(math.exp(log_size))
        return float(self.upper[0])

    def p80(self, mass: np.ndarray) -> float:
        return self.percentile(mass, float(constant("psd.p80_level")))

    def from_passing(self, size_um: tuple[float, ...], passing: tuple[float, ...], lower_um: float) -> np.ndarray:
        """Class mass fractions of a distribution declared as cumulative passing at descending sieve sizes (all of it
        passing the first), interpolated in log size; the fraction passing the last sieve spreads log-uniformly down to
        ``lower_um``, below which there is none."""
        sizes = np.asarray(size_um, float)
        cum_at = np.asarray(passing, float)
        log_last, log_lower = math.log(sizes[-1]), math.log(lower_um)
        cumulative = np.empty(self.n)
        for i, u in enumerate(self.upper):
            if u >= sizes[0]:
                cumulative[i] = 1.0
            elif u <= lower_um:
                cumulative[i] = 0.0
            elif u <= sizes[-1]:
                cumulative[i] = cum_at[-1] * (math.log(u) - log_lower) / (log_last - log_lower)
            else:
                cumulative[i] = float(np.interp(math.log(u), np.log(sizes[::-1]), cum_at[::-1]))
        mass = np.empty(self.n)
        mass[:-1] = cumulative[:-1] - cumulative[1:]
        mass[-1] = cumulative[-1]
        return mass / np.sum(mass)

    def rosin_rammler(self, p80_um: float, slope: float) -> np.ndarray:
        """Class mass fractions of a Rosin-Rammler distribution with the given P80."""
        level = float(constant("psd.p80_level"))
        scale = p80_um / (-math.log(1.0 - level)) ** (1.0 / slope)
        cumulative = 1.0 - np.exp(-np.power(self.upper / scale, slope))
        mass = np.empty(self.n)
        mass[:-1] = cumulative[:-1] - cumulative[1:]
        mass[-1] = cumulative[-1]
        mass[0] += 1.0 - cumulative[0]
        return mass / np.sum(mass)


@lru_cache(maxsize=1)
def grid() -> SizeGrid:
    return SizeGrid()
