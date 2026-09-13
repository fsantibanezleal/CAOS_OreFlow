# CAOS OreFlow

OreFlow is a visual, didactic and reproducible mineral-processing research workbench. It connects particle-size distributions, comminution energy, classification, flotation kinetics, constrained operating-point search and machine-learning surrogates in one inspectable state.

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_OreFlow/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_OreFlow/actions)
[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_OreFlow)](LICENSE)
[![Live app](https://img.shields.io/badge/live-oreflow.ml.fasl--work.com-6cd5c6)](https://oreflow.ml.fasl-work.com/)

The public workbench is at [oreflow.ml.fasl-work.com](https://oreflow.ml.fasl-work.com/). It provides six routes: Workbench, Introduction, Methodology, Implementation, Experiments and Benchmark. The main route has linked process nodes, animated material paths, hover-readable SVG plots, replay artifacts and a bounded live engine controlled by throughput, P80, classifier cut, residence time, air, reagent and angle step.

## What is implemented

- 12 authored ore-process cases across liberation, classification, flotation and integration.
- 6 variants per case, 19 executed methods per variant and a committed 1,368-cell method matrix.
- Explicit Contract 1 for units, ranges, physical ordering, rejection and review flags.
- Contract 2 manifests, byte counts, schemas, lane verdicts and compact JSON artifacts.
- Rittinger, Kick, Bond, Whiten, population-balance, logistic partition, Plitt-style cut size, first-order, Kelsall and compressed-exponential flotation, mass balance, constrained search and robust Monte Carlo.
- Ridge, random forest, gradient boosting, Gaussian process, PyTorch MLP and autoencoder diagnostic tiers.
- HZDR RODARE particle-mineralogy workbook downloaded and preprocessed to a compact CC BY 4.0 summary. The source is explicitly not treated as plant recovery labels.
- Local CPU and accelerator environments, reproducible scripts, tests, model registry and an authored manuscript proposal for an uncertainty-aware digital twin study.

## Reproduce locally

PowerShell:

```powershell
./scripts/setup.ps1
./scripts/fetch-data.ps1
./scripts/precompute.ps1
./.venv/Scripts/python.exe -m pytest
./.venv/Scripts/python.exe scripts/check_artifacts.py
cd frontend
npm ci
npm run build
```

The accelerator lane is `.venv-gpu`. The pipeline records `cuda_available` and the PyTorch device in `models/registry.json`; if the host has no compatible NVIDIA device, it records a CPU fallback rather than claiming GPU execution.

To bring new data, use the schema and policies in [docs/data-contract.md](docs/data-contract.md). To run the API locally, install `requirements-api.txt` and use `uvicorn app.main:app --reload`.

## Evidence boundary

The authored cases are engineering scenarios for reproducible comparison. They are not measured mine campaigns. Learned models approximate the declared simulator and are evaluated on held-out parametric perturbations. They are not a production control system or a transfer guarantee. The next scientifically valid step is calibration against a licensed metallurgical campaign with a mine-family holdout.

## Research sources

The research dossier and source ledger are in [docs/research-review.md](docs/research-review.md). Core references include the [NPTEL mineral-processing course](https://onlinecourses-archive.nptel.ac.in/noc18_ce14/preview), [Bond's comminution theory](https://onemine.org/documents/the-third-theory-of-comminution), population-balance literature, [Plitt classification research](https://doi.org/10.1016/j.minpro.2009.02.004), flotation kinetics literature, the [HZDR dataset](https://doi.org/10.14278/rodare.336), [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html), [PyTorch CUDA](https://docs.pytorch.org/docs/cuda.html) and [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/).

## License

Apache-2.0 for code and authored content. External data remains under its source license and is not redistributed in raw form.
