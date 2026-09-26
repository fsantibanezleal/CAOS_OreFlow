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

## Set up

```powershell
git clone https://github.com/fsantibanezleal/CAOS_OreFlow.git
cd CAOS_OreFlow
./scripts/setup.ps1                 # .venv (offline lane + dev tools) and .venv-gpu (adds PyTorch cu126, ONNX)
cd frontend; npm ci; cd ..
```

`setup.ps1` ends with a CUDA probe; `./scripts/gpu_probe.ps1` repeats it at any time.

The committed artifacts in `data/derived/` and `models/` are everything the site and the service need, so
there is no bake to run before opening the workbench. The raw measured data is only needed to rebuild the
two measured lanes:

```powershell
./scripts/fetch-data.ps1            # HZDR workbook and the GeoMet tables into data/raw/, hashes verified
```

## Open the workbench

```powershell
./scripts/dev.ps1                   # copies the baked data into frontend/public, then Vite on 127.0.0.1:5914
```

Open `http://127.0.0.1:5914`. The engine runs in your browser; every control change re-solves the circuit.
Stop the server with Ctrl+C.

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

It runs the eight guards, the use-case page check, ruff, the Python suite (341 tests; 76 s on the
development machine) and the frontend typecheck, tests (150) and build, and stops at the first failure.

## The browser gate

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'E:\_Temp\ms-playwright'   # wherever your browser cache belongs
cd frontend
npx playwright install chromium                            # once per Playwright version
npm run build
npm run preview                                            # terminal 1: 127.0.0.1:4914
node gate.mjs                                              # terminal 2; $env:OF_MATRIX='full' for a release
```

The gate prints one line per check and ends `GATE PASSED: <n> checks` or with the failures; the
screenshots are in `frontend/qa-output/`. Read them. Stop the preview server when you are done.
