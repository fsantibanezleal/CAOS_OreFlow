# CAOS OreFlow

- Live: [oreflow.ml.fasl-work.com](https://oreflow.ml.fasl-work.com/) (the site and the live API)
- Mirror: [fsantibanezleal.github.io/CAOS_OreFlow](https://fsantibanezleal.github.io/CAOS_OreFlow/) (the site)

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_OreFlow/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_OreFlow/actions)
[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_OreFlow)](LICENSE)

OreFlow computes how a grinding and separation circuit trades recovery, concentrate grade, energy and water,
for twelve authored ore and plant scenarios. Every stream is carried as the mass flow of every mineral in
63 size classes plus water; the engine crushes, grinds in a closed circuit with cyclones, and separates by
flotation banks, a gravity bleed, magnetic drums or desliming, and closes the balance of every unit within
1e-9. The workbench re-solves the whole circuit in your browser on every control change.

It is written for a process metallurgist checking the direction and size of a trade-off, a student of
mineral processing learning why recovery, grade and energy move together, and a data scientist asking how
far a learned surrogate of a process can be trusted when the ore changes.

## What it computes

- **The engine** (`data-pipeline/pipeline/engine/`): a Whiten crusher; an energy-specific population
  balance ball mill (three mixers, Moly-Cop form) in a closed circuit that meets the target P80 and the
  design circulating load, at installed power when the target cannot be met; Plitt hydrocyclones with water
  bypass and density-corrected cuts per mineral; flotation banks with rates from bubble surface area flux,
  entrainment and cleaner recycles; a gravity unit on the underflow; low-intensity magnetic drums;
  desliming; Bond, Rittinger and Kick energy; an independent audit of every balance.
- **Method records** for every variant: five lumped kinetic models fitted to a virtual batch test and
  projected to the bank; a constrained optimizer (COBYLA, six starts) that maximizes recovered metal under
  grade, power and water constraints; a seeded uncertainty record over four ore properties; Sobol indices
  at the nominal state.
- **A learned lane**: ridge, random forest, gradient boosting, a Gaussian process and a PyTorch MLP trained
  on 3072 engine states, scored inside the cases and on held-out cases, with an autoencoder guard; the MLP
  and the guard run in the browser as ONNX.
- **Two measured lanes**, kept apart from the engine: the HZDR particle dataset (RODARE 336, CC BY 4.0) and
  52 GeoMet locked-cycle tests (Zenodo 7051975, CC BY 4.0).
- **Checks against published examples**: the Moly-Cop base case, the GMG Bond worked examples, the Laplante
  gravity example and the Zandrivierspoort magnetite tests.

Twelve cases, six variants each: soft and hard copper porphyry, low-grade copper at high throughput, copper
ore with clay, copper-molybdenum bulk flotation, oxide copper by sulphidisation, zinc sulphide, nickel
sulphide with serpentine slimes, refractory gold in sulphides, free-milling gold with gravity, fine magnetite,
and phosphate with clay slimes ([use cases](docs/use-cases.md)).

## Quick start

Python 3.12, Node 20 or later (22 in CI), git:

```powershell
./scripts/setup.ps1                 # .venv and .venv-gpu, never a global interpreter
cd frontend; npm ci; cd ..
./scripts/dev.ps1                   # the workbench on http://127.0.0.1:5914
```

The committed records in `data/derived/` and `models/` are all the site needs; a bake is only needed after
changing the engine, the catalog or a method ([guide 02](docs/guides/02_bake-and-gpu.md)). The service:

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8146
```

Every shell script has a bash twin (`scripts/*.sh`).

## Tests

```powershell
./scripts/smoke.ps1                 # guards, ruff, 341 Python tests, 165 frontend tests, the build
cd frontend; npm run build; npm run preview   # then, in another terminal:
node gate.mjs                       # the browser gate (OF_MATRIX=full for every viewport, theme and language)
```

## How it is built

A canonical Python engine and an offline bake that writes versioned JSON records; a line-by-line
TypeScript port that reproduces every baked variant within 1e-6 and runs in a Web Worker; a React and Vite
interface on the shared CAOS app shell, with uPlot charts and KaTeX equations; a FastAPI service that runs
the Python engine behind the same operating contract. See [architecture](docs/architecture.md).

## Documentation

| Section | Contents |
|---|---|
| [Architecture](docs/architecture.md) | the system, the bake, the browser engine, the web app, release and deployment |
| [Methodologies](docs/methodologies.md) | every unit model and method, with its equations, parameters, sources and tests |
| [Data contract](docs/data-contract.md) | the operating contract, the trace, the artifacts and the measured lanes |
| [Frameworks](docs/frameworks.md) | each library, how OreFlow uses it, with runnable examples |
| [Guides](docs/guides.md) | running it locally, baking, using it on other data, adding a case, reading the workbench |
| [Use cases](docs/use-cases.md) | the twelve cases, rendered from the committed records |
| [Design](docs/design/SDD.md) | the software design document and the requirements with their gates |

## What the results are, and are not

The cases are authored scenarios inside published ranges, not calibrated plants; the directions of the
effects are the engine's physics, their sizes depend on the authored parameters. The optimizer has no
prices. The learned lane approximates this engine, and its held-out-case scores bound how it transfers to
another authored plant, not to a real one. The measured lanes are separate evidence and calibrate nothing in
the engine.

## License

MIT for code and authored content ([LICENSE](LICENSE)). External data stays under its source licence and
is not redistributed in raw form. Developed by Felipe Santibáñez-Leal.
