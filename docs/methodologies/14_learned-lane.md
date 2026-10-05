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

The precompute of release 0.09.000 trained and scored every model on 3072 engine states (256 per case, CUDA for
the networks). The tables are transcribed from `data/derived/learning.json`, and `tests/test_learning_findings.py`
fails if a number here and the record disagree.

| Model | Recovery: interpolation R² | Recovery: LOCO median R² | Recovery: LOCO mean RMSE (pts) | Log upgrade: interpolation R² | Log upgrade: LOCO median R² | Log upgrade: LOCO mean RMSE | Energy: interpolation R² | Energy: LOCO median R² | Energy: LOCO mean RMSE (kWh/t) |
|---|---|---|---|---|---|---|---|---|---|
| Ridge | 0.643 | 0.348 | 16.1 | 0.884 | -5.693 | 0.655 | 0.784 | 0.598 | 2.44 |
| Random forest | 0.828 | 0.310 | 13.6 | 0.996 | -3.438 | 0.223 | 0.961 | 0.923 | 1.14 |
| Gradient boosting | 0.917 | 0.581 | 13.9 | 0.997 | -1.566 | 0.177 | 0.978 | 0.955 | 0.94 |
| Gaussian process | 0.838 | 0.435 | 14.2 | 0.997 | -0.808 | 0.296 | 0.979 | 0.968 | 1.69 |
| MLP | 0.946 | 0.694 | 60.1 | 0.997 | -1.619 | 0.459 | 0.993 | 0.963 | 4.60 |

LOCO is one case out. The second table scores the same models within each case (R² against each case's own mean on
the interpolation split) and with a whole ore group held out (median over the seven groups; mean RMSE).

| Model, within case and one group out | Recovery: within-case R² | Recovery: group median R² | Recovery: group mean RMSE (pts) | Log upgrade: within-case R² | Log upgrade: group median R² | Log upgrade: group mean RMSE | Energy: within-case R² | Energy: group median R² | Energy: group mean RMSE (kWh/t) |
|---|---|---|---|---|---|---|---|---|---|
| Ridge | 0.537 | -0.891 | 21.1 | -0.974 | -27.694 | 1.10 | 0.582 | 0.538 | 2.87 |
| Random forest | 0.777 | -0.004 | 17.7 | 0.932 | -6.848 | 0.422 | 0.925 | 0.851 | 1.35 |
| Gradient boosting | 0.893 | -0.208 | 20.3 | 0.949 | -2.432 | 0.333 | 0.958 | 0.911 | 1.18 |
| Gaussian process | 0.790 | -1.535 | 19.9 | 0.941 | -1.746 | 0.431 | 0.960 | 0.907 | 2.43 |
| MLP | 0.930 | -0.974 | 107 | 0.941 | -16.083 | 0.880 | 0.986 | 0.934 | 7.98 |

The MLP's figures are one training seed's. The record also retrains it with four more seeds on every one-case
split (`mlp_seeds`); over the five, its interpolation RMSE of recovery runs from 2.7 to 4.2 points and its mean
one-case-out RMSE from 26.7 to 60.1 points, so the MLP row above is the worst of its five seeds by that statistic.
The Gaussian process is fitted on a seeded 500-state subsample of the 2,460 interpolation training states; on the
same 500 states (`equal_rows`) the random forest and gradient boosting interpolate recovery with an R² of 0.700 and
0.820, against the Gaussian process's 0.838, so part of the ranking above is training-set size.

- **Most of the interpolation score is knowing the case.** A predictor that returns each case's training mean
  reaches a pooled R² of 0.200 for recovery, 0.938 for the log upgrade and 0.475 for energy: the case alone explains
  94% of the upgrade's test variance. Against each case's own mean, ridge's upgrade R² is -0.974, so its pooled 0.884
  is below the predictor that knows only the case, while the tree models and the networks keep 0.93 to 0.95; for
  recovery the MLP keeps 0.930 within case and gradient boosting 0.893. Until 0.09.000 only the pooled figures were
  recorded (review of 2026-10-04, L-03).
- **One case out is a near-neighbour test for the copper plants; one ore group out is transfer.** Held out one at a
  time, each chalcopyrite plant is predicted from its four siblings, and the MLP's recovery R² there is 0.96 to 0.99
  (RMSE 1.7 to 3.5 points over its five seeds). Held out together, with no chalcopyrite plant left in training, the
  Gaussian process scores R² 0.665 (9.1 points) and the MLP 0.572 (10.3 points); for the two gold-in-pyrite plants
  held out together gradient boosting and the forest score 0.37 and 0.35 (about 11 points) and the MLP fails (R²
  -16.3). Over the seven ore groups no model keeps a positive median recovery R², the random forest coming closest
  (-0.004, mean error 17.7 points). Those are the transfer figures; the one-case-out medians (0.31 to 0.69) describe
  a new plant on an ore the lane already knows (L-01).
- **On the plants unlike the rest the networks leave 0 to 100%:** the MLP's recovery RMSE is 172 to 223 points on the
  magnetite plant and 20 to 472 on the phosphate plant over its seeds. The MLP has the best one-case-out median R²
  (0.694); by mean error the random forest and gradient boosting cannot be told apart (13.6 and 13.9 points): the
  forest is better in 4 of the 12 folds, the magnetite, nickel, phosphate and oxide copper plants.
- **The upgrade ratio transfers between siblings and not across ores.** Every model's median R² over the twelve
  one-case folds is below zero, because R² on one held-out case divides by that case's own spread and the two gold
  plants' upgrade barely varies. Over the five chalcopyrite plants held out one at a time the median R² is 0.95 for
  the MLP, 0.94 for gradient boosting and 0.91 for the Gaussian process (0.65 for the forest, -0.38 for ridge); held
  out as a group it does not transfer, with R² from -0.15 (MLP) and -0.24 (Gaussian process) to -20 (ridge).
- **Energy transfers for most models and folds.** Every model but ridge keeps a median R² above 0.9 with one case out
  (gradient boosting 0.955, mean error 0.94 kWh/t) and 0.85 to 0.93 with a whole ore group out: specific energy
  follows throughput per megawatt, work index and grind, which the features carry directly. The exception is the
  held-out phosphate circuit, where the Gaussian process's R² is -16.7 and the MLP's -699 at the record's seed; the
  MLP's mean energy error over its five seeds runs from 0.9 to 4.6 kWh/t.
- **The exported surrogate is the MLP**, trained on every state after evaluation (early stopping restored epoch 2950
  of 3000). It suits fast interpolation inside the trained envelopes and not a new plant, and the target mode only;
  the workbench's Methods view shows its answer beside the engine's, with these results and the guard's verdict, and
  declines a cut-mode state.

| Gaussian process, interpolation split | Recovery | Log upgrade | Energy |
|---|---|---|---|
| Coverage of the nominal 95% interval | 86.1% | 89.7% | 91.3% |

The Gaussian process's nominal 95% intervals are overconfident under interpolation, and more so under one case out,
where they cover 76.6, 64.2 and 94.3% of the held-out states (2.0%, 0.4% and 70.3% in the worst fold). Its
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
porphyry is flagged in 3.9% of its states while gradient boosting's upgrade R² there is -2.05. The mean over folds
averages those answers; it is not a detection rate.

| Feature (gradient boosting, recovery) | RMSE increase when permuted within each case (pts) |
|---|---|
| `dose_ratio` | 6.49 |
| `specific_throughput_t_h_mw` | 4.98 |
| `work_index_kwh_t` | 3.52 |
| `rougher_volume_m3_per_tph` | 3.13 |
| `grind_to_liberation` | 1.16 |

The importance is the RMSE increase when a feature's values are shuffled within each case. A feature that takes one
value per case, the payable carrier's composite content and density and the circuit descriptors, is constant within
every case and scores exactly 0: the surrogate never saw the engine respond to it, and shuffling it across the cases,
as the record did until 0.09.000, measured which case a row came from and read it as liberation (review of
2026-10-04, L-04). Within the cases the surrogate leans on the collector dose ratio and throughput per installed
megawatt, then on work index, rougher volume per t/h and the grind relative to the liberation size: the reagent
kinetics, grinding capacity, residence and liberation the engine's recovery responds to.

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
