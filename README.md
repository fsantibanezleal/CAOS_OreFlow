# OreFlow

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_OreFlow/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_OreFlow/actions) [![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_OreFlow)](LICENSE)

OreFlow is a research workbench for mineral-processing circuits. It links comminution, classification, flotation and product streams through a steady-state mass-balance engine, then compares physical models, optimization and learned predictors on authored and measured datasets. It is a research simulator, not plant-calibrated software or operating advice.

## Areas

| Area | Folder | Status | What it holds |
|---|---|---|---|
| Web | [`frontend/`](frontend/) | active | Six shell routes including the circuit workbench and Focus mode; shell 0.19.12. Run `cd frontend && npm ci && npm run build && npm test && npm run gate`. |
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

Start with the [sequenced local workflow](scripts/local/README.md). Run the parallel PowerShell or Bash
00 prerequisite check, 01 initialization and 03 development entrypoints. The 02 data entrypoint defaults
to an external sandbox and requires explicit validated promotion before replacing shipped artifacts.

```powershell
./scripts/local/03_dev.ps1
```

Run 00 and 01 from the linked workflow before 03. Initialization installs locked dependencies when needed;
development supervises Vite and the bounded FastAPI service using the committed research artifacts.
On POSIX, run `bash scripts/local/03_dev.sh`. The older flat dev command remains a frontend-only shortcut.
Scientific data preparation and rebaking
are explicit separate operations; see the [local-run guide](docs/guides/01_run-locally.md).

See [the design and validation record](docs/design/SDD.md) for model assumptions, data provenance, evaluation limits and release gates.

## Technical report

The versioned research report, including the engine, methods, validation protocol, results and limitations, is archived on Zenodo under [concept DOI 10.5281/zenodo.23783845](https://doi.org/10.5281/zenodo.23783845) (CC BY 4.0).

The paired optimizer-screening study is archived under its own Zenodo concept DOI, [10.5281/zenodo.23833134](https://doi.org/10.5281/zenodo.23833134) (CC BY 4.0).

## Data and model terms

Original software and authored simulator content are MIT. Measured data, models trained on those data
and manuscript PDFs have the separate terms listed in [LICENSES.md](LICENSES.md), with source credits
and transformations in [ATTRIBUTION.md](ATTRIBUTION.md).
