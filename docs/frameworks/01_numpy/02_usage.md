# NumPy: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The representation: vectors over one size grid

`data-pipeline/pipeline/engine/grid.py` builds the one grid every stream shares: 63 classes on a
fourth-root-of-two progression from a 150 mm top bound, the last class a pan below 3.24 µm.

```python
self.upper = top / self.ratio ** np.arange(self.n, dtype=float)     # class upper bounds, coarse to fine
rep[:-1] = np.sqrt(self.upper[:-1] * self.upper[1:])                 # geometric-mean representative size
```

A stream (`engine/streams.py`) holds, for each mineral, an `ndarray` of 63 mass flows in t/h, plus a
water flow. Nothing stores a grade: assays are computed from the mineral masses and each mineral's
element content, so a grade can only change when a mass changes. Cumulative passing is a reversed
cumulative sum, and a percentile such as the P80 interpolates linearly in the logarithm of size:

```python
def passing(self, mass):
    return np.cumsum(mass[::-1])[::-1] / total
```

## The crusher and the mill are linear solves

The Whiten crusher (`engine/comminution.py`) is the product `p = (I - C)(I - BC)^-1 f`: `B` is the
strictly lower-triangular breakage matrix (every breakable column sums to one; fragments only go
finer), and `C` the diagonal of the probability that a particle of each class enters the breakage
zone. The inverse is never formed; the system is solved:

```python
internal = np.linalg.solve(np.eye(n) - b * c[None, :], feed)     # b * c[None, :] is B @ diag(c)
return (1.0 - c) * internal
```

The ball mill is three perfect mixers in series (volume fractions 0.70, 0.15 and 0.15) sharing one
breakage operator `D = (I - B) diag(S^E)`, where `S^E` is the energy-specific selection function.
Because the mixers share `D` they commute, and the mill's inverse transfer at an energy per pass `e`
is a cubic polynomial in `D`, expanded once per mineral (`MillOperator`):

```python
self.d = (np.eye(n) - b) * selection[None, :]
self.d2 = self.d @ self.d
self.d3 = self.d2 @ self.d
...
return self.eye + (self.c1 * e) * self.d + (self.c2 * e * e) * self.d2 + (self.c3 * e * e * e) * self.d3
```

Closing the circuit with the cyclone returning a fraction `C_i` of each class to the mill gives, per
mineral and per evaluation, one more solve (`engine/grinding.py`):

```python
matrix = self.operators[m].inverse(energy_per_pass) - np.diag(c_under - g_frac)
p = np.linalg.solve(matrix, self.feed[m])
```

At steady state the overflow then carries exactly the fresh feed of each mineral. The two scalar
unknowns (the energy per pass that meets the target P80, the host cut that meets the design
circulating load) are found by the Illinois method on logarithms (`engine/roots.py`), each step one
set of these solves.

## Partitions and banks are element-wise

The cyclone partition, the density-corrected cut of each mineral, the water bypass, the flotation rate
constants by class and the magnetic capture are all element-wise expressions over the 63 classes
(`np.power`, `np.exp`, `np.where`, `np.clip`). There is no loop over classes in Python where a
vector expression says the same thing.

## The quadrature and its accuracy

The flotation bank projection averages a batch recovery `f(t)` over the residence distribution of `N`
cells in series (an Erlang distribution). `engine/kinetics.py` does it with a 64-node Gauss-Laguerre
rule on `t = tau v`:

```python
nodes, weights = np.polynomial.laguerre.laggauss(int(constant("numerics.laguerre_nodes")))
```

The same table is exported in Contract 1 (`io/contract.py`), and the browser reads the export instead
of computing its own, so the two engines integrate on identical nodes. Where `1 - exp(-x)` appears
for small `x`, the engine writes `-np.expm1(-x)`, which keeps full precision where the subtraction
would cancel.

## The balance audit

`engine/balance.py` recomputes, from the output streams alone, the closure of every mineral, every
species and the water at every unit and for the circuit. `np.sum` over the stored class vectors is the
whole audit; `scripts/check_artifacts.py` repeats it on the committed artifacts in plain Python.

## Randomness

The methods use NumPy's `Generator` API with a declared seed (`np.random.default_rng(seed)`): the
learning splits, the Gaussian-process subsample, the network initialisation order. The scrambled Latin
hypercube and Sobol sequences of SciPy take the same generator ([02 SciPy](../02_scipy.md)).

## What the TypeScript port has to match

`frontend/src/engine/` repeats every one of these operations in TypeScript, in the same order:

- `linalg.ts` solves the 63-class systems by LU decomposition with partial pivoting; it is not
  LAPACK, and the results agree to about 1e-14 relative;
- sums run in the same order and additions are grouped the same way, so the root finders follow the
  same iterates;
- the constants, atomic weights and mineral table are the same JSON files, imported at build time.

`frontend/src/test/parity.test.ts` holds every baked variant to 1e-6 relative in every metric, stream
record, curve and kinetic record ([architecture 03](../../architecture/03_browser-engine.md)).

## Tests that exercise this

`tests/test_engine_core.py` (grid, streams, chemistry), `tests/test_crusher.py`,
`tests/test_grinding.py`, `tests/test_engine_balances.py` (every unit closes within 1e-9 on every
variant) and `tests/test_kinetics.py`.
