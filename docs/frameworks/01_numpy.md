# 01 NumPy

NumPy is the engine's numerical core. Every stream in OreFlow is, for each mineral, a vector of mass
flows over 63 size classes, and every unit model is written as operations on those vectors: the
crusher and the ball mill are linear solves over the size classes, the cyclone and the flotation
banks are element-wise partitions, and the balance audit is a set of sums. It is the only third-party
library the engine imports, which is why the live API needs nothing else and why the TypeScript port
can reproduce the engine line by line.

## At a glance

| | |
|---|---|
| Package | `numpy` |
| Version | 2.2.6 |
| Licence | BSD-3-Clause |
| Declared in | `requirements.txt` (the engine lane, installed everywhere, the VPS included) |
| Lane | Offline bake and the live API; mirrored in the browser by `frontend/src/engine/` |
| Used by | every module of `data-pipeline/pipeline/engine/`, `io/contract.py`, the methods, the tests |
| Hardware | CPU only; the systems are 63 by 63 and solve in microseconds |

## Read in order

1. [Installation](01_numpy/01_installation.md): the pin, the environments, the one-thread setting of the bake.
2. [Usage in OreFlow](01_numpy/02_usage.md): the size grid, the crusher and mill as matrix solves, the
   partitions, the quadrature, and what the port has to match.
3. [Applying it](01_numpy/03_applying.md): running the engine's functions on your own feed, and the
   numerical rules that keep a mass balance exact.
4. [`example.py`](01_numpy/example.py): builds the grid and a feed, checks the breakage matrix, crushes
   at three closed-side settings, and verifies the Gauss-Laguerre projection against its closed form.

Related: [02 SciPy](02_scipy.md) (the methods on top of the engine),
[11 Vite and TypeScript](11_vite.md) (the port), [methodology 01](../methodologies/01_grid-streams-ore.md)
and [02](../methodologies/02_crushing.md).
