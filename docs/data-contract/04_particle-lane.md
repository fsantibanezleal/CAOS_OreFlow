# 04 Particle lane (HZDR RODARE)

The input and the record of the particle lane. What the lane asks and how it scores is
[methodology page 17](../methodologies/17_particle-lane.md); this page states the fields, what is refused and what is
recorded.

## Source file

| Item | Value |
|---|---|
| Record | HZDR RODARE 336, doi:10.14278/rodare.336, CC BY 4.0 |
| File | `SM1.Constructed cases data.xlsx`, saved as `data/raw/SM1.Constructed_cases_data.xlsx` (ignored by git) |
| Fetched by | `scripts/fetch-data.ps1` or `.sh`, which refuse any file whose SHA-256 is not `1559e6c5fabd30988ea0de60bbdf04a750f7895401ffc31da974ea4477aa50b0` |
| Run by | `data-pipeline/run_particles.py` (`pipeline/stages/particle_experiment.py`), from `scripts/precompute` |

## Input fields

| Sheet | Column | Unit | Role |
|---|---|---|---|
| Train data (68,008 rows) | `Aspect Ratio`, `Solidity`, `ECD`, `Mineral 1 surface` | as published | the four features |
| Train data | `Class 1` to `Class 4` | `A` or `B` | the target of each constructed case (B is 1) |
| Test data (29,147 rows) | the same four features | as published | the features of the scored rows |
| Test data | `Probability 1` to `Probability 4` | probability | the constructed probability of class B, the score's reference |
| Test data | `Predicted probability 1` to `Predicted probability 4` | probability | the authors' predictions, scored as a reference, never refitted |

Excluded from the features: every probability, prediction and class column, `Main mineral`, `ECD2`,
`Mineral 1/2 modal` and `Mineral 2 surface`. The test sheet has no observed class, so no accuracy is computed.

## What is refused

The run stops, with no record written, when:

- a required column is missing from either sheet;
- a feature is missing or non-finite in either sheet;
- a class is not `A` or `B`, or a finite constructed probability lies outside [0, 1];
- a case has fewer than 1,000 test rows on which both the constructed and the reference probability are finite.

Missing constructed or reference probabilities are not refused: the rows are left out of that case's scores, the
same rows for every model, and the count is recorded. Case 4 is scored on 28,484 rows (663 left out); the others
on all 29,147.

## Record: `data/derived/source/hzdr_particle_benchmark.json`

| Field | Content |
|---|---|
| `schema` | `oreflow.particle-benchmark/v1` |
| `source` | DOI, URL, license and the SHA-256 of the workbook read |
| `protocol` | row counts (`train_rows`, `fit_rows` 57,806, `validation_rows` 10,202, `test_rows`), `seed` 42, `features`, `excluded_from_features`, the target and reference definitions, the missing-value rule, the split, `device`, `torch_version`, `mlp_best_epoch`, `mlp_validation_bce`, the metric and how to read the thresholds |
| `standardization` | the mean and scale of each feature, fitted on the fitting rows |
| `logistic_coefficients` | per case, the intercept and the four weights of the L1 logistic fit |
| `cases[]` | per case: `case`, `train_class_b`, `test_rows`, `excluded_test_rows`, `oracle_expected_b` (the expected count of class B), and per model (`published_reference`, `l1_logistic`, `particle_mlp`) its `rmse`, `mae`, `bias`, a `calibration` of up to 20 bins (`bin`, `count`, mean `predicted`, mean constructed `oracle`) and 101 `thresholds` (`threshold`, `selected_fraction`, `expected_recovery` the share of the expected class B selected, `expected_grade_proxy` the mean constructed probability of the selected rows) |

`expected_recovery` is the class-B capture under the constructed probabilities, not a metallurgical recovery.

## Model files

- `models/particle_mlp.onnx` (committed): input `features` (batch by 4, float32, standardized with the record's
  `standardization`), output `logits` (batch by 4, one per case; the probability is the logistic of each).
- `models/particle_mlp.pt` (local, ignored): the PyTorch checkpoint with the same weights, the feature order, the
  scaler and the seed; `tests/test_particle_experiment.py` compares the two when it is present.

`scripts/check_artifacts.py` checks the record's pin, population and fields without refitting; CI never trains.
