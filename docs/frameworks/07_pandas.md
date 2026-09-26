# 07 pandas and openpyxl

pandas reads OreFlow's two external sources, the HZDR particle workbook (an Excel file, read through
openpyxl) and the GeoMet locked-cycle table (a CSV), and validates them before any model sees a row.
It is also the convenient way to read OreFlow's own JSON records as tables for your own analysis. The
engine never uses it: the process lanes work on NumPy arrays and plain JSON.

## At a glance

| | |
|---|---|
| Packages | `pandas`, `openpyxl` |
| Versions | 2.2.3, 3.1.5 |
| Licences | BSD-3-Clause, MIT |
| Declared in | `requirements-precompute.txt` |
| Lane | Offline: the two measured lanes and the local GeoMet prediction script |
| Used by | `data-pipeline/pipeline/stages/particle_experiment.py`, `stages/preprocess.py` (`read_excel`, `ExcelFile`), `data-pipeline/run_geomet.py` (`read_csv`, `to_numeric`, the assay validation) |
| Raw data | never committed: `scripts/fetch-data` downloads it into `data/raw/` and verifies its hashes |

## Read in order

1. [Installation](07_pandas/01_installation.md): the pins and why openpyxl is there.
2. [Usage in OreFlow](07_pandas/02_usage.md): what each lane reads, what it requires of the columns,
   and how missing and invalid values are handled.
3. [Applying it](07_pandas/03_applying.md): reading OreFlow's records as tables, and preparing your own
   assays for the GeoMet model.
4. [`example.py`](07_pandas/example.py): the committed records as DataFrames; the GeoMet scores
   recomputed with a groupby from the stored out-of-fold predictions; the raw table re-validated when
   it has been fetched.

Related: [04 scikit-learn](04_scikit-learn.md), [data contract 04](../data-contract/04_particle-lane.md)
and [05](../data-contract/05_geomet-lane.md).
