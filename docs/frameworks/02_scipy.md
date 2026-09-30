# 02 SciPy

SciPy supplies two numerical tools the engine does not own, each used in one place: `scipy.stats.qmc.Sobol` for
the learned lane's design, and `scipy.linalg.solve_triangular` for the variance of the optimizer's screen. Until
0.06.000 it also supplied the operating-point optimizer, `scipy.optimize.minimize` with COBYLA; since 0.07.000 the
optimizer is OreFlow's own pattern search (`methods/pattern_search.py`), because the browser has to take the same
steps, and COBYLA has no browser counterpart. For the same reason the uncertainty record's Latin hypercube has
been OreFlow's own since 0.07.000 (`methods/sampling.py`, SplitMix64). The engine itself does not import SciPy,
so the live API and the browser need none of it.

## At a glance

| | |
|---|---|
| Package | `scipy` |
| Version | 1.17.1 |
| Licence | BSD-3-Clause |
| Declared in | `requirements-precompute.txt` (the offline lane) |
| Lane | Offline bake only |
| Used by | `data-pipeline/pipeline/methods/learning.py` (Sobol), `methods/screen.py` (the triangular solve) |
| Settings | `learning.*` and `optimization.*` in `data-pipeline/pipeline/engine/data/constants.json` |

## Read in order

1. [Installation](02_scipy/01_installation.md): the pin and what it pulls in.
2. [Usage in OreFlow](02_scipy/02_usage.md): the Sobol design of the learned lane, the screen's variance, and why
   the optimizer and the uncertainty design left SciPy.
3. [Applying it](02_scipy/03_applying.md): choosing a design, solving with a factor you already hold, and the traps.
4. [`example.py`](02_scipy/example.py): draws the Sobol design and checks its stratification, solves the screen's
   variance with SciPy and by hand and requires both to give the exported reference, and re-draws the uncertainty
   design from its seed.

Related: [01 NumPy](01_numpy.md), [03 SALib](03_salib.md) (the Sobol indices built on a Saltelli design),
[methodology 12](../methodologies/12_optimization.md) and [14](../methodologies/14_learned-lane.md).
