# pandas and openpyxl: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

The rule shared by both lanes is the one every OreFlow boundary follows: a value that is missing,
non-numeric, non-finite or impossible is rejected or excluded with a named reason; nothing is coerced
silently ([data contract](../../data-contract.md)).

## The HZDR workbook (`stages/particle_experiment.py`, `stages/preprocess.py`)

```python
train = pd.read_excel(raw_file, sheet_name="Train data")
test = pd.read_excel(raw_file, sheet_name="Test data")
```

- **The sheets are kept as published.** The training sheet (68 008 particles) has A/B labels for four
  constructed cases; the test sheet (29 147) has the constructed probabilities and the source authors'
  predictions, but no observed classes.
- **The columns are a contract.** The lane requires the four features (`Aspect Ratio`, `Solidity`,
  `ECD`, `Mineral 1 surface`), `Class 1` to `Class 4` in the training sheet, and `Probability 1` to
  `4` and `Predicted probability 1` to `4` in the test sheet; a workbook without them is refused
  ("columns do not match the recorded contract").
- **Types and ranges are checked.** A non-finite feature, a class other than A or B, or a probability
  outside [0, 1] stops the lane.
- **Missing test values are counted, not filled.** Case 4 lacks oracle or reference values for 663
  test particles; every model is compared on the rows all three have (28 484), and the record says how
  many were excluded.
- `stages/preprocess.py` opens the workbook with `pd.ExcelFile` and writes a compact summary (row
  counts, feature quantiles, main-mineral counts) to `data/derived/source/hzdr_summary.json`, with its
  status (`processed`, `available_but_not_read` or `not_downloaded`).

`to_numpy(dtype=np.float32)` hands the columns to scikit-learn and PyTorch; pandas is not used after
that point.

## The GeoMet table (`run_geomet.py`)

```python
frame = pd.read_csv(path)
required = {"HOLEID", "X", "Y", "Z", "LCT", *FEATURES}
```

- **Required columns** are the hole identity, its coordinates, the locked-cycle recovery `LCT` (a
  fraction) and the five assays in ppm.
- **Row exclusions carry a reason and the source line**: `missing LCT`, `LCT outside [0,1]` or
  `missing hole/location`. The 53-row source has one exclusion, line 29, `missing LCT`, and the artifact
  lists it. `source_row` is the CSV line number (the index plus two, for the header and the zero base),
  so any row can be found in the original file.
- **Too few holes stops the lane**: fewer than five distinct holes cannot fill five hole-grouped folds.
- **Assays**: `apply(pd.to_numeric, errors="coerce")` turns the five columns into numbers, negative
  values are clipped to zero before `log1p`, and the imputation of a missing assay happens inside each
  training fold ([04 scikit-learn](../04_scikit-learn.md)).

The prediction script validates a user's CSV more strictly (`validate_assays`): the five columns must
exist and the file must have rows; a value that is present but not a number, an assay outside 0 to
1 000 000 ppm, or a row with no assay at all is an error with the column named, never a silent NaN.

## Tests

`tests/test_geomet.py` checks the source hash, the column contract and the missingness record, that
the hole-grouped folds never share a hole, the benchmark matrix, the evidence boundary, the assay
validation of the prediction script (on temporary CSVs), and the paired bootstrap;
`tests/test_particle_experiment.py` checks the particle record's populations and scope.
