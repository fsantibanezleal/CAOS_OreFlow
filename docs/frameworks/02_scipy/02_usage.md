# SciPy: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The constrained optimizer (`methods/optimization.py`)

**The question.** At one operating point of one case, which grind target, collector dose and rougher
gas velocity (the grind target alone for the magnetite circuit) recover the most primary metal, in
t/h, while the concentrate grade meets the case specification, the required mill power stays within
the installed power, and the process water per tonne stays within the plant's capacity?

**What COBYLA sees.** The `Problem` class turns that question into the form COBYLA solves:

- the decisions are scaled to the unit cube of their contract bounds (`to_unit`, `from_unit`), so one
  trust-region radius means the same thing for every input;
- the objective is the negative recovered metal divided by its value at the base point, so it is of
  order one;
- every constraint is a slack relative to its limit (`(grade - spec) / spec`,
  `(installed - required) / installed`, `(capacity - water) / capacity`), non-negative when it holds;
- a point the contract rejects (a cross-field rule) returns a violated `contract` constraint instead
  of an engine run;
- every evaluation is cached on its unit-cube coordinates, because COBYLA evaluates the objective
  and each constraint at the same point separately.

```python
result = minimize(lambda x: -problem.evaluate(x)["recovered_tph"] / problem.scale, np.asarray(start),
                  method="COBYLA", constraints=constraints, bounds=[(0.0, 1.0)] * len(start),
                  options={"rhobeg": 0.25, "tol": 1e-4, "maxiter": 200, "catol": 1e-6})
```

(The numbers are read from the constants: `optimization.rhobeg`, `optimization.rhoend`,
`optimization.max_evaluations`, `optimization.feasibility_tolerance`.)

**Why COBYLA.** The engine is deterministic but not smooth in the way a gradient method needs: the
energy per pass and the cyclone cut are found by root finders with tolerances, the power limit
switches the circuit from grind-limited to power-limited, and gradients by finite differences would
be noise at the step sizes a gradient method takes. COBYLA builds linear models from function values
inside a trust region and handles inequality constraints directly.

**Six starts, then a fresh simulation.** The optimizer runs from the variant's own point and five
declared interior points of the unit cube (`optimization.starts`). The best start that ends feasible
is the optimum, and it is simulated again from scratch, so the slacks it reports come from a clean
engine run and not from the optimizer's cache. If no start ends feasible, the record says
`infeasible` and gives the least-violating point, never an optimum. `scripts/check_artifacts.py`
rejects a record that reports an optimum outside its own constraints.

On the soft porphyry nominal state the record is `optimal`: all six starts end feasible after 15 to
20 evaluations each (110 distinct engine runs in all), the optimum grinds to about 124 µm with
collector and gas at their upper bounds, and installed power is the active constraint.

## The uncertainty record (`methods/uncertainty.py`)

Four ore properties are uncertain (Bond work index, head grade, the valuable minerals' liberation
size and floatability; three for the magnetite circuit), each uniform on `[1 - h, 1 + h]` times its
value with declared half-widths `h`. A scrambled Latin hypercube spreads the samples:

```python
unit = qmc.LatinHypercube(d=len(names), scramble=True, rng=np.random.default_rng(seed)).random(n)
factors = 1.0 - np.asarray(widths) + 2.0 * np.asarray(widths) * unit
```

with `n = 128` (`uncertainty.samples`) and the seed `uncertainty.seed`. A Latin hypercube puts exactly
one sample in each of the `n` equal strata of every input, so 128 runs cover each input's range more
evenly than 128 independent draws. The record reports P05, P50 and P95 of four outputs and the
probability of meeting each constraint; the factors themselves are stored, so anyone can re-run a
sample.

## The learning design (`methods/learning.py`)

The learned lane needs states that fill each case's whole contract envelope, plus two ore factors. A
scrambled Sobol sequence does that with low discrepancy:

```python
sampler = qmc.Sobol(d=len(names) + len(factors), scramble=True, rng=np.random.default_rng(seed))
batch = 2 ** int(np.ceil(np.log2(max(count, 2))))
```

Sobol points keep their balance properties only in blocks of a power of two, so the design draws
whole power-of-two batches and keeps drawing until it has 256 states the contract accepts; a state
that breaks a cross-field rule is skipped, not repaired.

## Tests

- `tests/test_optimization.py`: on four cases the record is optimal, every decision is inside its
  bounds, an independent re-simulation of the reported point meets each constraint and reproduces
  the reported slacks, and the optimum is at least as good as every feasible start and as a feasible
  base; an impossible grade specification yields `infeasible` with no optimum; the hard porphyry's
  off-specification base (23.7% Cu against 24%) is brought back to specification with grade active;
  the water constraint binds for the copper oxide case.
- `tests/test_uncertainty.py`: a re-run gives the identical record, every factor lies inside its
  half-width, the stored quantiles are recomputed exactly from the stored values, the joint
  constraint probability is no larger than any single one, and every sample closes within 1e-9; the
  magnetite circuit has no floatability input.
- `tests/test_learning.py`: the design is seeded and inside the contract envelope, and the features
  never see the case identity.
