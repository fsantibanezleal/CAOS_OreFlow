# 14 Learned lane

A surrogate is a fast statistical stand-in for the engine. It is useful only if its error is known,
and the error that matters depends on the question: predicting a state near states it has seen
(interpolation), or predicting a plant it has never seen (transfer). OreFlow trains five surrogates
on engine states and measures both, and it trains a guard that says when a state lies outside what
the surrogates have seen.

## Design

For every case, a seeded scrambled Sobol sequence covers the case's Contract 1 envelope (every
applicable operating input between its resolved bounds, the cell count rounded) and two ore
properties: a liberation-size factor and a floatability factor within the uncertainty half-widths
of [page 13](13_uncertainty-sensitivity.md) (liberation only for magnetite). A state that breaks a
contract rule is skipped, and the sequence continues in batches whose total stays a power of two.
The baked design has 256 states per case, 3072 in all, each simulated by the engine.

## Features and targets

The features are physical properties and controls known before the simulation. The case identity
is never a feature, so leave-one-case-out measures transfer to an unseen ore and plant rather than
recall of a label (`tests/test_learning.py::test_features_never_see_the_case_identity` renames a case
and checks the features do not change).

| Feature | Meaning |
|---|---|
| `log_payable_fraction` | log10 of the head grade as a mass fraction |
| `specific_throughput_t_h_mw` | throughput per installed megawatt of mill power |
| `target_p80_um`, `circulating_load`, `water_m3_t`, `crusher_css_mm`, `work_index_kwh_t` | the operating inputs |
| `carrier_liberation_um`, `grind_to_liberation` | share-weighted liberation size of the payable's carriers, and the grind target over it |
| `carrier_composite_content`, `carrier_density_t_m3`, `carrier_floatability` | share-weighted carrier properties |
| `dose_ratio` | collector dose over the carriers' half-response dose |
| `jg_cm_s`, `rougher_cells`, `rougher_volume_m3_per_tph` | rougher gas velocity, cells, and cell volume times cells per t/h |
| `gravity_bleed`, `deslime_cut_um` | family levers, zero where absent |
| `has_flotation`, `has_gravity`, `has_magnetic`, `has_desliming` | circuit descriptors |

The targets are the overall recovery (%), the log10 upgrade ratio $\log_{10}(G_c/G_f)$ (concentrate
over head grade, which is unit-free and comparable between a copper, a gold and an iron circuit),
and the total specific energy (kWh/t).

## Protocols

- **Interpolation**: a seeded 80/20 split inside every case, so every case is in both sets.
- **Leave-one-case-out**: each of the twelve cases is held out in turn; the models that predict it
  never saw any of its states.

Each model is scored with RMSE, MAE and R² per target and protocol; the summary reports the
interpolation RMSE and R², and the mean and worst leave-one-case-out RMSE with the median R².

## Models

| Model | Implementation | Notes |
|---|---|---|
| ridge | `sklearn.linear_model.Ridge` on standardized features | the linear reference |
| random forest | `sklearn.ensemble.RandomForestRegressor`, 300 trees | Breiman (2001), doi:10.1023/A:1010933404324 |
| histogram gradient boosting | `sklearn.ensemble.HistGradientBoostingRegressor`, 300 iterations at 0.05, no internal early stopping | gradient boosting (Friedman 2001, doi:10.1214/aos/1013203451) on binned features; the record stores the class so the identity is checked |
| Gaussian process | `sklearn.gaussian_process.GaussianProcessRegressor`, constant times ARD squared-exponential plus white noise, fitted on a seeded 500-row subsample | Rasmussen and Williams (2006); reports the coverage of its 95% intervals and their mean half-width |
| MLP | PyTorch, 22 inputs, two hidden layers of 64 SiLU units, 3 standardized outputs | full-batch AdamW (Kingma and Ba 2015, arXiv:1412.6980; Loshchilov and Hutter 2019, arXiv:1711.05101); CUDA when available |

**Early stopping.** The MLP holds out 15% of its training rows. After every epoch it evaluates the
validation loss; training stops after 150 epochs without a new minimum (or at 3000 epochs), and the
weights of the best validation epoch are restored. The record keeps the epochs run, the best epoch,
the best validation loss and a thinned validation curve.

**Coverage.** A Gaussian process predicts a mean and a standard deviation; the fraction of test
targets inside mean ± 1.96 standard deviations is the empirical coverage of its nominal 95%
interval. Coverage far below 95% means overconfident intervals; far above, needlessly wide ones.

**The guard.** An autoencoder (22 inputs, 16, 6, 16 tanh units, 22 outputs) is trained to
reconstruct standardized training features, under the same stopping rule; in the record it ran to the 3000-epoch
cap (best epoch 2995), so it never stopped early. Its threshold is the 99th
percentile of the reconstruction error on the rows held out from fitting, so about 1% of in-envelope
states raise a false alarm by construction. The false-alarm rate is then measured on the held-out
test states, and the false-accept rate on probes: each test state with one continuous feature moved
half a training range beyond its training maximum. In the leave-one-case-out folds the record also
gives the share of the unseen case's states that the guard flags.

**Importance.** Permutation importance (Breiman 2001; `sklearn.inspection.permutation_importance`,
10 repeats, RMSE scoring) of the gradient-boosting surrogate on the interpolation test set says
which features the surrogate relies on.

**Export.** After evaluation, the MLP and the guard are trained on every state and exported to ONNX
(opset 17, dynamic batch). ONNX Runtime must reproduce PyTorch within 1e-5 on standardized outputs
or the export fails. `models/process_surrogate.json` carries the feature and target scalers and the
guard threshold, so the browser can standardize a state, run both models and flag an out-of-envelope
one.

## Findings

The precompute of release 0.08.000 trained and scored every model on 3072 engine states (256 per case, CUDA for
the networks). The tables are transcribed from `data/derived/learning.json`, and `tests/test_learning_findings.py`
fails if a number here and the record disagree.

| Model | Recovery: interpolation R² | Recovery: LOCO median R² | Recovery: LOCO mean RMSE (pts) | Log upgrade: interpolation R² | Log upgrade: LOCO median R² | Log upgrade: LOCO mean RMSE | Energy: interpolation R² | Energy: LOCO median R² | Energy: LOCO mean RMSE (kWh/t) |
|---|---|---|---|---|---|---|---|---|---|
| Ridge | 0.631 | 0.325 | 15.8 | 0.882 | -6.360 | 0.661 | 0.785 | 0.589 | 2.45 |
| Random forest | 0.834 | 0.413 | 13.5 | 0.996 | -3.197 | 0.219 | 0.964 | 0.927 | 1.11 |
| Gradient boosting | 0.915 | 0.668 | 13.7 | 0.997 | -1.130 | 0.175 | 0.979 | 0.958 | 0.93 |
| Gaussian process | 0.814 | 0.478 | 14.5 | 0.997 | -0.820 | 0.302 | 0.983 | 0.969 | 1.67 |
| MLP | 0.947 | 0.660 | 65.4 | 0.997 | -1.450 | 0.442 | 0.993 | 0.967 | 5.62 |

The MLP's figures are one training seed's. The record also retrains it with four more seeds on every split
(`mlp_seeds`); over the five, its interpolation RMSE of recovery runs from 2.7 to 4.0 points and its mean
leave-one-case-out RMSE from 27.0 to 65.4 points, so the MLP row above is the worst of its five seeds by that
statistic. The Gaussian process is fitted on a seeded 500-state subsample of the 2,460 interpolation training
states; on the same 500 states (`equal_rows`) the random forest and gradient boosting interpolate recovery with an
R² of 0.706 and 0.824, against the Gaussian process's 0.814, so part of the ranking above is training-set size.

- **Interpolation and transfer rank the models differently.** Inside the twelve cases' envelopes the MLP explains
  the most recovery variance. On a case it never saw it is the most accurate model on each of the five copper
  sulphide plants (recovery R² 0.96 to 0.99 at the record's seed, RMSE 1.6 to 3.6 points over the five seeds), and
  on the plants whose circuits differ from the rest its predictions leave 0 to 100%: 179 to 242 points of RMSE on the
  magnetite plant and 28 to 500 on the phosphate plant over the seeds. Gradient boosting has the best median R²
  (0.668), and gradient boosting and the random forest cannot be told apart by mean error (13.7 and 13.5 points):
  the forest is better in only 3 of the 12 folds, and its lower mean comes from the magnetite and phosphate folds.
- **The upgrade ratio transfers among plants that share their mineralogy, and fails elsewhere.** Every model's
  median R² over all twelve folds is below zero, but R² on one held-out case divides by that case's own spread, and
  the two gold plants' upgrade barely varies. Over the five copper sulphide plants the median held-out R² is 0.92
  for the Gaussian process and gradient boosting and 0.93 for the MLP (0.72 for the random forest, -0.40 for
  ridge).
- **Energy transfers for most models and folds.** Every model but ridge keeps a median R² above 0.9 on unseen cases
  (gradient boosting 0.958, mean error 0.93 kWh/t): specific energy follows throughput per megawatt, work index and
  grind, which the features carry directly. The exceptions are the held-out phosphate circuit, where the Gaussian
  process's R² is -16.5 and the MLP's -1,061 at the record's seed; the MLP's mean energy error over its five seeds
  runs from 0.9 to 5.6 kWh/t.
- **The exported surrogate is the MLP**, trained on every state after evaluation (early stopping restored epoch 2647
  of 2797). It suits fast interpolation inside the trained envelopes and not a new plant; the workbench's Methods
  view shows its answer beside the engine's, with these results and the guard's verdict.

| Gaussian process, interpolation split | Recovery | Log upgrade | Energy |
|---|---|---|---|
| Coverage of the nominal 95% interval | 84.2% | 88.9% | 91.7% |

The Gaussian process's nominal 95% intervals are overconfident under interpolation, and more so under leave one
case out, where they cover 75.8, 63.9 and 94.2% of the held-out states (2%, 0.4% and 73% in the worst fold). Its
fitted noise level sits at its lower bound for recovery only (1e-9); for the upgrade and the energy it is five to
seven orders of magnitude above it.

| Guard | Value |
|---|---|
| Threshold of the interpolation-split guard (mean squared error) | 0.387 |
| Threshold of the exported guard, fitted on every state | 0.348 |
| False alarms on held-out in-envelope states | 2.3% |
| False accepts on shifted probes | 17.7% |
| States of the held-out case flagged (mean over folds) | 51.5% |

| Held-out case | Flagged by the guard |
|---|---|
| Soft copper porphyry | 3.9% |
| Hard copper porphyry | 6.6% |
| Free-milling gold with gravity | 100.0% |
| Fine magnetite concentration | 100.0% |
| Nickel sulphide with serpentine slimes | 90.2% |
| Phosphate with clay slimes | 100.0% |
| Copper-molybdenum bulk flotation | 0.0% |
| Oxide copper by sulphidisation | 100.0% |
| Zinc sulphide | 17.2% |
| Copper ore with clay | 0.4% |
| Low-grade copper at high throughput | 0.0% |
| Refractory gold in sulphides | 100.0% |

**The guard detects unfamiliar features, and how often it accepts a state outside the envelope depends on how far
outside it is.** The false-accept rate in the table is one probe distance, one feature moved half its training range
past the maximum; the record's `acceptance_by_distance` gives the curve: 52.9% of the probes are accepted at 0.02 of
the range above the maximum (73.9% below the minimum), 45.4% at 0.1 (60.3%), 31.0% at 0.25 (38.2%), 17.7% at 0.5
(20.4%) and 14.0% at the full range (14.0%). At half the range 88% of the accepts step out along the crusher
setting, the circulating load or the overflow water, the inputs it barely sees. On an unseen case its verdict is
mostly bimodal: it flags every state of the oxide copper, gravity gold, magnetite, phosphate and refractory gold
plants, and at most 6.6% of the five copper sulphide plants', whose features lie among each other's; nickel (90%)
and zinc (17%) sit between. The flag tracks the circuit family, not the surrogate's error: held out, the soft
porphyry is flagged in 3.9% of its states while gradient boosting's upgrade R² there is -1.83. The mean over folds
averages those answers; it is not a detection rate.

| Feature (gradient boosting, recovery) | RMSE increase when permuted (pts) |
|---|---|
| `dose_ratio` | 10.64 |
| `specific_throughput_t_h_mw` | 9.04 |
| `work_index_kwh_t` | 4.65 |
| `rougher_volume_m3_per_tph` | 3.95 |
| `carrier_composite_content` | 2.82 |

The gradient-boosting surrogate leans on the collector dose ratio and throughput per installed megawatt, then on
work index, rougher volume per t/h and the payable carrier's composite content: the reagent kinetics, grinding
capacity, residence and liberation the engine's recovery responds to.

## Verification

- `tests/test_learning.py::test_protocols_and_model_identity` (PE-29), on a sandbox design of three
  cases: the recorded classes are Ridge, RandomForestRegressor, HistGradientBoostingRegressor and
  GaussianProcessRegressor; every model has finite scores for every target and protocol; each
  leave-one-case-out fold holds out exactly one case; the MLP stopped on validation loss and
  restored its best epoch; the GP coverage and interval width are recorded; the guard accepts shifted
  states less often than in-envelope ones; permutation importance covers every feature; the ONNX
  exports reproduce PyTorch and ship their scalers.
- `test_design_is_seeded_and_inside_the_envelope`, `test_protocol_splits` and
  `test_features_never_see_the_case_identity`.
- `tests/test_learning_findings.py`: every number of the findings tables above equals the record in
  `data/derived/learning.json` at the precision printed here.

## What it is not

A replacement for the engine. The surrogates learn this engine on these twelve authored plants; the
leave-one-case-out numbers say how badly they transfer to a thirteenth, which is the honest bound on
using them for a new plant. The guard detects states unlike its training features, not errors in
the engine.
