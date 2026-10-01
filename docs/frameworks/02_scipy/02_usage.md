# SciPy: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The learning design (`methods/learning.py`)

The learned lane needs states that fill each case's whole contract envelope, plus two ore factors. A scrambled
Sobol sequence does that with low discrepancy:

```python
sampler = qmc.Sobol(d=len(names) + len(factors), scramble=True, rng=np.random.default_rng(seed))
batch = 2 ** int(np.ceil(np.log2(max(count, 2))))
```

Sobol points keep their balance properties only in blocks of a power of two, so the design draws whole
power-of-two batches and keeps drawing until it has 256 states the contract accepts; a state that breaks a
cross-field rule is skipped, not repaired. Since 0.07.000 an input with an off value (the classifier cut) is left
out of the design, so the lane keeps learning the target mode and the design is the one of 0.06.

## The screen's variance (`methods/screen.py`)

The optimizer's screen (methodology 12) accepts a candidate only where the Gaussian process's 95% half-width on
recovery is at most 5 points. The variance at a standardized state $x$ is

$$\sigma^2(x) = k(x, x) - \left\lVert L^{-1} k_* \right\rVert^2,$$

with $k_*$ the covariances to the 500 training states and $L$ the lower Cholesky factor of their covariance,
exported by the learning stage (Rasmussen and Williams 2006, algorithm 2.1). The bake solves $L v = k_*$ with
SciPy:

```python
v = solve_triangular(self.lower, k, lower=True, check_finite=False)
variance = max(0.0, self.amplitude + self.noise - float(v @ v))
```

The browser does the same forward substitution in a loop (`frontend/src/learning/screen.ts`). The two agree to
round-off, not bit for bit, and the export checks the result against scikit-learn's `predict(return_std=True)`
within `learning.gp_export_tolerance` (1e-8; measured 5.1e-10).

## Why the optimizer left SciPy

Until 0.06.000 the constrained optimizer was `minimize(method="COBYLA")`, SciPy's port of Powell's method from
Zhang's PRIMA. It worked, but the browser cannot run it, so the objective's weights were fixed at the bake. Since
0.07.000 the optimizer is a pattern search with a progressive barrier, written line for line in both languages,
whose steps are comparisons of engine results on a power-of-two mesh (methodology 12). The records say
`method: gps-progressive-barrier`, and COBYLA's constants (`optimization.rhobeg`, `optimization.rhoend`) are gone.

## Why the uncertainty design left SciPy

Up to 0.06.000 the record's Latin hypercube was SciPy's:

```python
unit = qmc.LatinHypercube(d=len(names), scramble=True, rng=np.random.default_rng(seed)).random(n)
```

Since 0.07.000 it is OreFlow's own, `methods/sampling.py`: a SplitMix64 stream, a Fisher-Yates permutation of the
strata per input, one uniform per stratum. The browser's `engine/sampling.ts` repeats it bit for bit, so the
workbench can re-run the record at another seed. NumPy's generator has no browser counterpart, so SciPy's design
could not be reproduced there.

## Tests

- `tests/test_learning.py`: the design is seeded and inside the contract envelope, and the features never see the
  case identity.
- `tests/test_contract.py::test_cut_mode_declared`: the design leaves the classifier cut at its off value.
- The screen's export check (`methods/screen.py`, run by the learning stage): the float64 Gaussian process against
  scikit-learn, and the networks against ONNX Runtime; `frontend/src/test/screen.test.ts` holds the browser to the
  export's reference within 1e-9.
