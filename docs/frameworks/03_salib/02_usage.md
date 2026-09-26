# SALib: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The question

At a case's nominal operating point, the ore is not known exactly. Four properties are uncertain,
each a multiplicative factor on `[1 - h, 1 + h]` with a declared half-width `h`: the Bond work index
(0.20), the head grade (0.20), the liberation size of the valuable minerals (0.25) and their
floatability (0.25; the magnetite circuit has no flotation and so three inputs). Which of them drives
the spread of recovery, concentrate grade, grinding energy and recovered metal, and does any act only
through interactions?

## The indices

For an output `Y = f(X_1, ..., X_d)` with independent inputs,

```text
S1_i = V[ E(Y | X_i) ] / V(Y)          the share of the variance X_i explains alone
ST_i = E[ V(Y | X_~i) ] / V(Y)         the share X_i takes part in, interactions included
```

so `S1_i <= ST_i`, the `S1` sum to at most one, and `ST_i - S1_i` is what `X_i` explains only together
with other inputs.

## The design and the estimators

`methods/uncertainty.py`, function `sensitivity`:

```python
problem = {"num_vars": len(names), "names": list(names), "bounds": [[1.0 - w, 1.0 + w] for w in widths]}
design = sobol_sample.sample(problem, n, calc_second_order=False, scramble=True, seed=seed)
...
analysis = sobol_analyze.analyze(problem, y, calc_second_order=False,
                                 num_resamples=int(constant("sensitivity.resamples")),
                                 conf_level=float(constant("sensitivity.confidence")), seed=seed)
```

The sampler draws two base matrices `A` and `B` of `N = 256` rows from a scrambled Sobol sequence and,
for each input `i`, a matrix `A_B^(i)` equal to `A` with column `i` taken from `B`. Without second-order
indices that is `N (d + 2)` rows: 1536 engine runs for four inputs. Each row is a perturbed ore run
through the full engine. SALib then estimates, normalizing by the variance of the `A` and `B` outputs
(the forms in `SALib/analyze/sobol.py`, after Saltelli et al. 2010):

```text
S1_i = mean( f(B) (f(A_B^(i)) - f(A)) ) / var(f(A), f(B))
ST_i = 0.5 mean( (f(A) - f(A_B^(i)))^2 ) / var(f(A), f(B))
```

and a bootstrap over rows (200 resamples) gives a 95% confidence half-width for each index.

## What the record holds

For each nominal variant, `methods.sensitivity` in the case artifact stores the base sample count,
the number of engine runs, the seed, the inputs with their half-widths, and for each of the four
outputs `S1`, `S1_conf`, `ST` and `ST_conf` per input. An output that does not vary across the design,
up to round-off (a spread at most `1e-9` of its magnitude, `sensitivity.constant_tolerance`), is
recorded as `{"constant": true}`: dividing its round-off by its round-off would rank noise, which is
what happened before the tolerance for a mill at installed power at every sample (see
[03 Applying](03_applying.md)). Only the nominal
variant carries the record (1536 runs per case is the budget), and `scripts/check_artifacts.py`
rejects a sensitivity record on any other variant.

On the soft porphyry nominal state the total indices for recovery are about 0.79 for floatability,
0.13 for the work index, 0.06 for the liberation size and 0.003 for the head grade: at this grind the
recovery is limited by flotation kinetics, not by liberation or by the grade of the feed.

## Where it is shown

The workbench's Methods view has a Sensitivity sub-tab
(`frontend/src/workbench/views/methods/Sensitivity.tsx`) that draws `S1` and `ST` per input for the
chosen output, with the bootstrap half-widths in its table. The Benchmark page's Method records tab
("Uncertainty and sensitivity") names, for every case, the ore input with the largest total index:
floatability drives recovery in ten of the twelve cases, the work index drives grinding energy and the
head grade drives recovered metal in all twelve.

## Tests

`tests/test_uncertainty.py::test_seeded_quantiles_and_sobol` runs a 32-base-sample record and
requires `32 (d + 2)` engine runs, the floatability indices of grinding energy to be exactly zero
(grinding does not depend on floatability, so a nonzero value would be an estimator artefact), the
work index to have the largest total index for grinding energy, and `ST >= S1` within the two
confidence half-widths for every output and input.
`test_magnetite_has_no_floatability_input_and_sobol_is_seeded` checks that the circuit without
flotation has three inputs and that two runs give identical records.
