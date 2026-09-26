# scikit-learn: applying it to your own simulator or assays

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## Scoring a surrogate of a simulator honestly

The learned lane is a template for asking whether a cheap model can stand in for an expensive one.
What makes its answer trustworthy is not the choice of estimator but four rules:

1. **Features are properties, never identities.** A surrogate given the case name learns a lookup
   table: it scores well on held-out states of known cases and cannot say anything about a new one.
   `learning.features` computes only physical properties and controls, and
   `tests/test_learning.py::test_features_never_see_the_case_identity` renames a case and requires
   the same features.
2. **Hold out whole groups.** A random split of states interpolates between neighbours of the same
   ore. Leave-one-group-out (a case, a deposit, a drill hole, a campaign) is the test of transfer, and
   the two numbers answer different questions. Report both, as the record does, and expect them to
   rank models differently.
3. **Fit every transformation inside the training split.** Standardization, imputation and any feature
   selection are part of the model; fitted on all rows they leak the held-out rows' statistics. A
   `Pipeline` makes this automatic (the GeoMet lane); the learned lane standardizes explicitly per
   split.
4. **Record what was fitted.** Keep the estimator class, its settings, the seed, the rows it saw and
   its scores in one record; OreFlow's `learning.json` is that record, and the Benchmark page reads
   nothing else.

A minimal version of the protocol on the engine, for a subset of cases:

```python
import json
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.methods import learning

contract = json.loads(open("data/derived/contract/operating_contract.json", encoding="utf-8").read())
cases = tuple(CASE_BY_ID[c] for c in ("copper_porphyry_soft", "copper_porphyry_hard", "zinc_sulfide"))
design = learning.build_design(contract, cases, per_case=64, seed=1)
x, y, case_of = design["x"], design["y"], design["case"]
for held_out, train, test in learning.leave_one_case_out(case_of):
    ...  # fit on x[train], y[train]; score on x[test], y[test]
```

`example.py` runs it end to end.

## Reading a Gaussian process's intervals

A Gaussian process returns a predictive standard deviation with every prediction, and it is tempting to
read `mean +- 1.96 std` as a 95% interval. Check it: count how often the held-out truth falls inside
(the record's `coverage_95`). On the learned lane's recovery the coverage is 89.2%, so the intervals are
too narrow by a noticeable margin; on a deterministic engine the fitted noise level goes to its lower
bound and the intervals only express the kernel's smoothness assumption. Coverage below the nominal
level is a finding to report, not a setting to tune away.

## Predicting GeoMet recovery for your own assays

The GeoMet checkpoint predicts locked-cycle recovery from five assays. Prepare a CSV with the columns
`Cu ppm`, `Fe ppm`, `S ppm`, `Si ppm` and `Al ppm`, then:

```powershell
./scripts/fetch-data.ps1                                   # once: the pinned GeoMet source
.venv\Scripts\python.exe data-pipeline\run_geomet.py --fit-checkpoint
./scripts/predict-geomet.ps1 -InputCsv my_assays.csv -OutputCsv my_predictions.csv
```

The output repeats your rows and adds, per row, the number of missing assays, one flag that is true
when any assay lies outside the range of the 52 training tests, each model's predicted recovery
clipped to 0 to 100% (`ridge_lct_pct` and the others) and a column stating the evidence boundary. The
script rejects a non-numeric assay, a value outside 0 to 1 000 000 ppm and a row with no assay at all;
it refuses a checkpoint built from other source data (it compares the source's SHA-256), and fits one
if none exists, so `--fit-checkpoint` is only needed to rebuild it.

Read the predictions as what these 52 tests from one deposit suggest, not as a recovery for another
ore: the source has no grind, reagent or residence information, and on its own data no model beats the
training mean by a margin its bootstrap interval supports
([data contract 05](../../data-contract/05_geomet-lane.md)).

## Traps

- **`HistGradientBoostingRegressor` stops early by default** on more than 10 000 rows, using an
  internal validation split drawn from the training rows. The learned lane sets
  `early_stopping=False`, so every fold trains the same 300 iterations whatever its size and the
  protocols stay comparable.
- **Forests and boosting draw random numbers.** Pass `random_state` always (the lane passes the
  declared seed); a result is then reproducible whatever `n_jobs` is.
- **Permutation importance on correlated features** splits the credit between them; with the grind
  and the grind-to-liberation ratio both present, read importances in groups.
- **R² on a held-out case** is computed against that case's own mean, so a model can have a small RMSE
  and a negative R² on a case whose outputs barely vary. Report RMSE with it.
