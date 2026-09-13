# Reproducible pipeline

The pipeline is deterministic for a fixed seed. It preprocesses the downloaded HZDR workbook, creates a seeded parametric design, fits model tiers, infers all 72 case variants, evaluates disjoint perturbations and exports manifests, case artifacts, matrix and benchmark summary.

The public app uses the compact files generated in `data/derived/`. It never needs the raw workbook. The service is read-only for artifacts and its POST simulation route is bounded by Contract 1. Build and deployment never train or mutate canonical files.

Run:

```powershell
./scripts/setup.ps1
./scripts/fetch-data.ps1
./scripts/precompute.ps1
python scripts/check_artifacts.py
```

For a sandboxed run, pass `--output build/smoke`. The committed bake is produced without that option after source changes are verified.
