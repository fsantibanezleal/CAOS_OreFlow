# 18 The GeoMet lane

The GeoMet lane asks whether five head assays predict the locked-cycle copper recovery of a sample from another
drillhole of the same deposit. It is a question about the data, separate from the engine: page 15 runs the same
samples through an engine circuit, and this page fits models to the measured recovery directly
(`data-pipeline/run_geomet.py`). The fields and the refusals are in
[data contract 05](../data-contract/05_geomet-lane.md).

## Source

The GeoMet dataset (Hoffimann et al. 2022, Mathematical Geosciences 54(7):1227-1253,
doi:10.1007/s11004-022-10013-1; data Zenodo 7051975, doi:10.5281/zenodo.7051975, CC BY 4.0). Its `flotation.csv`
holds 53 locked-cycle tests with the hole, local coordinates, head assays and the measured copper recovery `LCT` as a
fraction. One test has no recovery (source row 29) and is excluded and listed, so 52 tests in 29 holes remain. The
table is pinned by Zenodo's MD5 (`f2e90da6bfa81de1261177ee85a91570`) and by SHA-256; a different file stops the run.

A locked-cycle test is a laboratory test that repeats a batch flotation with its recycle streams until it settles. It
is a measured recovery, but not a plant's operating KPI, and it carries no time stamp.

## Protocol

- **Target.** `LCT` in percent.
- **Features.** Exactly `Cu ppm`, `Fe ppm`, `S ppm`, `Si ppm` and `Al ppm`, transformed by $\log(1+x)$ of the
  nonnegative value. Median imputation and, for ridge and the Gaussian process, standardization are fitted inside
  each training fold only. The hole, the coordinates, `fr`, `xr` and the target never enter the features.
- **Models.** Four, each predicting a recovery clipped to 0 to 100%:
  - the training fold's mean, the baseline every other model must beat;
  - ridge regression, $\alpha = 10$;
  - a random forest of 160 trees, at least 3 samples per leaf, 80% of the features per split, seed 42;
  - a Gaussian process with a fixed kernel (a unit constant times an RBF of length scale 2, plus white noise 0.05)
    and normalized targets, conditioned on the training fold without optimizing its hyperparameters.
- **Two protocols**, both of which hold complete holes out, so no test shares a hole with its training data:
  - *hole*: five GroupKFold folds over the holes (41 or 42 training tests, 10 or 11 held out, 5 or 6 holes);
  - *zone*: three folds of contiguous holes ordered by their mean X, so a fold is a spatial zone (34 or 35 training
    tests, 17 or 18 held out).
- **Scores.** RMSE, MAE and bias in percentage points and $R^2$ over the out-of-fold predictions of all 52 tests.

## Uncertainty of the ranking

With 52 tests in 29 holes a difference in RMSE between two models is small next to its sampling noise, so the record
carries three paired comparisons, all resampling complete holes with replacement and scoring every model on the same
rows:

1. **The published partition.** A bootstrap of 2000 resamples (seed 42) over the out-of-fold predictions of each
   protocol: each model's 95% RMSE interval and, for every pair, the mean difference, its 95% interval, the share of
   resamples in which the first model is better, and whether the interval excludes zero.
2. **Repeated partitions.** 200 random five-fold hole partitions (seed 20261002), the squared error of each test
   averaged over them, and a bootstrap of 4000 resamples whose intervals are widened for the six model pairs
   (Bonferroni, 95% family-wise).
3. **Leave one hole out**, with the same widened bootstrap (seed 20261003).

For a pair of models $a$ and $b$, $\bar e^{(m)}_i$ the squared error of test $i$ under model $m$ and $H^*$ a
resample of the holes with its tests $I(H^*)$:

$$\Delta^* = \sqrt{\frac{1}{|I(H^*)|}\sum_{i \in I(H^*)} \bar e^{(a)}_i} - \sqrt{\frac{1}{|I(H^*)|}\sum_{i \in I(H^*)} \bar e^{(b)}_i},\qquad \text{interval} = \left[q_{\alpha/(2k)}(\Delta^*),\ q_{1-\alpha/(2k)}(\Delta^*)\right]$$

with $\alpha = 0.05$ and $k = 6$ pairs for the widened intervals ($k = 1$ for the published partition).

## What the record shows

RMSE in percentage points (`data/derived/source/geomet_lct_benchmark.json`):

| Protocol | Training mean | Ridge | Random forest | Gaussian process |
|---|---|---|---|---|
| Hole | 5.5075 | 5.0900 | 5.4149 | 5.2011 |
| Zone | 5.4485 | 5.1488 | 5.6393 | 5.6928 |

On the published hole folds ridge beats the training mean by 0.42 points (95% interval 0.02 to 0.82), the one pair
whose interval excludes zero. That partition is not typical: its ridge gain sits at the 98.5th percentile of the gain
over the 200 random partitions, whose mean is 0.18. Over those partitions the gain is 0.17 points (-0.39 to 0.71),
and leaving one hole out it is 0.22 (-0.36 to 0.79); no pair excludes zero there, and none does under the zone folds.
The five assays carry little transferable signal about locked-cycle recovery on this deposit, and the product says
so instead of naming a winner (review of 2026-10-02, M-05).

## Predicting new samples

`scripts/precompute` fits each model once more on all 52 tests into a local checkpoint
(`models/geomet_lct.joblib`, ignored by git). `scripts/predict-geomet.ps1 INPUT.csv OUTPUT.csv` (or the shell
counterpart) predicts the recovery of new assays with it: each output row carries the four predictions, the count of
missing assays and a flag when any assay lies outside the range of the 52 training tests. The checkpoint is refused
when it was fitted on another source file or another feature list. It is a Python pickle: load only one this
repository generated, on a trusted machine.

## Verification

`tests/test_geomet.py`: the pinned source, the exclusion and the missing values, the hole and zone folds without
shared holes, the matrix of four models by two protocols, the evidence boundary in the record, the assay CSV contract,
the paired bootstrap recomputed from the stored predictions without refitting, and the documented significance.
`tests/test_docs_claims.py` holds the numbers of this page to the record.

## What it is not

It is one deposit's laboratory tests, not a plant. The assays say nothing of the grind, the reagents or the residence
time, so no prediction here is a set point or a calibration of the engine's controls, and no result transfers to
another mine without a test on that mine.
