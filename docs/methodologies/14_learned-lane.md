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
reconstruct standardized training features, with the same early stopping. Its threshold is the 99th
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

The bake of 2026-09-26 trained and scored every model on 3072 engine states (256 per case,
CUDA for the networks). The tables are transcribed from `data/derived/learning.json`, and
`tests/test_learning_findings.py` fails if a number here and the record disagree.

| Model | Recovery: interpolation R² | Recovery: LOCO median R² | Recovery: LOCO mean RMSE (pts) | Log upgrade: interpolation R² | Log upgrade: LOCO median R² | Log upgrade: LOCO mean RMSE | Energy: interpolation R² | Energy: LOCO median R² | Energy: LOCO mean RMSE (kWh/t) |
|---|---|---|---|---|---|---|---|---|---|
| Ridge | 0.678 | 0.531 | 18.5 | 0.885 | -14.358 | 1.27 | 0.805 | -0.204 | 5.78 |
| Random forest | 0.834 | 0.606 | 12.1 | 0.997 | -0.218 | 0.18 | 0.963 | 0.858 | 1.44 |
| Gradient boosting | 0.909 | 0.749 | 11.8 | 0.998 | -0.883 | 0.15 | 0.974 | 0.887 | 1.33 |
| Gaussian process | 0.837 | 0.496 | 13.3 | 0.999 | -2.420 | 0.26 | 0.980 | 0.508 | 3.04 |
| MLP | 0.968 | 0.216 | 42.1 | 0.998 | -0.494 | 0.65 | 0.992 | 0.697 | 3.67 |

- **Interpolation is easy; transfer is not.** Inside the twelve cases' envelopes every model but ridge
  explains more than four fifths of the recovery variance, the MLP most of all. On a case it never saw,
  gradient boosting keeps the best median R² with a mean error near twelve recovery points, while the
  MLP, the best interpolator, falls the furthest: it has learned these plants, not flotation.
- **The upgrade ratio does not transfer.** Every model reproduces the log upgrade within a case, the
  tree models almost exactly, and every model's leave-one-case-out median R² is below zero: the
  concentrate-to-head ratio depends on each plant's cleaner circuit and mineral system, which the
  features describe only in part.
- **Energy transfers.** The forest and gradient boosting keep a median R² near 0.9 on unseen cases,
  with a mean error of about 1.3 to 1.4 kWh/t: specific energy follows throughput per megawatt, work
  index and grind, which the features carry directly.
- **The exported surrogate is the MLP**, trained on every state after evaluation (early stopping
  restored epoch 1804 of 1954). It suits fast interpolation inside the trained envelopes and not a new plant;
  the workbench's Methods view shows its answer beside the engine's, with these results and the guard's
  verdict.

| Gaussian process, interpolation split | Recovery | Log upgrade | Energy |
|---|---|---|---|
| Coverage of the nominal 95% interval | 89.2% | 92.0% | 95.6% |

The Gaussian process's nominal 95% intervals are slightly overconfident for recovery and close to
nominal for energy.

| Guard | Value |
|---|---|
| Threshold (mean squared error) | 0.363 |
| False alarms on held-out in-envelope states | 1.3% |
| False accepts on shifted probes | 17.0% |
| States of the held-out case flagged (mean over folds) | 42.8% |

| Held-out case | Flagged by the guard |
|---|---|
| Soft copper porphyry | 0.4% |
| Hard copper porphyry | 0.4% |
| Free-milling gold with gravity | 100.0% |
| Fine magnetite concentration | 100.0% |
| Nickel sulphide with serpentine slimes | 10.9% |
| Phosphate with clay slimes | 100.0% |
| Copper-molybdenum bulk flotation | 0.0% |
| Oxide copper by sulphidisation | 100.0% |
| Zinc sulphide | 1.6% |
| Copper ore with clay | 0.4% |
| Low-grade copper at high throughput | 0.4% |
| Refractory gold in sulphides | 100.0% |

**The guard does what it is for.** Its false alarms sit near the 1% its threshold implies, and it
accepts about a sixth of the probes pushed half a training range outside one feature. On an unseen
case its verdict is bimodal: it flags every state of the five plants unlike any other (gravity gold,
magnetite, phosphate with desliming, oxide copper by sulphidisation, refractory gold) and almost none
of the copper sulphide cases, whose features lie among the other copper plants'. The mean over folds is
the average of those two correct answers, not a middling detection rate.

| Feature (gradient boosting, recovery) | RMSE increase when permuted (pts) |
|---|---|
| `specific_throughput_t_h_mw` | 10.31 |
| `dose_ratio` | 10.12 |
| `work_index_kwh_t` | 4.74 |
| `grind_to_liberation` | 4.24 |
| `rougher_volume_m3_per_tph` | 3.85 |

The gradient-boosting surrogate leans on throughput per installed megawatt and the collector dose
ratio, then on work index, grind relative to liberation and rougher volume per t/h: the grinding
capacity, reagent kinetics, liberation and residence the engine's recovery responds to.

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
