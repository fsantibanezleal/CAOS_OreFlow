# scikit-learn: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## 1. The learned lane: surrogates of the engine (`methods/learning.py`)

**The data.** For each of the twelve cases a scrambled Sobol design ([02 SciPy](../02_scipy.md)) draws
256 states the contract accepts over the case's whole envelope plus two ore factors; the engine
simulates all 3072. Each state becomes 22 physical features computed before simulation (the payable
fraction, throughput per installed megawatt, the grind, the carriers' liberation size, density,
floatability and dose ratio, the rougher gas velocity, cells and volume per t/h, and four circuit
descriptors, among others) and three targets: recovery (%), the log10 upgrade ratio, and the total
specific energy (kWh/t). The case identity is never a feature.

**The protocols.** *Interpolation* holds out 20% of the states inside every case (a seeded split per
case, `interpolation_split`). *Leave one case out* holds out a whole case in turn
(`leave_one_case_out`): plants on the same ore may remain in training, so this is a near-neighbour test.
Whole payable/carrier groups are held out for transfer: two multi-case groups and five singleton groups, seven in all. Features and targets are standardized on the training rows
of each split only (`Standardizer`).

**The estimators**, with their settings from the constants file:

```python
Ridge(alpha=1.0)
RandomForestRegressor(n_estimators=300, min_samples_leaf=2, random_state=seed, n_jobs=1)
HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, early_stopping=False, random_state=seed)
kernel = (ConstantKernel(1.0) * RBF(length_scale=np.ones(22), length_scale_bounds=(0.01, 1e5))
          + WhiteKernel(1e-3, noise_level_bounds=(1e-9, 10.0)))
GaussianProcessRegressor(kernel=kernel, normalize_y=True, n_restarts_optimizer=2, random_state=seed)
```

The Gaussian process is fitted on at most 500 training rows (a seeded subsample; its cost grows with
the cube of the rows), with one length scale per feature (automatic relevance determination). The
record keeps, per target, its 95% interval coverage on the held-out rows, the mean interval
half-width, the fitted length scales, the features whose length scale reached the upper bound
(`switched_off`: the kernel decided they do not matter) and the fitted noise level. Optimizer
convergence warnings are counted, not hidden: a length scale at its bound is a result.

A permutation importance explains the gradient-boosting model on the held-out rows (10 repeats, scored by RMSE),
with each feature shuffled within each case: shuffled across the cases, as `sklearn.inspection.permutation_importance`
does, a feature that takes one value per case measures which case a row came from (review of 2026-10-04, L-04).

**What the 0.10.008 learning/v2 record shows** (recovery RMSE in percentage points):

Conditional means do not rank models with different surviving folds. The matched recovery comparison uses 11/12 case folds and 6/7 transfer groups, excluding magnetite for every algorithm. Null means rejected/unavailable, never zero.

| Model | Interpolation RMSE (pp) | LOCO mean RMSE (pp) | LOCO worst RMSE (pp) | LOCO A/S/R | Transfer mean RMSE (pp) | Transfer A/S/R |
|---|---|---|---|---|---|---|
| Ridge | 9.46 | 13.68 | 23.05 | 12/12/0 | 15.99 | 7/7/0 |
| Random forest | 6.49 | 13.16 | 48.86 | 12/12/0 | 16.86 | 7/7/0 |
| Gradient boosting | 4.60 | 12.66 | 56.61 | 12/12/0 | 17.40 | 7/7/0 |
| Gaussian process | 5.34 | 10.95 | 27.91 | 12/12/0 | 13.37 | 7/7/0 |
| MLP | 3.38 | 6.86 | 12.76 | 12/11/1 | 14.60 | 7/6/1 |

A/S/R means attempted/scored/rejected. Gradient boosting here is histogram gradient boosting. All five models use the same interpolation rows. Conditional case and group means require their own denominators.

| Matched recovery model | LOCO mean RMSE (pp) | LOCO median R² | Transfer mean RMSE (pp) | Transfer median R² |
|---|---|---|---|---|
| Ridge | 13.01 | 0.013 | 15.15 | -0.638 |
| Random forest | 9.92 | 0.430 | 11.53 | 0.209 |
| Gradient boosting | 8.67 | 0.581 | 10.87 | 0.365 |
| Gaussian process | 9.40 | 0.498 | 10.95 | 0.318 |
| MLP | 6.86 | 0.573 | 14.60 | 0.455 |

The MLP magnetite recovery fold is `rejected-transfer`: RMSE, MAE and R² are null for all 256 rows. The hard porphyry MLP RMSE is 1.7 points against ridge's 9.6; phosphate MLP RMSE is 8.9. These finite cases do not compensate for or validate the rejected case.

Four of five neural seeds reject magnetite recovery. Seed 20260971 remains scored with RMSE 217.18 percentage points: its predictions span -172.05 to -88.68%, overlapping the widened envelope at its upper end despite being negative. This is retained poor finite evidence, not a successful physical prediction. The first four conditional means cover eleven folds; the fifth covers twelve. The matched seed column uses the same eleven non-magnetite folds for every seed.

The full-design range check includes held-out target labels and runs only after inference. Passing it does not establish physical validity at every row or independent transfer performance.

All models retain 12/12 case folds and 7/7 groups for log upgrade and energy; log-upgrade group median R² is negative for each model. Log-upgrade RMSE uses dimensionless log10 ratios, and energy RMSE uses kWh/t. The matched tables apply only to their included folds, not unseen operating plants.

| GP coverage target | Interpolation coverage (%) | Pooled LOCO coverage (%) | Scored LOCO rows |
|---|---|---|---|
| recovery_pct | 90.7 | 82.9 | 3072 |
| log_upgrade | 91.3 | 67.8 | 3072 |
| specific_energy_total_kwh_t | 93.6 | 86.8 | 3072 |

The intervals are centred on GP means, not MLP predictions. Coverage is empirical and uses 612 interpolation rows and all 3072 held-out-case rows; these intervals remain below nominal 95% coverage and do not establish plant calibration.

The full multi-target and per-seed tables are on [methodology page 14](../../methodologies/14_learned-lane.md).

## 2. The particle lane (`stages/particle_experiment.py`)

The HZDR workbook's training sheet has A/B class labels for four constructed separation cases. The
four particle features are standardized with a `StandardScaler` fitted on the fitting rows only;
`train_test_split` reserves 15% of the training sheet (stratified by the case 1 class) to stop the
network in [05 PyTorch](../05_pytorch.md). Per case, a sparse logistic model is fitted:

```python
LogisticRegression(penalty="l1", solver="saga", C=1.0, max_iter=2500, random_state=seed)
```

Its predicted probabilities on the test sheet are scored against the sheet's constructed
probabilities, since the test sheet has no observed classes ([data contract 04](../../data-contract/04_particle-lane.md)).

## 3. The GeoMet lane (`data-pipeline/run_geomet.py`)

52 measured locked-cycle tests from 29 drill holes, five assay features (`log1p` of Cu, Fe, S, Si and
Al in ppm). Every model is a `Pipeline`, so the median imputation and the scaling are fitted inside
each training fold and never see the held-out holes:

```python
transform = [("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]
"ridge": Pipeline([*transform, ("regressor", Ridge(alpha=10.0))]),
"random_forest": Pipeline([("impute", SimpleImputer(strategy="median")),
                           ("regressor", RandomForestRegressor(n_estimators=160, min_samples_leaf=3, ...))]),
```

with a training-mean baseline and a Gaussian process alongside. Two protocols: `GroupKFold` with five
folds over whole holes, and a three-fold split by spatial zone. `clone` gives every fold a fresh,
unfitted copy. After the evaluation, `--fit-checkpoint` fits the models on all 52 tests and
`joblib.dump` writes the checkpoint that `scripts/predict-geomet.ps1` loads to score a CSV of new assays.
On 52 tests the point estimates do not rank the models, so the lane reports a paired bootstrap of every
pair's error difference: on the five fixed hole folds ridge beats the training mean by 0.42 points of RMSE (95% interval 0.02 to 0.82), but that partition sits at the 98.5th percentile of 200 random hole partitions; averaged over them the gain is 0.17 points (-0.39 to 0.71) and under leave one hole out 0.22 (-0.36 to 0.79), each interval widened for the six model pairs, and under spatial-zone folds no difference excludes zero either. No model separates from the training mean.

## Tests

`tests/test_learning.py` (the design is seeded and inside the contract, the features never see the
case identity, the protocol splits are disjoint, a sandbox run of the whole lane records every model's
identity), `tests/test_learning_findings.py` (the tables and the prose the pages print quote the
record), `tests/test_particle_experiment.py` and `tests/test_geomet.py`.
