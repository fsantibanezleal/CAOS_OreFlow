# Reproducible pipeline

The pipeline is deterministic for a fixed seed. It preprocesses the downloaded HZDR workbook, creates a seeded parametric design, fits model tiers, infers all 72 case variants, evaluates disjoint perturbations and exports manifests, case artifacts, matrix and benchmark summary.

The separate GeoMet lane reads a checksum-pinned CC BY 4.0 flotation CSV, excludes one missing locked-cycle target, evaluates four models on 52 measured tests with hole and spatial-zone holdouts, and exports `source/geomet_lct_benchmark.json`. Its raw CSV is ignored; the compact derived evidence is committed. This lane neither trains the authored-circuit surrogates nor changes their simulator target. It is reproduced by `data-pipeline/run_geomet.py` in the CPU environment.

The public app uses the compact files generated in `data/derived/`. It never needs the raw workbook. The service is read-only for artifacts and its POST simulation route is bounded by Contract 1. Build and deployment never train or mutate canonical files.

Run:

```powershell
./scripts/setup.ps1
./scripts/fetch-data.ps1
./scripts/precompute.ps1
python scripts/check_artifacts.py
```

For a sandboxed circuit run, pass `--output build/smoke` to `data-pipeline/run.py` directly. The committed bake is produced without that option after source changes are verified. `scripts/precompute.ps1` and `.sh` run all three scientific lanes; CI only checks committed artifacts and never refits.
