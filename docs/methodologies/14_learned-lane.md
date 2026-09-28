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

The bake of 2026-09-28 (release 0.06.000) trained and scored every model on 3072 engine states (256 per case,
CUDA for the networks). The tables are transcribed from `data/derived/learning.json`, and
`tests/test_learning_findings.py` fails if a number here and the record disagree.

| Model | Recovery: interpolation R² | Recovery: LOCO median R² | Recovery: LOCO mean RMSE (pts) | Log upgrade: interpolation R² | Log upgrade: LOCO median R² | Log upgrade: LOCO mean RMSE | Energy: interpolation R² | Energy: LOCO median R² | Energy: LOCO mean RMSE (kWh/t) |
|---|---|---|---|---|---|---|---|---|---|
| Ridge | 0.625 | 0.116 | 19.3 | 0.884 | -10.869 | 0.844 | 0.784 | 0.583 | 2.44 |
| Random forest | 0.824 | 0.564 | 13.0 | 0.996 | -1.766 | 0.268 | 0.964 | 0.928 | 1.11 |
| Gradient boosting | 0.909 | 0.714 | 13.4 | 0.997 | -1.041 | 0.229 | 0.979 | 0.957 | 0.939 |
| Gaussian process | 0.825 | 0.417 | 14.5 | 0.998 | -0.816 | 0.291 | 0.983 | 0.968 | 1.76 |
| MLP | 0.955 | 0.638 | 55.5 | 0.998 | -1.036 | 0.48 | 0.995 | 0.984 | 2.95 |

- **Interpolation and transfer rank the models differently, and the transfer ranking depends on the statistic.** Inside the
  twelve cases' envelopes the MLP explains the most recovery variance (R² 0.955). On a case it never saw,
  gradient boosting has the best median R² (0.714, mean error 13.4 points) and the random
  forest the lowest mean error (13.0 points). The MLP is second by median (0.638) and last
  by mean error (55.5 points): on the five copper sulphide plants it transfers at R² 0.95 to
  0.99, and on the three plants unlike the rest (magnetite, phosphate, gravity gold) its predictions leave 0
  to 100% (RMSE 283, 242 and 88 points). A median over twelve folds is fragile: before
  the grinding energy fix of 0.06.000 changed the design, the MLP's was 0.216.
- **The upgrade ratio does not transfer.** Every model reproduces the log upgrade within a case, the
  tree models almost exactly, and every model's leave-one-case-out median R² is below zero: the
  concentrate-to-head ratio depends on each plant's cleaner circuit and mineral system, which the
  features describe only in part.
- **Energy transfers.** Every model but ridge keeps a median R² above 0.9 on unseen cases (the MLP
  0.984, gradient boosting 0.957, mean error 0.94 kWh/t): specific energy follows throughput per megawatt,
  work index and grind, which the features carry directly.
- **The exported surrogate is the MLP**, trained on every state after evaluation (early stopping
  restored epoch 1789 of 1939). It suits fast interpolation inside the trained envelopes and not a new plant;
  the workbench's Methods view shows its answer beside the engine's, with these results and the guard's
  verdict.

| Gaussian process, interpolation split | Recovery | Log upgrade | Energy |
|---|---|---|---|
| Coverage of the nominal 95% interval | 88.2% | 90.0% | 91.8% |

The Gaussian process's nominal 95% intervals are overconfident: they cover a few points less than
95% of the held-out states for every target.

| Guard | Value |
|---|---|
| Threshold (mean squared error) | 0.388 |
| False alarms on held-out in-envelope states | 0.5% |
| False accepts on shifted probes | 18.1% |
| States of the held-out case flagged (mean over folds) | 49.8% |

| Held-out case | Flagged by the guard |
|---|---|
| Soft copper porphyry | 2.7% |
| Hard copper porphyry | 4.7% |
| Free-milling gold with gravity | 100.0% |
| Fine magnetite concentration | 100.0% |
| Nickel sulphide with serpentine slimes | 70.3% |
| Phosphate with clay slimes | 100.0% |
| Copper-molybdenum bulk flotation | 0.0% |
| Oxide copper by sulphidisation | 99.6% |
| Zinc sulphide | 19.1% |
| Copper ore with clay | 0.4% |
| Low-grade copper at high throughput | 0.4% |
| Refractory gold in sulphides | 100.0% |

**The guard does what it is for.** Its false alarms sit below the 1% its threshold implies, and it
accepts 18.1% of the probes pushed half a training range outside one feature; 89% of those it accepts
step out along the overflow water, the circulating load or the crusher setting, the inputs it barely
sees. On an unseen case its verdict is mostly bimodal: it flags every state of the gravity gold,
magnetite, phosphate and refractory gold plants, 99.6% of the oxide copper's, and at most
4.7% of the five copper sulphide plants', whose features lie among each other's; nickel
(70%) and zinc (19%) sit between. The mean over folds averages those answers; it is not
a detection rate.

| Feature (gradient boosting, recovery) | RMSE increase when permuted (pts) |
|---|---|
| `dose_ratio` | 10.55 |
| `specific_throughput_t_h_mw` | 9.01 |
| `work_index_kwh_t` | 4.77 |
| `rougher_volume_m3_per_tph` | 3.85 |
| `carrier_density_t_m3` | 2.46 |

The gradient-boosting surrogate leans on the collector dose ratio and throughput per installed megawatt, then on work index, rougher volume per t/h and the payable carrier's density: the
reagent kinetics, grinding capacity, residence and classification the engine's recovery responds to.

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
