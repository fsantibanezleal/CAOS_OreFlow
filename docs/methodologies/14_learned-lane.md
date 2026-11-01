# 14 Learned lane

![From the Sobol design to the models the browser runs.](../svg/14-learned.svg)

*From the Sobol design to the models the browser runs.*

A surrogate is a fast statistical stand-in for the engine. It is useful only if its error is known,
and the error that matters depends on the question: predicting a state near states it has seen
(interpolation), or predicting a plant it has never seen (transfer). OreFlow trains five surrogates
on engine states and measures both. A feature-reconstruction guard is evaluated against known input shifts,
with its false alarms and missed shifts retained.

## Prediction scale and sensitivity

Every model transform is fitted on its training rows. The standardizer uses the pinned
scikit-learn [StandardScaler](https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html),
including its handling of numerically constant columns. A mathematically constant decimal column can
have a tiny positive variance from floating-point roundoff; treating that as a useful scale can
amplify an unseen ore's feature by many orders of magnitude. Constant columns use unit scale.

After prediction, a separate observable check rejects non-finite answers and forecasts wholly outside
the observed target range widened by one full range on each side. The declared reference is the
full authored evaluation design for that target, including held-out target values; it is used only to interpret prediction units,
never for fitting transforms, model selection or clipping. The per-fold observed and predicted ranges,
reference and widened bounds are persisted with every score and rechecked when artifacts are validated.
The same full-design envelope applies to every method and seed in that design. This loose check is not an
accuracy criterion, training-support envelope or independent transfer validation. It does not establish physical
plausibility of every point: a fold with both an in-range point and an extreme outlier can pass its whole-range test.

A constant forecast on varying observations is identified as loss of sensitivity. It remains visible
as negative evidence beside its numerical error; the case-mean comparison is explicitly identified
as a constant baseline. Poor transfer remains in the record as a finite score or an explicit rejected diagnostic.

In `oreflow.learning/v2`, a finite transfer forecast wholly outside the widened range is retained as
`rejected-transfer`, with null RMSE, MAE and R² and unmodified range diagnostics. The check also runs separately
for every case in a grouped fold. Shape, nonfinite and fitting failures remain fatal; interpolation range
failures abort as well. Conditional means and medians count only admissible scores, with attempted/scored/rejected
denominators displayed beside them. They cannot rank models with different surviving folds. The matched
comparison instead uses exactly the folds admissible for every model and retains all excluded identifiers.
An empty admissible set has null metrics, never zero. The complete seed and case-mean baseline records are
preserved so the summaries can be independently checked.

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
RMSE with the median R², and the mean and worst one-group-out RMSE with the median R² over admissible groups.
All seven groups are attempted; a rejected group remains in the denominators and diagnostics.

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
cap (best epoch 3000), so it never stopped early. Its threshold is the 99th
percentile of the reconstruction error on the validation rows, so about 1% of those rows exceed it
by construction. The false-alarm rate is separately measured on the held-out
test states, and the false-accept rate on probes: each test state with one continuous feature moved
half a training range beyond its training maximum. In the leave-one-case-out folds the record also
gives the share of the unseen case's states that the guard flags.

**Importance.** Permutation importance (Breiman 2001; 10 repeats, RMSE scoring) of the gradient-boosting surrogate
on the interpolation test set says which features the surrogate relies on. Each feature is shuffled within each case,
not across the twelve as `sklearn.inspection.permutation_importance` would: a feature that takes one value per case
would otherwise measure which case a row came from (L-04).

**Export.** After evaluation, the MLP and the guard use the full design with internal validation rows held out from fitting, and are exported to ONNX
(opset 17, dynamic batch). ONNX Runtime must reproduce PyTorch within 1e-5 on standardized outputs
or the export fails. `models/process_surrogate.json` carries the feature and target scalers and the
guard threshold, so the browser can standardize a state, run both models and flag an out-of-envelope
one.

## Findings

The 0.10.008 learning/v2 evaluation generated 3,072 engine states (256 per case). Numerical claims are bound to the record by `tests/test_docs_claims.py::test_the_framework_pages_quote_the_learning_record` and the findings checks in `tests/test_learning_findings.py`. These are authored simulator evaluations, not measured plant validation.

### Conditional scores

Conditional means do not rank models with different surviving folds. The matched recovery comparison uses 11/12 case folds and 6/7 transfer groups, excluding magnetite for every algorithm. Null means rejected/unavailable, never zero.

A/S/R means attempted/scored/rejected. Gradient boosting in the tables is histogram gradient boosting. The first two tables report each model's own admissible folds, not a complete-design ranking. RMSE uses percentage points for recovery, a dimensionless log10 ratio for upgrade and kWh/t for energy; R² is dimensionless.

| Conditional recovery model | LOCO A/S/R | Transfer A/S/R |
|---|---|---|
| Ridge | 12/12/0 | 7/7/0 |
| Random forest | 12/12/0 | 7/7/0 |
| Gradient boosting | 12/12/0 | 7/7/0 |
| Gaussian process | 12/12/0 | 7/7/0 |
| MLP | 12/11/1 | 7/6/1 |

For log upgrade and energy, every model retains 12/12/0 case folds and 7/7/0 transfer groups. For MLP recovery, the missing score is magnetite, not a zero error.

| Model | Recovery: interpolation R² | Recovery: LOCO median R² | Recovery: LOCO mean RMSE (pts) | Log upgrade: interpolation R² | Log upgrade: LOCO median R² | Log upgrade: LOCO mean RMSE | Energy: interpolation R² | Energy: LOCO median R² | Energy: LOCO mean RMSE (kWh/t) |
|---|---|---|---|---|---|---|---|---|---|
| Ridge | 0.617 | -0.127 | 13.68 | 0.761 | -7.092 | 0.83 | 0.794 | 0.652 | 2.19 |
| Random forest | 0.820 | 0.359 | 13.16 | 0.995 | -4.047 | 0.28 | 0.964 | 0.900 | 1.13 |
| Gradient boosting | 0.909 | 0.512 | 12.66 | 0.996 | -1.116 | 0.27 | 0.978 | 0.952 | 0.92 |
| Gaussian process | 0.878 | 0.481 | 10.95 | 0.998 | -0.769 | 0.30 | 0.982 | 0.933 | 1.36 |
| MLP | 0.951 | 0.573 | 6.86 | 0.997 | 0.243 | 0.43 | 0.992 | 0.943 | 0.85 |

| Model, within case and one group out | Recovery: within-case R² | Recovery: group median R² | Recovery: group mean RMSE (pts) | Log upgrade: within-case R² | Log upgrade: group median R² | Log upgrade: group mean RMSE | Energy: within-case R² | Energy: group median R² | Energy: group mean RMSE (kWh/t) |
|---|---|---|---|---|---|---|---|---|---|
| Ridge | 0.498 | -0.774 | 15.99 | -3.066 | -76.906 | 1.27 | 0.599 | 0.617 | 2.42 |
| Random forest | 0.764 | 0.129 | 16.86 | 0.913 | -6.800 | 0.50 | 0.929 | 0.881 | 1.36 |
| Gradient boosting | 0.881 | 0.287 | 17.40 | 0.936 | -6.372 | 0.49 | 0.957 | 0.904 | 1.18 |
| Gaussian process | 0.840 | 0.171 | 13.37 | 0.959 | -10.854 | 0.52 | 0.965 | 0.907 | 1.78 |
| MLP | 0.936 | 0.455 | 14.60 | 0.957 | -13.623 | 0.79 | 0.985 | 0.887 | 1.22 |

### Matched cohorts

All algorithms below are evaluated on identical fold IDs for each target. Recovery excludes magnetite for every model, even those retaining a finite magnetite score. Log upgrade and energy retain the full case and transfer sets.

| Matched protocol/target | Attempted | Scored together | Excluded identifiers |
|---|---|---|---|
| leave_one_case_out/recovery_pct | 12 | 11 | iron_magnetite_fine |
| leave_one_case_out/log_upgrade | 12 | 12 | none |
| leave_one_case_out/specific_energy_total_kwh_t | 12 | 12 | none |
| transfer/recovery_pct | 7 | 6 | Fe:magnetite |
| transfer/log_upgrade | 7 | 7 | none |
| transfer/specific_energy_total_kwh_t | 7 | 7 | none |

| Matched LOCO model | Recovery mean RMSE (pp) | Recovery median R² | Log-upgrade mean RMSE | Log-upgrade median R² | Energy mean RMSE (kWh/t) | Energy median R² |
|---|---|---|---|---|---|---|
| Ridge | 13.01 | 0.013 | 0.83 | -7.092 | 2.19 | 0.652 |
| Random forest | 9.92 | 0.430 | 0.28 | -4.047 | 1.13 | 0.900 |
| Gradient boosting | 8.67 | 0.581 | 0.27 | -1.116 | 0.92 | 0.952 |
| Gaussian process | 9.40 | 0.498 | 0.30 | -0.769 | 1.36 | 0.933 |
| MLP | 6.86 | 0.573 | 0.43 | 0.243 | 0.85 | 0.943 |

| Matched transfer model | Recovery mean RMSE (pp) | Recovery median R² | Log-upgrade mean RMSE | Log-upgrade median R² | Energy mean RMSE (kWh/t) | Energy median R² |
|---|---|---|---|---|---|---|
| Ridge | 15.15 | -0.638 | 1.27 | -76.906 | 2.42 | 0.617 |
| Random forest | 11.53 | 0.209 | 0.50 | -6.800 | 1.36 | 0.881 |
| Gradient boosting | 10.87 | 0.365 | 0.49 | -6.372 | 1.18 | 0.904 |
| Gaussian process | 10.95 | 0.318 | 0.52 | -10.854 | 1.78 | 0.907 |
| MLP | 14.60 | 0.455 | 0.79 | -13.623 | 1.22 | 0.887 |

The matched tables describe those included cases and ore groups only. The MLP's conditional recovery mean is not evidence for its rejected magnetite case. The separate chalcopyrite group has MLP recovery R² 0.795; the gold-in-pyrite group has -10.200. No algorithm has positive median group-held-out log-upgrade R².

### Recovery folds and rejection evidence

| Recovery held-out case ID | Status | Rows | RMSE (percentage points) | Affected rows |
|---|---|---|---|---|
| copper_porphyry_soft | scored | 256 | 5.98 | none |
| copper_porphyry_hard | scored | 256 | 1.72 | none |
| gold_free_milling | scored | 256 | 12.76 | none |
| iron_magnetite_fine | rejected-transfer | 256 | null | 256 |
| nickel_sulphide | scored | 256 | 6.61 | none |
| phosphate_clay | scored | 256 | 8.93 | none |
| copper_molybdenum | scored | 256 | 1.91 | none |
| copper_oxide | scored | 256 | 11.60 | none |
| zinc_sulfide | scored | 256 | 7.26 | none |
| mixed_ore_high_clay | scored | 256 | 6.57 | none |
| low_grade_copper | scored | 256 | 2.23 | none |
| refractory_gold | scored | 256 | 9.86 | none |

Observed recovery: 68.93 to 93.32%. Predictions: -195.41 to -127.94%. Full-design reference: 3.50 to 99.94%. Widened bounds: -92.94 to 196.38%.

The full-design range check includes held-out target labels and runs only after inference. Passing it does not establish physical validity at every row or independent transfer performance.

### Neural seeds

| Recovery seed | Magnetite status | Magnetite RMSE (pp) | LOCO A/S/R | Conditional mean RMSE (pp) | Matched 11-fold mean RMSE (pp) |
|---|---|---|---|---|---|
| 20260927 | rejected-transfer | null | 12/11/1 | 6.86 | 6.86 |
| 20260938 | rejected-transfer | null | 12/11/1 | 7.37 | 7.37 |
| 20260949 | rejected-transfer | null | 12/11/1 | 7.63 | 7.63 |
| 20260960 | rejected-transfer | null | 12/11/1 | 7.44 | 7.44 |
| 20260971 | scored | 217.18 | 12/12/0 | 25.05 | 7.58 |

Four of five neural seeds reject magnetite recovery. Seed 20260971 remains scored with RMSE 217.18 percentage points: its predictions span -172.05 to -88.68%, overlapping the widened envelope at its upper end despite being negative. This is retained poor finite evidence, not a successful physical prediction. The first four conditional means cover eleven folds; the fifth covers twelve. The matched seed column uses the same eleven non-magnetite folds for every seed.

Interpolation recovery RMSE spans 3.00 to 3.54 percentage points on the same interpolation split. The seed-specific conditional LOCO means must not be presented as a common-cohort range.

### Coverage, guard and final fit

| GP coverage target | Interpolation coverage (%) | Pooled LOCO coverage (%) | Scored LOCO rows |
|---|---|---|---|
| recovery_pct | 90.7 | 82.9 | 3072 |
| log_upgrade | 91.3 | 67.8 | 3072 |
| specific_energy_total_kwh_t | 93.6 | 86.8 | 3072 |

The intervals are centred on GP means, not MLP predictions. Coverage is empirical and uses 612 interpolation rows and all 3072 held-out-case rows; these intervals remain below nominal 95% coverage and do not establish plant calibration.

The reconstruction guard's held-out false-alarm rate is 1.47% and its false-accept rate is 15.5% over 11,016 shifted probes (612 in-envelope test rows). At +0.5 input ranges it accepts 15.5%; at -0.5, 19.9%. Acceptance varies by feature: crusher CSS 95.4%, water 68.8% and circulating load 41.8%. A reconstruction score is a diagnostic, not an operating constraint or physical-safety certificate.

The final surrogate uses the 3072-state design (2611 fitting and 461 validation rows); it reached its 3000-epoch cap with best validation loss at epoch 2992, on CUDA. Its exported ONNX maximum absolute difference is 0.00000155 in standardized outputs, below the 1e-05 export tolerance. Export parity checks execution, not field transfer.

| Guard | Value |
|---|---|
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
|---|---|---|---|
| Coverage of the nominal 95% interval | 90.7% | 91.3% | 93.6% |

| Feature (gradient boosting, recovery) | Permutation importance |
|---|---|
| `dose_ratio` | 6.0671 |
| `specific_throughput_t_h_mw` | 4.4982 |
| `work_index_kwh_t` | 2.9978 |
| `rougher_volume_m3_per_tph` | 2.5465 |
| `crusher_css_mm` | 1.1307 |

The guard fit ran to the 3000-epoch cap (best epoch 3000).

## Verification

- `tests/test_learning.py::test_protocols_and_model_identity` (PE-29), on a sandbox design of three
  cases: the recorded classes are Ridge, RandomForestRegressor, HistGradientBoostingRegressor and
  GaussianProcessRegressor; admissible scores remain finite and rejected transfers keep null metrics and diagnostics; each
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
numbers describe only these authored held-out ores and do not establish performance on a thirteenth plant, and the one-case-out numbers are the easier case of a new plant on a known ore. The guard detects states unlike its training features, not errors in
the engine.
