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
(`leave_one_case_out`): the models that predict it never saw any of its states, which is what
transfer to an unseen ore and plant means. Features and targets are standardized on the training rows
of each split only (`Standardizer`).

**The estimators**, with their settings from the constants file:

```python
Ridge(alpha=1.0)
RandomForestRegressor(n_estimators=300, min_samples_leaf=2, random_state=seed, n_jobs=-1)
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

**What the record shows** (`data/derived/learning.json`, recovery, RMSE in percentage points):

| Model | Interpolation | Leave one case out, mean | Worst held-out case |
|---|---|---|---|
| Ridge | 9.56 | 16.10 | 34.40 |
| Random forest | 6.64 | 13.61 | 48.35 |
| Histogram gradient boosting | 4.60 | 13.89 | 60.42 |
| Gaussian process | 6.43 | 14.20 | 43.00 |
| MLP (PyTorch, [05](../05_pytorch.md)) | 3.70 | 60.11 | 471.75 |

On average every model is worse on an unseen case than inside the cases it trained on, and the
ranking changes between the protocols: the MLP interpolates best and has the largest one-case-out errors,
while by the median held-out R² the MLP (0.694) and gradient boosting (0.581) lead. The loss is
concentrated, not uniform. A copper sulphide case, with four neighbours on the same mineral in the training set,
transfers about as well as the pooled interpolation (held out, the hard porphyry costs the MLP 2.1 points and ridge
9.1), while the two circuits unlike the others fail: for the MLP, 172 points on the magnetite circuit (drums instead
of flotation) and 472 on phosphate (desliming first). One case out is therefore a near-neighbour test for the copper
plants; holding a whole ore group out (the five chalcopyrite plants together, the two gold plants together), no model
keeps a positive median recovery R² (the random forest comes closest, -0.004). The Gaussian process's 95% intervals
cover 86.1% of the held-out recoveries (89.7% and 91.3% for the other two targets), so they are too narrow for every
target. The Benchmark page's Learned lane tab shows the full tables and
charts.

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
`joblib.dump` writes the checkpoint that `scripts/predict-geomet` loads to score a CSV of new assays.
On 52 tests the point estimates do not rank the models, so the lane reports a paired bootstrap of every
pair's error difference: on the five fixed hole folds ridge beats the training mean by 0.42 points of RMSE (95% interval 0.02 to 0.82), but that partition sits at the 98.5th percentile of 200 random hole partitions; averaged over them the gain is 0.17 points (-0.39 to 0.71) and under leave one hole out 0.22 (-0.36 to 0.79), each interval widened for the six model pairs, and under spatial-zone folds no difference excludes zero either. No model separates from the training mean.

## Tests

`tests/test_learning.py` (the design is seeded and inside the contract, the features never see the
case identity, the protocol splits are disjoint, a sandbox run of the whole lane records every model's
identity), `tests/test_learning_findings.py` (the tables and the prose the pages print quote the
record), `tests/test_particle_experiment.py` and `tests/test_geomet.py`.
