# 01 Run it locally

## What you need

| Requirement | Declared in |
|---|---|
| Python 3.12 | the interpreter CI uses (`.github/workflows/ci.yml`); `pyproject.toml` targets 3.11 syntax |
| Node 20 or later; CI, Pages and the VPS build with 22 | `frontend/package.json` (`engines`), the workflows, `deploy/setup-vps.sh` |
| git | cloning, and the shell dependency, which installs from its Git tag |
| An NVIDIA GPU with CUDA 12.6, optional | `requirements-gpu.txt`; without one the learned lane trains on the CPU and records the device ([guide 02](02_bake-and-gpu.md)) |

The use-case page renderer imports TypeScript directly; the scripts call it with
`--experimental-strip-types`, and it has been run on Node 24.14 (the development machine).

Nothing is installed globally: the Python environments live in the repository (`.venv`, `.venv-gpu`,
ignored by git) and the site's dependencies in `frontend/node_modules`.

## Open the workbench

The workbench needs Node and npm. From the repository root, run one command:

```powershell
./scripts/dev.ps1
```

```bash
bash scripts/dev.sh
```

Each wrapper checks Node/npm and the frontend lockfile. It runs `npm ci` when dependencies or their
SHA-256 lock fingerprint stamp are missing, or when the committed lockfile changed. A successful
install records the fingerprint in `frontend/node_modules/.oreflow-package-lock.sha256`; a failed
install does not certify the new lock or start Vite. A matching fingerprint with the dependency
markers present reuses the installation. The wrapper then runs Vite on `http://127.0.0.1:5914`.
The existing `predev` step copies
shipped artifacts from `data/derived/` and `models/` into the frontend. No Python environment,
external-data configuration, raw download or training is needed to open the workbench.
Additional Vite arguments are forwarded, for example `./scripts/dev.ps1 --port 5915` or
`bash scripts/dev.sh --port 5915`. Stop the server with Ctrl+C.

The engine runs in your browser; every control change re-solves the circuit.

## Set up the offline tooling and service

```powershell
git clone https://github.com/fsantibanezleal/CAOS_OreFlow.git
cd CAOS_OreFlow
./scripts/setup.ps1                 # .venv (offline lane + dev tools) and .venv-gpu (adds PyTorch cu126, ONNX)
```

`setup.ps1` ends with a CUDA probe; `./scripts/gpu_probe.ps1` repeats it at any time. `.venv-gpu` installs the
CUDA 12.6 build of PyTorch, a large download published for Windows and Linux only; `./scripts/setup.ps1 -NoGpu`
(`setup.sh --no-gpu`) skips it, and `setup.sh` skips it on macOS. Only the learned lane's training needs it.

The committed artifacts in `data/derived/` and `models/` are everything the site and the service need, so
there is no bake to run before opening the workbench. The raw measured data is only needed to rebuild the
three measured lanes and the bake's real-samples stage.

## Configure external raw data and checkpoints

Before acquisition or training, export the device's external roots in the launching shell.
Replace the placeholders below with real directories outside the checkout:

```powershell
$env:CAOS_DATA_ROOT = '<external data root>'
$env:CAOS_MODELS_ROOT = '<external models root>'
.venv/Scripts/python.exe data-pipeline/fetch.py --check-paths
```

```bash
export CAOS_DATA_ROOT='<external data root>'
export CAOS_MODELS_ROOT='<external models root>'
.venv/bin/python data-pipeline/fetch.py --check-paths
```

The layout is `<CAOS_DATA_ROOT>/oreflow/raw/` for source caches and
`<CAOS_MODELS_ROOT>/oreflow/` for local checkpoints. The variables are read at call time from the
process environment. Neither the wrappers nor Python automatically load `.env`; `.env.example`
documents the settings. `--check-paths` validates both roots without downloading or creating files.
A missing required root explains which variable or CLI argument to supply. Checkout raw/cache roots
and checkpoint destinations are refused, including resolved symlink targets.

Acquire the pinned inputs explicitly:

```powershell
./scripts/fetch-data.ps1                         # HZDR, three GeoMet tables, iron-plant archive
./scripts/fetch-data.ps1 -Dataset geomet          # only the GeoMet tables
./scripts/fetch-data.ps1 -DataRoot $env:CAOS_DATA_ROOT -Dataset hzdr
```

```bash
bash scripts/fetch-data.sh
bash scripts/fetch-data.sh --dataset geomet --data-root "$CAOS_DATA_ROOT"
```

All five filenames are listed in [the data guide](../../data/README.md). Valid cached files are reused;
changed hashes stop the run without replacing the input. The measured runners can acquire missing
inputs during an explicit offline run. The real-samples stage uses the external GeoMet flotation and
comminution tables and checks both their original MD5 and SHA-256 pins before use or caching.

Existing ignored `data/raw/` files are preserved. They can be supplied read-only as explicit inputs:

```powershell
.venv/Scripts/python.exe data-pipeline/run_geomet.py --source data/raw/geomet-flotation.csv
.venv/Scripts/python.exe data-pipeline/run_iron_plant.py --source data/raw/iron-flotation-kaggle-v1.zip
```

An explicit missing file fails without downloading to that path. The particle runner also accepts
`--source`, retaining the workbook basename `SM1.Constructed_cases_data.xlsx` for its summary reader.
Python callers of the real-samples reader retain `source_bytes(name, raw=Path(...))`; existing
checkout files are read-only, and only an external missing destination may receive a download.

The runners accept `--data-root`; GeoMet and particle training also accept `--models-root`.
GeoMet's `--checkpoint` selects an external checkpoint file directly. Local GeoMet inference can fit
a missing checkpoint; it requires its measured source and an external model destination. The default
checkpoint is `<CAOS_MODELS_ROOT>/oreflow/geomet_lct.joblib`. Particle local weights remain in
`<CAOS_MODELS_ROOT>/oreflow/particle_mlp.pt`; explicit training copies only the declared ONNX export
back to `models/particle_mlp.onnx`. Compact release JSON and browser model assets stay in the checkout.
The repository-local `.venv` and optional `.venv-gpu` remain ignored and are not relocated.

With both roots exported, `./scripts/precompute.ps1` or `bash scripts/precompute.sh` explicitly runs
the measured lanes before the process bake. This is separate from opening the workbench;
[guide 02](02_bake-and-gpu.md) describes rebuilding artifacts.

## Run the service

```powershell
cd frontend; npm run build; cd ..   # optional: lets the service serve the site as well
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8146
```

`http://127.0.0.1:8146/healthz` reports the version; `/docs` lists the API; `POST /api/simulate` runs the
Python engine on a validated state ([frameworks 08](../frameworks/08_fastapi.md)).

## Check before a pull request

The local release gate runs everything CI runs and the suites CI leaves to the workstation (ADR-0074):

```powershell
./scripts/smoke.ps1
```

It runs the eight guards, the use-case page check, ruff, the Python suite, every framework example and the
frontend typecheck, tests and build, and stops at the first failure. The release record
(`docs/release-verification.md`) gives each release's counts and times.

## The browser gate

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '<a folder with room>'    # optional: wherever your browser cache belongs
cd frontend
npx playwright install chromium                            # once per Playwright version
npm run build
cd ..; .venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 4914   # terminal 1: the service, as on the VPS
node gate.mjs                                              # terminal 2; $env:OF_MATRIX='full' for a release
```

The gate prints one line per check and ends `GATE PASSED: <n> checks` or with the failures; the
screenshots are in `frontend/qa-output/`. Read them. Stop the service when you are done.
