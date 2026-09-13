# OreFlow structure

`data-pipeline/pipeline/model/process.py` is the pure numerical core. `io/contract.py` is Contract 1. `stages/` implements preprocess, dataset, feature extraction, train, inference, evaluation, export and validation. `data/derived/` is Contract 2 evidence. `models/` contains registered model files and metadata. `frontend/` is the React/Vite companion workbench with the six required routes. `app/` is the thin FastAPI service that serves the built SPA and read-only artifacts. `deploy/` contains the ML VPS systemd and nginx files. `docs/` is the project wiki and `manuscript/` contains the proposed calibrated study.

The source of truth is the pipeline and its artifacts. The interface is not allowed to invent a result that is absent from the manifest or current live state. GitHub Pages provides the static public path. The ML VPS provides the authoritative service path.
