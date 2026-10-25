# 14 Learned lane

![From the Sobol design to the models the browser runs.](../svg/14-learned.svg)

*From the Sobol design to the models the browser runs.*

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
is never a feature, so a held-out case is predicted from its physics, not recalled from a label
(`tests/test_learning.py::test_features_never_see_the_case_identity` renames a case and checks the features do not
change). Holding one case out is still a near-neighbour test when its siblings share its ore: the five chalcopyrite
cases carry the same mineral, four of them with the same liberation size and composite content, and the fifth inside
the design's own perturbation of them. Transfer is therefore measured by holding a whole ore group out, the cases that
share their primary payable and the carrier holding most of it: the five chalcopyrite cases, the two gold-in-pyrite
cases, and each other case alone (`learning.transfer_groups`). One case out is reported beside it as the near-neighbour
figure. Until 0.09.000 this page called one case out "transfer to an unseen ore and plant" (review of 2026-10-04,
L-01).

| Feature | Meaning |
|---|---|
| `log_payable_fraction` | log10 of the head grade as a mass fraction |
| `specific_throughput_t_h_mw` | throughput per installed megawatt of mill power |
| `target_p80_um`, `circulating_load`, `water_m3_t`, `crusher_css_mm`, `work_index_kwh_t` | the operating inputs |
| `carrier_liberation_um`, `grind_to_liberation` | share-weighted liberation size of the payable's carriers that have one, and the grind target over it |
| `carrier_composite_content`, `carrier_density_t_m3`, `carrier_floatability` | share-weighted properties of the same carriers |
| `dose_ratio` | collector dose over the carriers' half-response dose |
| `jg_cm_s`, `rougher_cells`, `rougher_volume_m3_per_tph` | rougher gas velocity, cells, and cell volume times cells per t/h |
| `gravity_bleed`, `deslime_cut_um` | family levers, zero where absent |
| `has_flotation`, `has_gravity`, `has_magnetic`, `has_desliming` | circuit descriptors |

The carrier features weight only the carriers with a declared liberation size, renormalised: a liberation size has no
meaning for gravity grains, so electrum (45% of the gold case's gold) and chrysocolla (10% of the oxide copper's
copper) are left out, and the gravity gold enters through `has_gravity` and `gravity_bleed` (review of 2026-10-04,
L-05, which found this table saying "the payable's carriers" without the rule). The features do not carry the
classifier cut: the lane describes the target mode, so the workbench's surrogate declines a cut-mode state instead of
answering it with the nominal state's prediction (L-02), as the optimizer's screen already did.

The targets are the overall recovery (%), the log10 upgrade ratio $\log_{10}(G_c/G_f)$ (concentrate
over head grade, which is unit-free and comparable between a copper, a gold and an iron circuit),
and the total specific energy (kWh/t).

## Protocols

- **Interpolation**: a seeded 80/20 split inside every case, so every case is in both sets. It is scored pooled and
  against each case's own mean, beside a predictor that returns each case's training mean (L-03).
- **Leave-one-case-out**: each of the twelve cases is held out in turn; the models that predict it
  never saw any of its states, but plants on the same ore may stay in training.
- **Leave-one-ore-group-out**: the cases that share a payable and its dominant carrier mineral are held out together:
  the five chalcopyrite plants (1792 training and 1280 test rows), the two gold plants with most of their gold in pyrite
  (2560 and 512), and each of the other five alone, where the fold is its one-case fold; seven groups in all. This is
  the transfer protocol: with one case out, a chalcopyrite plant is predicted from its four siblings (L-01).

Each model is scored with RMSE, MAE and R² per target and protocol; the summary reports the
interpolation RMSE and R² (pooled and within case) with the case-mean baseline, the mean and worst leave-one-case-out
RMSE with the median R², and the mean and worst one-group-out RMSE with the median R² over the seven groups.

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

**Importance.** Permutation importance (Breiman 2001; 10 repeats, RMSE scoring) of the gradient-boosting surrogate
on the interpolation test set says which features the surrogate relies on. Each feature is shuffled within each case,
not across the twelve as `sklearn.inspection.permutation_importance` would: a feature that takes one value per case
would otherwise measure which case a row came from (L-04).

**Export.** After evaluation, the MLP and the guard are trained on every state and exported to ONNX
(opset 17, dynamic batch). ONNX Runtime must reproduce PyTorch within 1e-5 on standardized outputs
or the export fails. `models/process_surrogate.json` carries the feature and target scalers and the
guard threshold, so the browser can standardize a state, run both models and flag an out-of-envelope
one.

## Findings

The release 0.10.000 precompute generated the record from 3,072 engine states (256 per case). The tables below are checked against `data/derived/learning.json` by `tests/test_learning_findings.py`.

| Model | Recovery: interpolation R² | Recovery: LOCO median R² | Recovery: LOCO mean RMSE (pts) | Log upgrade: interpolation R² | Log upgrade: LOCO median R² | Log upgrade: LOCO mean RMSE | Energy: interpolation R² | Energy: LOCO median R² | Energy: LOCO mean RMSE (kWh/t) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Ridge | 0.617 | -0.13 | 13.68 | 0.761 | -7.09 | 0.83 | 0.794 | 0.65 | 2.19 |
| Random forest | 0.820 | 0.36 | 13.16 | 0.995 | -4.05 | 0.28 | 0.964 | 0.90 | 1.13 |
| Gradient boosting | 0.909 | 0.51 | 12.66 | 0.996 | -1.12 | 0.27 | 0.978 | 0.95 | 0.92 |
| Gaussian process | 0.878 | 0.48 | 10.95 | 0.998 | -0.77 | 0.30 | 0.982 | 0.93 | 1.35 |
| MLP | 0.951 | 0.55 | 26.24 | 0.997 | 0.24 | 0.43 | 0.992 | 0.94 | 0.85 |

LOCO means leave one authored case out. The model with the lowest pooled interpolation recovery error is MLP (3.38 points); the Gaussian process has the lowest mean LOCO error (10.95 points). The MLP has the largest mean and worst-fold LOCO errors because the magnetite case is far outside the other cases' response. Across five MLP seeds, interpolation RMSE ranges 3.00 to 3.54 points and mean LOCO RMSE ranges 25.0 to 30.1 points. No model ranking should be collapsed across these distinct metrics.

The second table reports within-case interpolation and the record's group transfer summary across seven payable/carrier labels:

| Model, within case and one group out | Recovery: within-case R² | Recovery: group median R² | Recovery: group mean RMSE (pts) | Log upgrade: within-case R² | Log upgrade: group median R² | Log upgrade: group mean RMSE | Energy: within-case R² | Energy: group median R² | Energy: group mean RMSE (kWh/t) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Ridge | 0.50 | -0.77 | 15.99 | -3.07 | -76.91 | 1.27 | 0.60 | 0.62 | 2.42 |
| Random forest | 0.76 | 0.13 | 16.86 | 0.91 | -6.80 | 0.50 | 0.93 | 0.88 | 1.36 |
| Gradient boosting | 0.88 | 0.29 | 17.40 | 0.94 | -6.37 | 0.49 | 0.96 | 0.90 | 1.18 |
| Gaussian process | 0.84 | 0.17 | 13.37 | 0.96 | -10.85 | 0.52 | 0.97 | 0.91 | 1.78 |
| MLP | 0.94 | 0.44 | 46.73 | 0.96 | -13.62 | 0.79 | 0.99 | 0.89 | 1.22 |

Only the two multi-case ore labels can be held out as a group in a separate fold. The other five labels each contain one authored case and are represented by their case-held-out fold; the transfer summary therefore uses all seven labels without pretending that five singleton labels form additional multi-case folds. On the five chalcopyrite cases held out together, MLP recovery R² is 0.795; on the two gold-in-pyrite cases it is -10.200. Their contrast prevents the group median from being read as a universal transfer guarantee. Group-held-out log-upgrade median R² is negative for each model.

The Gaussian process 95% intervals cover 90.7% of interpolation recovery, 91.3% of upgrades and 93.8% of energy rows. Pooled LOCO coverage is 82.9%, 68.1% and 86.9%, respectively. These are empirical coverages of nominal 95% intervals and are below nominal; the artifacts do not establish calibration on measured plant data.

The reconstruction guard's held-out false-alarm rate is 1.47% and its false-accept rate over shifted probes is 15.5%. At +0.5 input ranges, it accepts 15.5%; at -0.5, 19.9%. Accepted shifts vary by feature: crusher CSS 95.4%, water 68.8%, and circulating load 41.8%. It is a diagnostic signal, not an operating constraint.

The exported MLP is finally fitted on the full design and trained on CUDA. ONNX parity remains bounded by the record's maximum absolute differences; the learned outputs screen or illustrate an engine result and do not replace it. In particular, the tests do not validate transfer to an operating plant.

| Guard | Value |
|---|---:|
| Threshold of the interpolation-split guard (mean squared error) | 0.392 |
| Threshold of the exported guard, fitted on every state | 0.372 |
| False alarms on held-out in-envelope states | 1.5% |
| False accepts on shifted probes | 15.5% |
| States of the held-out case flagged (mean over folds) | 55.0% |

| Held-out case | Flagged by the guard |
|---|---:|
| Soft copper porphyry | 16.0% |
| Hard copper porphyry | 3.1% |
| Free-milling gold with gravity | 63.7% |
| Fine magnetite concentration | 100.0% |
| Nickel sulphide with serpentine slimes | 70.7% |
| Phosphate with clay slimes | 100.0% |
| Copper-molybdenum bulk flotation | 0.0% |
| Oxide copper: assumed sulphidized response | 100.0% |
| Zinc sulphide | 9.4% |
| Copper ore with clay | 95.3% |
| Low-grade copper at high throughput | 1.6% |
| Refractory gold in sulphides | 100.0% |

| Gaussian process, interpolation split | Recovery | Log upgrade | Energy |
|---|---:|---:|---:|---:|
| Coverage of the nominal 95% interval | 90.7% | 91.3% | 93.8% |

| Feature (gradient boosting, recovery) | Permutation importance |
|---|---:|
| `dose_ratio` | 6.0671 |
| `specific_throughput_t_h_mw` | 4.4982 |
| `work_index_kwh_t` | 2.9978 |
| `rougher_volume_m3_per_tph` | 2.5465 |
| `crusher_css_mm` | 1.1307 |

The guard fit ran to the 3000-epoch cap (best epoch 3000).

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

A replacement for the engine. The surrogates learn this engine on these twelve authored plants; the one-ore-group-out
numbers say how badly they transfer to a thirteenth whose ore none of them shares, which is the honest bound on using
them for a new plant, and the one-case-out numbers are the easier case of a new plant on a known ore. The guard detects states unlike its training features, not errors in
the engine.
