# SciPy: applying it to your own question

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## Choosing a design

| Need | Design | Why |
|---|---|---|
| Propagate input uncertainty through a model (quantiles, probabilities) | `qmc.LatinHypercube(d, scramble=True, rng=...)` | One sample per stratum of every input: even coverage of each input's range at any sample count |
| Fill a whole envelope for a surrogate or a response surface | `qmc.Sobol(d, scramble=True, rng=...)`, in powers of two | Low discrepancy in all dimensions jointly; balanced only for `2^m` points |
| Variance-based sensitivity indices | SALib's Saltelli design ([03 SALib](../03_salib.md)) | Its estimators need the matched sample matrices it generates |
| The same design in another language | your own generator (OreFlow's SplitMix64, `methods/sampling.py`) | NumPy's streams have no counterpart outside Python |

Transform the unit samples to your ranges yourself (`low + u (high - low)`, or a multiplicative factor as the
uncertainty record does), and store the transformed samples with the result, so a run can be repeated sample by
sample.

## Solving with a factor you already hold

When a matrix is factored once and solved against many right-hand sides (a Gaussian process's variance at many
candidates, as in the screen), keep the factor and solve the triangular system, which costs $n^2$ instead of the
$n^3$ of a fresh solve:

```python
from scipy.linalg import cholesky, solve_triangular

lower = cholesky(K, lower=True)                           # once
v = solve_triangular(lower, k_star, lower=True, check_finite=False)   # per candidate
variance = k_xx - v @ v
```

A fitted scikit-learn `GaussianProcessRegressor` already holds this factor as `L_` and the weights as `alpha_`,
which is how the learning stage exports them.

## Traps

- **`solve_triangular` assumes an upper factor by default.** Pass `lower=True` for a Cholesky factor from
  `cholesky(..., lower=True)` or scikit-learn's `L_`; the wrong triangle gives a wrong answer without an error.
- **`check_finite=False` skips a scan, not a check you need twice.** Use it where the factor comes from your own
  checked export; leave it on for data you have not validated.
- **A library solve and a hand loop agree to round-off, not bit for bit.** Compare them within a tolerance (the
  screen's browser test uses 1e-9 relative), and do not let a decision flip on a difference that small: the
  optimizer asks every comparison for more than round-off (`optimization.decrease_tolerance`).
- **`qmc.Sobol` warns** when you draw a count that is not a power of two; the warning is right, the balance
  properties are lost. Draw `2^m` and discard, as the learning design does.
- **Do not reuse one generator for two designs** and expect either to be reproducible alone; give each design its
  own `np.random.default_rng(seed)`.
