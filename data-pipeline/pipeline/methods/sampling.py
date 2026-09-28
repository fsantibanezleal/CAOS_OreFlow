"""One seeded generator and one Latin hypercube for the bake and the browser (UQ-01 to UQ-03).

SplitMix64 (Steele, Lea and Flood 2014, doi:10.1145/2660193.2660195), as in Vigna's public-domain reference
``splitmix64.c``: every step is integer arithmetic modulo 2^64, and a uniform is the top 53 bits times 2^-53,
which is exact in IEEE doubles. ``frontend/src/engine/sampling.ts`` implements the same steps with BigInt, so a
design drawn from one seed is the same, bit for bit, in both languages.

The Latin hypercube (McKay, Beckman and Conover 1979, doi:10.1080/00401706.1979.10489755) takes, for each input
in order, a Fisher-Yates permutation of the n strata and then one uniform per stratum: sample i of input k is
``(perm_k[i] + U_k[i]) / n``.
"""
from __future__ import annotations

MASK = (1 << 64) - 1
GAMMA = 0x9E3779B97F4A7C15
MIX_1 = 0xBF58476D1CE4E5B9
MIX_2 = 0x94D049BB133111EB
UNIT = 2.0 ** -53


class SplitMix64:
    """The generator's state is one 64-bit integer; ``next_int`` advances it and returns the mixed value."""

    def __init__(self, seed: int) -> None:
        if not 0 <= seed <= MASK:
            raise ValueError(f"seed must be an unsigned 64-bit integer, got {seed}")
        self.state = seed

    def next_int(self) -> int:
        self.state = (self.state + GAMMA) & MASK
        z = self.state
        z = ((z ^ (z >> 30)) * MIX_1) & MASK
        z = ((z ^ (z >> 27)) * MIX_2) & MASK
        return z ^ (z >> 31)

    def next_float(self) -> float:
        """A uniform on [0, 1): the top 53 bits of the next integer, times 2^-53."""
        return (self.next_int() >> 11) * UNIT


def permutation(rng: SplitMix64, n: int) -> list[int]:
    """Fisher-Yates from the last index down, choosing ``j = floor(u (i + 1))`` from the next uniform."""
    order = list(range(n))
    for i in range(n - 1, 0, -1):
        j = int(rng.next_float() * (i + 1))
        order[i], order[j] = order[j], order[i]
    return order


def latin_hypercube(n: int, d: int, seed: int) -> list[list[float]]:
    """``n`` samples in ``d`` inputs on the unit cube, one per stratum of every input, as rows."""
    if n < 1 or d < 1:
        raise ValueError(f"a design needs at least one sample and one input, got n={n}, d={d}")
    rng = SplitMix64(seed)
    columns = []
    for _ in range(d):
        strata = permutation(rng, n)
        columns.append([(strata[i] + rng.next_float()) / n for i in range(n)])
    return [[columns[k][i] for k in range(d)] for i in range(n)]
