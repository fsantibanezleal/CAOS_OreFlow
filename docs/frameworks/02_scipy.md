# 02 SciPy

SciPy supplies the two numerical methods the engine does not own: a derivative-free constrained
optimizer and quasi-random designs. OreFlow uses exactly three of its functions, each in one place:
`scipy.optimize.minimize` with COBYLA for the operating-point optimizer, `scipy.stats.qmc.LatinHypercube`
for the uncertainty record, and `scipy.stats.qmc.Sobol` for the learning design. The engine itself does
not import SciPy, so the live API and the browser need none of it.

## At a glance

| | |
|---|---|
| Package | `scipy` |
| Version | 1.17.1 |
| Licence | BSD-3-Clause |
| Declared in | `requirements-precompute.txt` (the offline lane) |
| Lane | Offline bake only |
| Used by | `data-pipeline/pipeline/methods/optimization.py` (COBYLA), `methods/uncertainty.py` (Latin hypercube), `methods/learning.py` (Sobol) |
| Settings | `optimization.*`, `uncertainty.*` and `learning.*` in `data-pipeline/pipeline/engine/data/constants.json` |

## Read in order

1. [Installation](02_scipy/01_installation.md): the pin and what it pulls in.
2. [Usage in OreFlow](02_scipy/02_usage.md): the optimization problem as COBYLA sees it, the six
   starts, the Latin hypercube of the uncertainty record and the Sobol design of the learned lane.
3. [Applying it](02_scipy/03_applying.md): setting up your own constrained operating-point problem,
   choosing a design, and the traps.
4. [`example.py`](02_scipy/example.py): re-runs the optimizer and the uncertainty design for the soft
   porphyry case and requires both to reproduce the committed records exactly.

Related: [01 NumPy](01_numpy.md), [03 SALib](03_salib.md) (the Sobol indices built on a Saltelli
design), [methodology 12](../methodologies/12_optimization.md) and
[13](../methodologies/13_uncertainty-sensitivity.md).
