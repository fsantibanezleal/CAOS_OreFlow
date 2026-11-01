# OreFlow data

Raw source caches live in `<CAOS_DATA_ROOT>/oreflow/raw/`, outside the checkout. Local
checkpoints live in `<CAOS_MODELS_ROOT>/oreflow/`. Both roots come from the process environment
or the entrypoint's explicit root argument; an unset root fails with the required setting.
The wrappers and Python entrypoints do not load `.env` automatically. `.env.example` documents
the variables; export them in the calling shell using the device's external roots.

| Raw filename | Pinned source |
|---|---|
| `SM1.Constructed_cases_data.xlsx` | HZDR RODARE, DOI 10.14278/rodare.336, CC BY 4.0; SHA-256 |
| `geomet-flotation.csv` | GeoMet v4, Zenodo 7051975, CC BY 4.0; MD5 |
| `geomet-comminution.csv` | Same GeoMet release; MD5 |
| `geomet-drillholes.csv` | Same GeoMet release; MD5 |
| `iron-flotation-kaggle-v1.zip` | Kaggle dataset 6294 version 1, CC0; SHA-256 |

For example, after exporting the roots in PowerShell:

```powershell
./scripts/fetch-data.ps1                         # all five pinned files
./scripts/fetch-data.ps1 -Dataset geomet          # only the three GeoMet tables
./scripts/fetch-data.ps1 -DataRoot $env:CAOS_DATA_ROOT -Dataset hzdr
.venv/Scripts/python.exe data-pipeline/fetch.py --check-paths  # no downloads or writes
```

In Bash, use `bash scripts/fetch-data.sh` with `--dataset geomet` or `--data-root "$CAOS_DATA_ROOT"`
for the same options. Existing valid caches are reused; checksum drift fails without replacing
the input. Downloads happen only in the explicit acquisition/training workflows.

Existing ignored `data/raw/` files are left in place. To use a legacy source without copying it,
pass its existing file explicitly: `run_geomet.py --source data/raw/geomet-flotation.csv` or
`run_iron_plant.py --source data/raw/iron-flotation-kaggle-v1.zip`. Explicit files are read-only
and still hash-checked; a missing explicit file is an error, never a download destination.
The bake's `pipeline/cases/real_samples.py` reader uses the same external cache for its two
GeoMet tables. Existing Python calls with `raw=Path(...)` can read a legacy directory; a missing
file in that directory may be downloaded only when its destination is outside the checkout.

`run_geomet.py --fit-checkpoint` and local assay inference use
`<CAOS_MODELS_ROOT>/oreflow/geomet_lct.joblib` (or an external `--checkpoint` file).
For particle `--source`, retain the filename `SM1.Constructed_cases_data.xlsx` so its existing
summary stage reads the selected workbook. Particle training writes `particle_mlp.pt` and its ONNX export under that same external model
directory, then copies only the declared browser asset to `models/particle_mlp.onnx`.
Raw/cache roots and checkpoint destinations inside the checkout are rejected, including resolved
symlink targets. No input or checkpoint is silently moved or deleted.

For the workbench, run `./scripts/dev.ps1` or `bash scripts/dev.sh` from a fresh clone with
Node/npm installed. Each command checks the frontend lockfile, installs locked dependencies with
`npm ci` when absent or when the SHA-256 fingerprint of `package-lock.json` differs from the stamp
in `frontend/node_modules/.oreflow-package-lock.sha256`. The stamp is written only after successful
installation. Each wrapper then starts Vite using shipped artifacts through `npm run dev`. No raw-data
configuration, Python environment, download or training is needed to open it. Additional Vite
arguments are forwarded, for example `bash scripts/dev.sh --port 5915`.
The Python `.venv` and optional `.venv-gpu` remain repository-local and ignored.

`data/derived/` holds the compact, reviewable JSON artifacts the public app and the API serve. They
are rebuilt by the bake (`data-pipeline/run.py`) and by the three measured lanes
(`data-pipeline/run_particles.py`, `run_geomet.py`, `run_iron_plant.py`), which `scripts/precompute.ps1`
runs first; see `data/derived/README.md`.

The contracts are documented in `docs/data-contract/`:

- [Contract 1, the operating envelope](../docs/data-contract/01_operating-contract.md): every
  operating input with its unit, bounds per case, integer rule, applicability and the desliming rule;
  a missing input takes the case nominal, and a value that is not a number, not finite, fractional
  where a whole number is required, or out of range is rejected with a named code. Nothing is
  coerced.
- [The trace and the live API](../docs/data-contract/02_trace-and-live-api.md).
- [Contract 2, the case artifacts](../docs/data-contract/03_case-artifacts.md), with the checks of
  `scripts/check_artifacts.py`.
- [The particle lane](../docs/data-contract/04_particle-lane.md),
  [the GeoMet lane](../docs/data-contract/05_geomet-lane.md) and
  [the iron-plant soft sensor](../docs/data-contract/06_iron-plant.md).
