# SALib: applying it to your own case or model

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## Sensitivity of a case you changed

`sensitivity(case, point, base_samples=None, seed=None)` takes any case and operating point, so the
same record can be computed at a point of your choosing, for example the optimizer's optimum or a
harder ore:

```python
from dataclasses import replace
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.methods.uncertainty import sensitivity

case = CASE_BY_ID["copper_porphyry_hard"]
point = case.nominal.with_values(target_p80_um=110.0)
record = sensitivity(case, point, base_samples=64)       # 64 (4 + 2) = 384 engine runs, a few seconds
for output, idx in record["indices"].items():
    print(output, "constant" if idx.get("constant") else {name: round(v, 3) for name, v in idx["ST"].items()})
```

Use a power of two for `base_samples`. Small values give a quick ranking with wide confidence
intervals; the published records use 256.

This particular point shows why an output can come back `constant`. At a 110 µm target the hard
porphyry's mill needs more than its installed power for every sampled ore, so the circuit runs at
installed power, coarsens its product (the `power_limited` flag) and its grinding energy is installed
power over throughput at every row. Recovery then depends almost only on the work index (total index
about 0.9), because a harder ore now means a coarser grind. Before the constant rule, SALib divided
the grinding energy's round-off by itself and reported a total index of 1.1 for the head grade.

## Your own model

The pattern is three calls around any function of independent inputs:

```python
import numpy as np
from SALib.analyze import sobol as sobol_analyze
from SALib.sample import sobol as sobol_sample


def model(a: float, b: float, c: float) -> float:     # any deterministic function of the inputs
    return a * b + c ** 2


problem = {"num_vars": 3, "names": ["a", "b", "c"], "bounds": [[0.8, 1.2], [0.8, 1.2], [0.75, 1.25]]}
x = sobol_sample.sample(problem, 256, calc_second_order=False, scramble=True, seed=1)
y = np.array([model(*row) for row in x])
indices = sobol_analyze.analyze(problem, y, calc_second_order=False, num_resamples=200, seed=1)
print(dict(zip(problem["names"], indices["ST"])))
```

`calc_second_order` must be the same in both calls: it changes the design's layout, and an analysis
that assumes the other layout reads the wrong rows. The bounds describe uniform inputs; for another
distribution transform the unit samples yourself or use the `dists` entry of the problem.

## Reading the indices, and what not to read into them

- **Rank by `ST`, not by `S1`.** An input can have a small first-order index and a large total index;
  it then matters only through interactions, and fixing it at a nominal value would hide them.
- **An input with `ST` near zero** (within its confidence half-width) can be fixed without changing
  the output's variance: that is the question the index answers well.
- **The indices are conditional on the ranges.** They say how the declared half-widths share out the
  variance. Doubling one input's range changes every index; the indices are not properties of the
  process alone.
- **Small negative estimates are noise.** Both estimators are Monte Carlo averages; a value such as
  `-0.004` with a confidence half-width of `0.01` means zero.
- **Correlated inputs break the decomposition.** Sobol indices assume independent inputs; the four ore
  factors are sampled independently here, which is itself an assumption about the ore.
- **The model is the one being analysed.** A sensitivity record of an authored, uncalibrated plant
  says which input the model is sensitive to; it is not evidence about a real plant.
