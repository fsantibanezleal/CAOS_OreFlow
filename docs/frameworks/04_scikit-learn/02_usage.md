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

`permutation_importance` explains the gradient-boosting model on the held-out rows (10 repeats,
scored by RMSE).

**What the record shows** (`data/derived/learning.json`, recovery, RMSE in percentage points):

| Model | Interpolation | Leave one case out, mean | Worst held-out case |
|---|---|---|---|
| Ridge | 9.77 | 18.47 | 49.99 |
| Random forest | 7.00 | 12.08 | 47.02 |
| Histogram gradient boosting | 5.18 | 11.84 | 58.70 |
| Gaussian process | 6.95 | 13.28 | 30.27 |
| MLP (PyTorch, [05](../05_pytorch.md)) | 3.07 | 42.11 | 259.28 |

On average every model is worse on an unseen case than inside the cases it trained on, and the
ranking changes between the protocols: the MLP interpolates best and transfers worst. The loss is
concentrated, not uniform. A copper sulphide case, with neighbours in the training set, transfers about
as well as the pooled interpolation (held out, the hard porphyry costs the MLP 2.1 points and ridge 9.4),
while the three circuits unlike the others fail: for the MLP, 259 points on the magnetite circuit
(drums instead of flotation), 92 on free-milling gold (a gravity circuit) and 78 on phosphate
(desliming first). The Gaussian process's 95%
intervals cover 89.2% of the held-out recoveries (92.0% and 95.6% for the other two targets), so they
are somewhat too narrow for recovery. The Benchmark page's Learned lane tab shows the full tables and
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
On 52 tests no model clearly beats the training mean; the lane reports paired bootstrap intervals of
every pair's error difference so the ranking is not overstated ([data contract 05](../../data-contract/05_geomet-lane.md)).

## Tests

`tests/test_learning.py` (the design is seeded and inside the contract, the features never see the
case identity, the protocol splits are disjoint, a sandbox run of the whole lane records every model's
identity), `tests/test_learning_findings.py` (the tables and the prose the pages print quote the
record), `tests/test_particle_experiment.py` and `tests/test_geomet.py`.
