# 13 Uncertainty and sensitivity

A single steady state hides how much the answer depends on ore properties nobody knows exactly.
OreFlow carries two records per operating point: how widely the results spread when the ore varies
(uncertainty), and which ore property drives that spread (sensitivity).

## Uncertain inputs

| Input | Enters the engine as | Half-width $h$ |
|---|---|---|
| work index | the Bond work index of the operating point (and, in proportion, the crushing work index) | 20% |
| head grade | the head grade of the primary payable | 20% |
| liberation size | the 50% liberation size $x_L$ of every valuable mineral | 25% |
| floatability | the floatability $P$ of every valuable mineral (flotation circuits only) | 25% |

Each factor is uniform on $[1 - h, 1 + h]$ times the value at the operating point. The half-widths
are authored for these records, not fitted to a deposit: they express a plausible spread for a
study at this level, and changing them changes the records. The magnetite circuit has no flotation,
so it has three inputs.

## Uncertainty (Monte Carlo)

A scrambled Latin hypercube of 128 points (SciPy `qmc.LatinHypercube`, seeded) is mapped to the
factors and each point is simulated. For recovery, concentrate grade, grinding specific energy and
recovered metal the record gives P05, P50 and P95 (NumPy's linear quantile), the mean and the
standard deviation, the value at the operating point, and every sampled value, so a histogram can be
drawn from the record itself. It also gives the probability of meeting each constraint of the
optimizer (grade specification, installed power, process-water capacity) and of meeting all of them,
the count of engine flags over the samples, and the worst balance error over the samples.

A Latin hypercube spreads 128 samples across every input's range more evenly than independent
draws, so the quantiles settle with fewer samples; the seed makes every record reproducible.

## Sensitivity (Sobol indices)

For an output $Y = f(X_1, \dots, X_D)$ with independent inputs, the variance decomposes into
contributions of each input and their interactions. The first-order index measures the share of the
variance explained by $X_i$ alone, and the total index includes every interaction that involves
$X_i$:

$$S_i = \frac{V\left[E(Y \mid X_i)\right]}{V(Y)}, \qquad S_{T_i} = \frac{E\left[V(Y \mid X_{\sim i})\right]}{V(Y)}.$$

$S_{T_i} \ge S_i$, and $S_{T_i} - S_i$ is the interaction share. The indices are estimated with the
Saltelli design: two independent base matrices $A$ and $B$ of $N$ rows and, for each input, a matrix
$A_B^{(i)}$ that is $A$ with column $i$ taken from $B$, which costs $N(D + 2)$ evaluations; the
estimators are those recommended by Saltelli et al. (2010, doi:10.1016/j.cpc.2009.09.018),

$$V_i \approx \frac{1}{N}\sum_j f(B)_j \left(f(A_B^{(i)})_j - f(A)_j\right), \qquad
V_{T_i} \approx \frac{1}{2N}\sum_j \left(f(A)_j - f(A_B^{(i)})_j\right)^2,$$

divided by the output variance. SALib (Herman and Usher 2017, doi:10.21105/joss.00097) provides the
scrambled Sobol-sequence design and the estimators, with bootstrap 95% confidence intervals (200
resamples). The baked records use $N = 256$ for the nominal variants.

A structural check comes free with the method: an input the output does not depend on gives
$f(A_B^{(i)}) = f(A)$ row by row, so both indices are exactly zero. Grinding energy does not depend
on floatability, and its floatability indices are exactly 0.0, not merely small.

## What the nominal cases show

Measured on 2026-09-26 on two cases (the baked records for every case are on the Experiments page):

- Soft copper porphyry: recovery P05 to P95 of 89.7 to 94.6%; the mill stays within installed power
  in 82% of the samples, because a harder ore trips the power limit. Floatability drives recovery
  (total index about 0.8), liberation size drives grade (about 0.8), the work index drives grinding
  energy (about 0.99) and head grade drives recovered metal (about 0.98).
- Magnetite: the concentrate meets its 65% Fe specification in 66% of the samples, because its
  nominal grade (65.7%) sits close to the specification and liberation size moves it across.

## Verification

- `tests/test_uncertainty.py::test_seeded_quantiles_and_sobol` (PE-28): the record is reproducible
  from its seed and changes with another seed; every factor lies in its range; P05 <= P50 <= P95 and
  the quantiles equal NumPy's on the stored values; probabilities lie in [0, 1] and meeting all
  constraints is no more likely than meeting any one; balances close within 1e-9 over the samples;
  the floatability indices of grinding energy are exactly zero, the work index has its largest total
  index, and every total index is at least its first-order index within the confidence intervals.
- `test_magnetite_has_no_floatability_input_and_sobol_is_seeded` and
  `test_grade_margin_shows_in_the_probability`.

## What it is not

A statement about any deposit: the spreads are authored. The inputs are independent by construction,
while real ore properties co-vary (a harder ore is often finer-grained), and the indices are only as
meaningful as that assumption. Operating inputs are held fixed: these records describe the ore's
uncertainty at a given way of running the plant, not the effect of operating choices, which the
Response view and the optimizer address.
