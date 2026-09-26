# SciPy: applying it to your own operating-point question

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## Optimize a case you changed

`optimize(case, base, contract)` works on any `CaseDef`, so a changed plant or ore is one
`dataclasses.replace` away. For example, the soft porphyry with a tighter grade specification and a
smaller mill:

```python
import json
from dataclasses import replace
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.model import GradeSpec
from pipeline.methods.optimization import optimize

contract = json.loads(open("data/derived/contract/operating_contract.json", encoding="utf-8").read())
case = CASE_BY_ID["copper_porphyry_soft"]
plant = replace(case.plant, grade_spec=GradeSpec("Cu", 27.0),
                mill=replace(case.plant.mill, installed_power_kw=6000.0))
record = optimize(replace(case, plant=plant), case.nominal, contract)
print(record["status"], record.get("optimum"), record.get("least_violating"))
```

Read `status` first: `optimal` comes with an optimum whose slacks you can check, `infeasible` with the
least-violating point, which tells you which constraint you asked too much of. The run above ends
`optimal` at a coarser grind (about 170 µm) and a low collector dose (about 12 g/t) with both grade
and power active. An active constraint's slack can be slightly negative: a point counts as feasible
within `optimization.feasibility_tolerance`, one millionth of each limit. The contract bounds of the
decisions are the case's; a question outside them needs a new contract entry, not a wider search.

## Setting up a constrained problem of your own

The pattern in `optimization.py` carries over to any simulator you can call:

1. **Scale the decisions to the unit cube** of their bounds. COBYLA's trust-region radius (`rhobeg`)
   is one number for every coordinate; unscaled inputs of different units make it wrong for all of
   them.
2. **Normalize the objective** by its value at the start, so its changes are of order one.
3. **Write each constraint as a relative slack** that is non-negative when it holds. A slack of
   `-0.01` then means "one percent short", whatever the constraint's unit.
4. **Cache evaluations.** COBYLA calls the objective and every constraint function separately at the
   same point; one simulation per point is enough.
5. **Run several fixed starts** and keep the best feasible end. A single start finds a local optimum
   and says nothing about others; fixed starts keep the result reproducible.
6. **Re-evaluate the answer from scratch** and report that evaluation, not the solver's last iterate.
7. **Say `infeasible` when it is.** Never report the least-bad point as an optimum.

## Choosing a design

| Need | Design | Why |
|---|---|---|
| Propagate input uncertainty through a model (quantiles, probabilities) | `qmc.LatinHypercube(d, scramble=True, rng=...)` | One sample per stratum of every input: even coverage of each input's range at any sample count |
| Fill a whole envelope for a surrogate or a response surface | `qmc.Sobol(d, scramble=True, rng=...)`, in powers of two | Low discrepancy in all dimensions jointly; balanced only for `2^m` points |
| Variance-based sensitivity indices | SALib's Saltelli design ([03 SALib](../03_salib.md)) | Its estimators need the matched sample matrices it generates |

Transform the unit samples to your ranges yourself (`low + u (high - low)`, or a multiplicative
factor as the uncertainty record does), and store the transformed samples with the result, so a run
can be repeated sample by sample.

## Traps

- **`qmc.Sobol` warns** when you draw a count that is not a power of two; the warning is right, the
  balance properties are lost. Draw `2^m` and discard, as the learning design does.
- **Do not reuse one generator for two designs** and expect either to be reproducible alone; give each
  design its own `np.random.default_rng(seed)`, as `learning.py` does per case (`seed + index`).
- **A derivative-free method still needs a well-posed problem.** If a constraint is flat over a region
  (a simulator that clips), COBYLA wanders; express the limit as a continuous slack instead.
- **COBYLA's `tol` is the final trust-region radius** in the scaled coordinates, not a tolerance on
  the objective; `1e-4` of the unit cube is far below any meaningful change of a grind target.
