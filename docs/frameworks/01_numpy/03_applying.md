# NumPy: applying it to your own feed

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## Put your own size distribution on the grid

The engine's functions take class mass vectors on its fixed grid, so a measured distribution has to be
put on that grid first. `SizeGrid.rosin_rammler(p80_um, slope)` builds one from a P80 and a spread;
for a measured screen analysis, interpolate the cumulative passing at the grid's upper bounds in log
size and difference it:

```python
import numpy as np
from pipeline.engine.grid import grid

g = grid()
sieve_um = np.array([...])          # your screen apertures, coarse to fine
passing = np.array([...])           # cumulative fraction passing each aperture
at_bounds = np.interp(np.log(g.upper[::-1]), np.log(sieve_um[::-1]), passing[::-1])[::-1]
mass = np.empty(g.n)
mass[:-1] = at_bounds[:-1] - at_bounds[1:]
mass[-1] = at_bounds[-1]            # the pan holds everything below the last bound
mass[0] += 1.0 - at_bounds[0]       # everything above the top bound goes to the top class
mass /= mass.sum()
```

`np.interp` holds the end values outside the measured range, so a screen analysis that stops at
38 µm puts the whole of its last passing fraction in the finer classes as one block. That is a
statement about missing data, not a measurement: extend the analysis, or fit a distribution to its
fine end, before trusting any fines-sensitive result (desliming, entrainment).

## Run a unit on it

Every unit function works on one mineral's vector at a time, with the case's parameters:

```python
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.comminution import crush

case = CASE_BY_ID["copper_porphyry_soft"]
product = crush(mass * feed_tph, 8000.0, case.plant.crusher)   # closed-side setting in micrometres
print(g.p80(product))
```

To run the whole circuit on your own conditions, change the operating point or the ore and call the
engine. The engine does not validate its input itself: pass the point through the contract first
(`io/contract.py`, see [data contract 01](../../data-contract/01_operating-contract.md)) so an
impossible state is rejected with a code instead of solved.

```python
from pipeline.engine.circuit import simulate

point = case.nominal.with_values(target_p80_um=120.0, collector_gpt=30.0)
result = simulate(case.ore, case.plant, point)
print(result.metrics["recovery_pct"], result.metrics["balance_max_relative_error"])
```

## Numerical rules the engine follows, and why

- **Solve, never invert.** `np.linalg.solve(A, f)` is both faster and more accurate than
  `np.linalg.inv(A) @ f`; the engine's matrices are well conditioned, but the balance is audited to
  1e-9 and an explicit inverse spends accuracy for nothing.
- **Write lower-triangular structure as it is.** The breakage matrix is strictly lower-triangular and
  the pan column is zero; building it column by column from the cumulative breakage function makes
  each column sum to exactly one, which is what conserves mass. Check it the way `example.py` does.
- **Keep one grid.** Every stream shares the 63 classes. A second grid would need an interpolation
  between them, and interpolated masses do not balance.
- **Guard the small differences.** `1 - exp(-x)` loses digits for small `x`; `-np.expm1(-x)` does not.
  The same applies to `log(1 + x)` and `np.log1p`.
- **Seed through a `Generator`.** `np.random.default_rng(seed)` makes a design reproducible and
  independent of any other code that draws random numbers; the global `np.random.seed` does not.

## When NumPy is not the right tool

The engine's systems are small and dense, so NumPy's dense solvers are the right choice. A flowsheet
with hundreds of units, or a grid of thousands of classes, would call for sparse matrices
(`scipy.sparse`) and an iterative solver. A dynamic model (the engine has none) would call for an ODE
integrator such as `scipy.integrate.solve_ivp`, not for longer loops over steady states.
