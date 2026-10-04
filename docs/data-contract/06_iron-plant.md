# 06 Iron-plant soft sensor (Kaggle 6294)

The input and the record of the iron-plant soft sensor. What the lane forecasts, its protocol and its results are
[methodology page 16](../methodologies/16_industrial-soft-sensor.md); this page states the fields, what is refused
and what is recorded.

## Source file

| Item | Value |
|---|---|
| Dataset | "Quality Prediction in a Mining Process", Eduardo Magalhaes Oliveira on Kaggle, dataset 6294, version 1, CC0 |
| Archive | saved as `data/raw/iron-flotation-kaggle-v1.zip` (ignored by git); its one member is `MiningProcess_Flotation_Plant_Database.csv` |
| Pin | SHA-256 of the archive `fa1fb0c928d84366ec1bd315e0ed1380f5d5576525603458b49ea4cfe446d98e`; the record also keeps the SHA-256 of the CSV |
| Fetched by | `data-pipeline/run_iron_plant.py` itself when the archive is missing, with the same pin; `scripts/fetch-data` does not fetch it |
| Run by | `data-pipeline/run_iron_plant.py`, from `scripts/precompute` |

## Input fields

The CSV has 737,453 rows and 24 columns, with a comma as the decimal separator.

| Column | Unit | Role |
|---|---|---|
| `date` | hour | the nominal hour of the row (about 180 rows per hour); groups the rows and orders the windows; never a feature |
| `% Iron Feed`, `% Silica Feed` | % | features |
| `Starch Flow`, `Amina Flow` | as published | features (reagents) |
| `Ore Pulp Flow`, `Ore Pulp pH`, `Ore Pulp Density` | as published | features (pulp) |
| `Flotation Column 01 Air Flow` to `07 Air Flow` | as published | features |
| `Flotation Column 01 Level` to `07 Level` | as published | features |
| `% Iron Concentrate` | % | the laboratory iron assay; shown with an hour, never a feature |
| `% Silica Concentrate` | % | the laboratory silica assay: the target one hour ahead, and the "previous assay" input of the persistence and lab-conditioned models |

## What is refused, excluded or marked

- An archive whose SHA-256 differs, an archive with any other member, a CSV whose shape is not 737,453 by 24, a
  missing date or assay column, a feature count other than 21, or any missing value in a feature or the target stops
  the run.
- An hour whose silica label changes inside the hour was interpolated, not measured, and is excluded whole: 310 of
  the 4,097 nominal hours (55,800 rows).
- Each remaining hour becomes the median of each sensor; a pair is formed only between exact consecutive valid hours,
  hour $t$'s sensors predicting the silica of hour $t+1$ (3,701 pairs). No pair at all stops the run.
- A run of three or more consecutive valid hours with one silica label is a held run (46 runs, 421 hours): those hours
  are kept, every pair that touches one is marked, and every score is also reported without them.
- A forward window with fewer than 200 training or 100 test pairs, or less than 24 hours between its last training
  pair and its first test pair, stops the run.

## Record: `data/derived/source/iron_plant_soft_sensor.json`

| Field | Content |
|---|---|
| `schema` | `oreflow.iron-plant-soft-sensor/v1` |
| `source` | title, URL, publisher, dataset id, version, license, the archive and CSV SHA-256, the first and last date |
| `quality` | `source_rows`, `nominal_hours`, `rows_per_hour_min` and `_max`, `constant_lab_hours`, `changing_lab_hours_excluded`, `changing_lab_rows_excluded`, `changing_lab_first_hour` (null when none), `gap_hours` |
| `protocol` | the target, the 21 `features`, `excluded_features`, `pair_rows`, the bootstrap, the sampling, the splits, the interpretation and the caveat that the previous assay's reporting latency is not established |
| `pooled_scores` | per model, over the three test windows: `mae_pct_points`, `rmse_pct_points`, `bias_pct_points`, `r2` |
| `comparisons` | eight paired differences (`a` minus `b`, MAE and RMSE) with a 95% interval from 4,000 resamples of whole calendar days (seed 20261002): ridge with the previous assay against the fitted last assay and against persistence, the fitted last assay against persistence, and ridge against the training mean |
| `repeated_assay_share` | the share of test pairs whose next assay equals the current one, which persistence scores as zero error |
| `held_labels` | the held-run rule and counts (`run_hours_min`, `repeated_label_hours`, `repeated_both_assays_hours`, `held_runs`, `held_hours`, `longest_run_hours`, `longest_run_first_hour`, `longest_run_silica_pct`), `pairs_touching`, `pairs_without`, and `pooled_scores_without`, `comparisons_without` and `repeated_assay_share_without` on the pairs that touch none |
| `folds[]` | per forward window: `id`, the training and test row counts and boundaries, `embargo_hours_min`, the fitted last assay's `ar1` slope and intercept, `scores` per model, and a `trace` of up to 180 test hours, each with its sensor and laboratory hours, the observed silica, every model's prediction, the 21 sensor medians, both assays of the hour and whether it touches a held run |

The eight models are `train_mean`, `previous_lab`, `ar1_previous_lab`, `ridge`, `random_forest`,
`hist_gradient_boosting`, `ridge_with_previous_lab` and `boosting_with_previous_lab`. No model file is kept: the
lane's models are refitted on each window by `scripts/precompute` and only their predictions are recorded.

`scripts/check_artifacts.py` checks the pin, the population and exclusions, the features, the three windows and
their embargo, the model matrix, the comparisons, the repeated-assay share, the held-label block and the held mark of
every traced hour.
