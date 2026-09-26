# CAOS OreFlow

OreFlow is a visual, didactic and reproducible mineral-processing research workbench. It connects particle-size distributions, comminution energy, classification, flotation kinetics, constrained operating-point search and machine-learning surrogates in one inspectable state.

[![CI](https://img.shields.io/github/actions/workflow/status/fsantibanezleal/CAOS_OreFlow/ci.yml?branch=main&label=CI)](https://github.com/fsantibanezleal/CAOS_OreFlow/actions)
[![License](https://img.shields.io/github/license/fsantibanezleal/CAOS_OreFlow)](LICENSE)
[![Live app](https://img.shields.io/badge/live-oreflow.ml.fasl--work.com-6cd5c6)](https://oreflow.ml.fasl-work.com/)

The public workbench is at [oreflow.ml.fasl-work.com](https://oreflow.ml.fasl-work.com/). It provides six routes: Workbench, Introduction, Methodology, Implementation, Experiments and Benchmark. The main route opens directly on a quantitative one-pass circuit, with separate views for response curves, a grind–collector decision surface, individual methods and variant comparison. Its angle-step control rotates the decision-surface projection; it does not alter the process calculation.

## What is implemented

- 12 authored ore-process scenarios across four distinct topology families (rougher, gravity/rougher, magnetic and deslime/rougher). They are not 12 independent plant flowsheets.
- 6 variants per case, 21 method records per variant and a committed 1,512-cell method matrix; inapplicable and unavailable results remain explicit.
- Explicit Contract 1 for units, ranges, physical ordering, rejection and review flags.
- Contract 2 manifests, byte counts, schemas, lane verdicts and compact JSON artifacts.
- Rittinger, Kick and Bond energy laws; Whiten-style crusher and cumulative size-distribution proxies (not a solved population-balance kernel); size-bin logistic classification; Plitt-style cut-size approximation; first-order, Kelsall and compressed-exponential flotation; mass balance, bounded search and seeded perturbation quantiles.
- Ridge, random forest, gradient boosting, Gaussian process, PyTorch MLP and autoencoder diagnostic tiers.
- HZDR RODARE particle workbook downloaded locally and processed into a committed CC BY 4.0 aggregate benchmark: 68,008 training rows, 29,147 separate test rows and four constructed separation cases. L1 logistic and PyTorch MLP models are compared with a published reference against constructed test probabilities. Browser-side ONNX inference runs on adjustable particle features. These are not plant-recovery labels.
- A separate CC BY 4.0 GeoMet measured locked-cycle copper-recovery lane: 52 valid tests across 29 holes, a source-row exclusion ledger, whole-hole and spatial-zone holdouts, and comparable mean/ridge/random-forest/Gaussian-process out-of-fold predictions. The Benchmark page links observed/predicted recovery with sample position. These tests lack the operating controls needed to calibrate the circuit simulator.
- A case-scoped finite operating-envelope investigation with editable recovery/grade/energy/water/collector limits, non-dominated sampled points, declared stress sensitivity, baseline deltas, direct application to circuit controls and a JSON audit export. It is not a continuous or plant-calibrated optimum.
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

The accelerator lane is `.venv-gpu`. The learned lane records the PyTorch device of every network in `data/derived/learning.json` (`mlp_training.device`); if the host has no compatible NVIDIA device, it records a CPU fallback rather than claiming GPU execution. The public browser does not perform GPU training.

`precompute.ps1` runs both independent lanes. The particle lane needs the CC BY 4.0 workbook fetched by `fetch-data.ps1`; to rerun it alone use `./.venv-gpu/Scripts/python.exe data-pipeline/run_particles.py`. Its compact scores, calibration bins and threshold curves are committed in `data/derived/source/hzdr_particle_benchmark.json`, while the executable small ONNX model is `models/particle_mlp.onnx`. The large raw workbook and training checkpoint stay local/ignored. See [data contract](docs/data-contract.md) for leakage and missingness rules.

To run the measured-assay path independently, use `./.venv/Scripts/python.exe data-pipeline/run_geomet.py --fit-checkpoint`. A local CSV with the five named ppm assay columns can then be scored with `./scripts/predict-geomet.ps1 data/examples/geomet-assays.csv build/geomet-example-predictions.csv` (or the `.sh` equivalent). The committed example input is illustrative; the script emits three full-data-model recovery estimates and missing/out-of-reference-range flags. No plant set-point is inferred.

To bring new data, use the schema and policies in [docs/data-contract.md](docs/data-contract.md). To run the API locally, install `requirements-api.txt` and use `uvicorn app.main:app --reload`.

## Evidence boundary

The authored cases are engineering scenarios for reproducible comparison. They are not measured mine campaigns. Circuit surrogates approximate the declared simulator and are evaluated on held-out parametric perturbations. Separately, the HZDR particle experiment trains on published constructed A/B classes; its test sheet has probabilities but no realized A/B labels. Neither lane is a production control system or a transfer guarantee. The next scientifically valid step is calibration against a licensed metallurgical campaign with a mine-family holdout.

## Research sources

The research dossier and source ledger are in [docs/research-review.md](docs/research-review.md). Core references include the [NPTEL mineral-processing course](https://onlinecourses-archive.nptel.ac.in/noc18_ce14/preview), [Bond's comminution theory](https://onemine.org/documents/the-third-theory-of-comminution), population-balance literature, [Plitt classification research](https://doi.org/10.1016/j.minpro.2009.02.004), flotation kinetics literature, the [HZDR dataset](https://doi.org/10.14278/rodare.336), [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html), [PyTorch CUDA](https://docs.pytorch.org/docs/cuda.html) and [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/).

## License

MIT for code and authored content (see `LICENSE`). External data remains under its source license and is not redistributed in raw form.
