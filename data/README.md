# OreFlow data

`data/raw/` is ignored and holds downloaded source files for local preprocessing only: the HZDR
RODARE particle workbook (DOI 10.14278/rodare.336, CC BY 4.0) and the GeoMet v4 CSVs (Zenodo record
7051975, CC BY 4.0). `scripts/fetch-data.ps1` (or `.sh`) downloads them and checks their hashes.

`data/derived/` holds the compact, reviewable JSON artifacts the public app and the API serve. They
are rebuilt by the bake (`data-pipeline/run.py`) and by the two measured lanes
(`data-pipeline/run_particles.py`, `data-pipeline/run_geomet.py`); see `data/derived/README.md`.

The contracts are documented in `docs/data-contract/`:

- [Contract 1, the operating envelope](../docs/data-contract/01_operating-contract.md): every
  operating input with its unit, bounds per case, integer rule, applicability and the desliming rule;
  a missing input takes the case nominal, and a value that is not a number, not finite, fractional
  where a whole number is required, or out of range is rejected with a named code. Nothing is
  coerced.
- [The trace and the live API](../docs/data-contract/02_trace-and-live-api.md).
- [Contract 2, the case artifacts](../docs/data-contract/03_case-artifacts.md), with the checks of
  `scripts/check_artifacts.py`.
- [The particle lane](../docs/data-contract/04_particle-lane.md) and
  [the GeoMet lane](../docs/data-contract/05_geomet-lane.md).
