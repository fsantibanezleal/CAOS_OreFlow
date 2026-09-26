# OreFlow structure

```text
CAOS_OreFlow/
├── VERSION                         the release version; the bake stamps it on every record, the service and the site report it
├── data-pipeline/
│   ├── run.py                      the process bake: contract, cases, learning, benchmark, manifests, validation
│   ├── run_particles.py            the HZDR particle lane
│   ├── run_geomet.py               the GeoMet lane, its checkpoint and the assay prediction
│   └── pipeline/
│       ├── engine/                 the canonical engine: grid, streams, ore, species, chemistry, comminution, grinding,
│       │                           cyclone, flotation, separation, energy, balance, kinetics, roots, circuit, trace, model
│       │   └── data/               constants (each with unit and source), IUPAC atomic weights, the mineral table
│       ├── methods/                optimization, uncertainty and Sobol sensitivity, the learned lane, the published-example oracles
│       ├── cases/catalog.py        the twelve cases and their single-factor variants
│       ├── io/                     contract.py (Contract 1 and its validator), formats.py
│       ├── stages/                 cases (one case per worker), benchmark, particle_experiment, preprocess
│       └── pipeline.py             the bake's orchestration, the manifests and the index
├── data/
│   ├── derived/                    the committed records: contract/, cases/, manifests/, learning.json, benchmark.json,
│   │                               validation.json, source/ (the two measured lanes)
│   ├── examples/                   an illustrative assay input for the GeoMet prediction
│   └── raw/                        downloaded sources (ignored by git; scripts/fetch-data)
├── models/                         the committed ONNX networks and scalers (process surrogate, guard, particle network)
├── app/                            the FastAPI service: the site, the read-only records, POST /api/simulate
├── frontend/
│   ├── src/engine/                 the TypeScript port of the engine, its contract validator, the Web Worker
│   ├── src/learning/               the learned lane in the browser: features and ONNX Runtime
│   ├── src/workbench/              the workbench: rail, readout, views, focus route, store
│   ├── src/content/                the content pages' topics, figures, citations, case prose, the architecture modal
│   ├── src/pages/                  Introduction, Methodology, Implementation, Experiments, Benchmark
│   ├── src/components/charts/      the uPlot host and the decision-surface heatmap
│   ├── src/lib/                    artifact loaders, number formatting, interface strings, the version
│   ├── src/test/                   the Vitest suites
│   ├── public/svg/tech/            the architecture modal's bilingual diagrams
│   ├── copy-data.mjs               copies the committed records, models and the ONNX runtime into public/
│   └── gate.mjs                    the browser gate
├── tests/                          the Python suite
├── scripts/                        setup, fetch-data, precompute, smoke, dev, predict-geomet, gpu_probe (PowerShell and bash),
│                                   the standard-library guards, render_use_cases.mjs
├── deploy/                         the VPS setup script, the systemd unit, the nginx virtual hosts
├── docs/                           the documentation wiki (docs/README.md)
├── manuscript/                     the manuscript draft
└── .github/workflows/              CI and the GitHub Pages deployment
```

The engine and its records are the source of truth. The interface draws what the engine's trace and the
committed records say and computes no engine quantity of its own (`scripts/check_ui_formulas.py`); the
browser port is admitted only because it reproduces every baked variant within 1e-6. The bake is the only
thing that writes `data/derived/` and `models/`; tests write into temporary folders, and CI and the
deployments never train.

Requirement files by lane: `requirements.txt` (NumPy, the engine), `requirements-api.txt` (the service),
`requirements-precompute.txt` (the offline methods), `requirements-gpu.txt` (PyTorch with CUDA and ONNX),
`requirements-dev.txt` (the test and lint tools).
