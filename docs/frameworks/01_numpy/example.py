"""NumPy in OreFlow: the size grid, a crusher feed, the Whiten crusher as one linear solve, and the
Gauss-Laguerre projection of the flotation bank checked against its closed form.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\01_numpy\\example.py
Every printed claim is also asserted, so the script fails if the engine stops behaving as described.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.cases.catalog import CASE_BY_ID  # noqa: E402
from pipeline.engine.comminution import breakage_matrix, crush  # noqa: E402
from pipeline.engine.grid import grid  # noqa: E402

g = grid()
print(f"grid: {g.n} classes from {g.upper[0] / 1000:.0f} mm, ratio {g.ratio:.4f}, pan below {g.upper[-1]:.2f} um")
assert g.n == 63 and abs(g.ratio - 2 ** 0.25) < 1e-15

case = CASE_BY_ID["copper_porphyry_soft"]
crusher = case.plant.crusher
feed = g.rosin_rammler(crusher.feed_f80_um, crusher.feed_slope)
print(f"crusher feed: Rosin-Rammler with F80 {g.p80(feed):.0f} um (declared {crusher.feed_f80_um:.0f} um)")
assert abs(g.p80(feed) / crusher.feed_f80_um - 1.0) < 0.02

# the breakage matrix: fragments only go finer, and every breakable column sums to one
b = breakage_matrix(crusher.beta0, crusher.beta1, crusher.beta2)
assert np.all(np.triu(b) == 0.0)
assert np.allclose(b[:, :-1].sum(axis=0), 1.0, rtol=0.0, atol=1e-12)
print(f"breakage matrix: strictly lower-triangular, column sums within {np.max(np.abs(b[:, :-1].sum(axis=0) - 1.0)):.1e} of one")

# the Whiten crusher at three closed-side settings: mass is conserved and a smaller gap crushes finer
nominal_mm = case.nominal.crusher_css_mm
p80s = []
for css_mm in (0.8 * nominal_mm, nominal_mm, 1.25 * nominal_mm):
    product = crush(feed, css_mm * 1000.0, crusher)
    assert abs(product.sum() - 1.0) < 1e-12
    p80s.append(g.p80(product))
    print(f"  CSS {css_mm:5.1f} mm: product P80 {p80s[-1]:7.0f} um, mass closure {abs(product.sum() - 1.0):.1e}")
assert p80s[0] < p80s[1] < p80s[2]

# the bank projection: E[1 - exp(-k t)] over N cells in series, each of mean residence tau, is
# 1 - (1 + k tau)^-N; the engine integrates it with the 64-node Gauss-Laguerre table of Contract 1
contract = json.loads((ROOT / "data" / "derived" / "contract" / "operating_contract.json").read_text(encoding="utf-8"))
nodes, weights = (np.asarray(contract["laguerre"][key]) for key in ("nodes", "weights"))
fresh_nodes, fresh_weights = np.polynomial.laguerre.laggauss(64)
assert np.array_equal(nodes, fresh_nodes) and np.array_equal(weights, fresh_weights)
for cells, k, tau in ((1, 0.5, 2.0), (8, 0.5, 1.2), (12, 2.0, 0.6)):
    # Erlang weight v^(N-1) / (N-1)! on t = tau v, accumulated as a product to avoid large factorials
    weight = weights * np.prod([nodes / m for m in range(1, cells)], axis=0) if cells > 1 else weights
    quadrature = float(np.sum(weight * -np.expm1(-k * tau * nodes)))
    closed = 1.0 - (1.0 + k * tau) ** -cells
    print(f"  N {cells:2d}, k tau {k * tau:.2f}: quadrature {quadrature:.15f}, closed form {closed:.15f}")
    assert abs(quadrature - closed) < 1e-12
print("every check passed")
