# 05 GeoMet lane (measured locked-cycle tests)

The inputs and the records of the two uses of the GeoMet dataset: the lane that predicts the locked-cycle recovery
from assays ([methodology page 18](../methodologies/18_geomet-lane.md)), and the real samples that run the same
tests through an engine circuit ([methodology page 15](../methodologies/15_real-samples.md)). This page states the
fields, what is refused and what is recorded; the protocols, the uncertainty of the ranking and the results are on
the methodology pages.

## Source files

GeoMet dataset, Zenodo 7051975 (doi:10.5281/zenodo.7051975, CC BY 4.0; Hoffimann et al. 2022,
doi:10.1007/s11004-022-10013-1). `scripts/fetch-data.ps1` or `.sh` fetch the tables into `data/raw/` (ignored by git)
and refuse a file whose MD5 differs from Zenodo's; the runs download a missing table themselves with the same check.

| Table | Saved as | MD5 | Used by |
|---|---|---|---|
| `flotation.csv` (53 rows) | `data/raw/geomet-flotation.csv` | `f2e90da6bfa81de1261177ee85a91570` | the lane and the real samples |
| `comminution.csv` (60 rows) | `data/raw/geomet-comminution.csv` | `1a33df8ba77f5d49c281ba3fff16b20b` | the real samples (since 0.07.000) |
| `drillholes.csv` | `data/raw/geomet-drillholes.csv` | `bf48a6b1135113b6e6cf7b32f95315ad` | fetched, not used |

The real samples also pin both used tables by SHA-256, and `scripts/check_artifacts.py` checks the flotation
table's SHA-256 in the lane's record.

## Input fields

| Table | Column | Unit | Role |
|---|---|---|---|
| flotation | `HOLEID` | id | the group that keeps a hole on one side of a split; never a feature |
| flotation | `X`, `Y`, `Z` | m, local | the zone protocol (mean X per hole), the nearest comminution sample, display; never features |
| flotation | `LCT` | fraction | the measured locked-cycle copper recovery, the target (in percent in the records) |
| flotation | `Cu ppm`, `Fe ppm`, `S ppm`, `Si ppm`, `Al ppm` | ppm | the lane's five features; Cu, S and Fe also set a real sample's head grade and minerals |
| flotation | `fr`, `xr` and the other assays | | not used |
| comminution | `HOLEID`, `X`, `Y`, `Z` | id, m | which comminution sample a test takes its work index from |
| comminution | `A` | um | the Bond test's closing screen (inferred, see page 15) |
| comminution | `M` | g/rev | the net undersize per revolution (inferred) |
| comminution | `F80`, `P80` | um | the test's feed and product sizes (inferred) |

## What is refused, excluded or flagged

**The lane** (`data-pipeline/run_geomet.py`):

- a table whose MD5 differs, or a required column missing, stops the run;
- a test with a missing `LCT`, an `LCT` outside [0, 1], or a missing hole or coordinate is excluded and listed with
  its source row; the record's population is pinned at 52 usable tests and 1 exclusion (source row 29, missing
  `LCT`), and any other count stops the run;
- fewer than five distinct holes stops the run;
- a missing assay is not refused: it is imputed by the training fold's median inside each fold.

**The real samples** (`pipeline/cases/real_samples.py`):

- a comminution row with a missing `X`, `Y`, `Z`, `A`, `M`, `F80` or `P80`, with `F80` not above `P80`, `P80` not
  above zero or `M` not above zero is excluded with the reason "incomplete Bond test values" (none of the 60 is);
- a locked-cycle test is excluded, with its reason, when its recovery is missing, when its Cu, S, Fe or location is
  missing, or when its sulphur cannot cover its copper even as chalcocite; 52 remain;
- each remaining test takes the work index of the nearest comminution sample in its own hole, or the deposit median
  when its hole has none (42 and 10 tests), and the record says which.

**New assays** (`scripts/predict-geomet.ps1 INPUT.csv OUTPUT.csv`, or the shell counterpart):

- the CSV must have at least one row and the five ppm columns, named exactly; other columns pass through;
- a non-numeric value, a value below 0 or above 1,000,000 ppm, or a row with no assay at all is refused;
- a missing assay is counted (`missing_assay_count`), and an assay outside the range of the 52 training tests sets
  `outside_reference_range`; both travel with the four predictions (`<model>_lct_pct`) and an `evidence_boundary`;
- a checkpoint fitted on another source file or another feature list is refused.

## Records

`data/derived/source/geomet_lct_benchmark.json` (`oreflow.geomet-lct/v1`):

| Field | Content |
|---|---|
| `source` | title, record, DOIs, license, MD5 and SHA-256, `raw_rows` 53, `usable_rows` 52, `holes` 29, `exclusions` |
| `protocol` | the target, `features`, the transformation, `excluded_features`, the two split rules, the four models' settings and the evidence boundary |
| `protocols.hole`, `protocols.zone` | `folds` (rows, holes and the test source rows of each), `scores` per model (`mae_pp`, `rmse_pp`, `bias_pp`, `r2`), `rows` (each test's source row, hole, coordinates, observed recovery, fold and four out-of-fold predictions) and `paired_bootstrap` |
| `protocols.hole.robust` | `repeated_partitions` and `leave_one_hole_out`, each with its resamples, seed, pair count, adjustment, RMSE per model and the adjusted interval of every pair; the first also with the ridge gain over the mean across partitions and the percentile of the published partition |

`data/derived/real_samples.json` (`oreflow.real_samples/v1`) is described with the other engine records in
[data contract 03](03_case-artifacts.md). Its `samples[].geomet_lane` carries each test's fold and out-of-fold
predictions from the record above, so the workbench shows the lane beside the engine.

`models/geomet_lct.joblib` (local, ignored): the four models fitted on all 52 tests, with the source's SHA-256, the
feature list and the assay range of the training tests. It is a Python pickle: load only one this repository
generated, on a trusted machine.
