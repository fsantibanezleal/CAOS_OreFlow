# OreFlow

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_OreFlow/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_OreFlow/actions) [![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_OreFlow)](LICENSE)

OreFlow is a research workbench for mineral-processing circuits. It links comminution, classification, flotation and product streams through a steady-state mass-balance engine, then compares physical models, optimization and learned predictors on authored and measured datasets. It is a research simulator, not plant-calibrated software or operating advice.

## Areas

| Area | Folder | Status | What it holds |
|---|---|---|---|
| Web | [`frontend/`](frontend/) | active | Six shell routes including the circuit workbench and Focus mode; shell 0.19.9. Run `cd frontend && npm ci && npm run build && npm test && npm run gate`. |
| API | [`app/`](app/) | active | Bounded FastAPI simulation and validation endpoints. See [API guide](docs/frameworks/08_fastapi/03_applying.md). |
| Core pipelines | [`data-pipeline/`](data-pipeline/) | active | Circuit bake, benchmark, uncertainty, optimization, learning, real samples, particle and iron-plant lanes. Run `scripts/precompute.ps1` on Windows or `scripts/precompute.sh` on POSIX. |
| Packages | [NumPy](https://pypi.org/project/numpy/) 2.2.6 and [scikit-learn](https://pypi.org/project/scikit-learn/) 1.5.2 | active | Exact scientific packages consumed by the OreFlow engine and learned lane; project pins live in `requirements*.txt`. |
| Notebooks | [`notebooks/`](notebooks/) | active | English and Spanish notebooks by topic and level, using OreFlow's committed cases and benchmark artifacts. Setup: `scripts/setup.ps1 -Notebooks` or `scripts/setup.sh --notebooks`; gates: `scripts/check_notebooks.py` and `scripts/run_notebooks.py --check --tmp <temp-root>`. |
| Data | [`data/`](data/) | active | Authored cases, derived simulation artifacts and measured-source records with provenance. See [data README](data/README.md). |
| Contracts | [`docs/contracts/`](docs/contracts/) | active | Schemas and the catalog of committed documents consumed by the web and scientific pipeline. |
| Documentation | [`docs/`](docs/) | active | Design, research methodologies, frameworks, cases and operating limitations. Start at [docs README](docs/README.md) and [SDD](docs/design/SDD.md). |
| Tests and gates | [`tests/`](tests/), [`scripts/`](scripts/) | active | Scientific, parity, artifact, content and template adoption checks. Run `python -m pytest` in the pipeline environment. |
| Deploy | [`deploy/`](deploy/) | active | ML VPS deployment at [oreflow.ml.fasl-work.com](https://oreflow.ml.fasl-work.com); credentials are configured on the host. |

## Run locally

```powershell
scripts/setup.ps1
scripts/precompute.ps1
cd frontend; npm ci; npm run dev
```

See [the design and validation record](docs/design/SDD.md) for model assumptions, data provenance, evaluation limits and release gates.

## Technical report

The versioned research report, including the engine, methods, validation protocol, results and limitations, is archived on Zenodo under [concept DOI 10.5281/zenodo.23783845](https://doi.org/10.5281/zenodo.23783845) (CC BY 4.0).
