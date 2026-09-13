# OreFlow pipeline

Run `python data-pipeline/run.py all --seed 42` from the repository root. The explicit stages are:

`preprocess -> dataset -> feature_extraction -> train -> infer -> evaluate -> export -> validate`

`pipeline/model/process.py` contains the transparent numerical kernels. `pipeline/cases/catalog.py` contains the complete case and variant registry. `pipeline/stages/` contains the stage boundaries. `data/derived/` contains compact JSON outputs, while `models/` contains small registered model exports and metadata.

The process kernel is deliberately bounded for local and service use. It is not a replacement for a plant simulator with calibrated equipment, rheology, liberation classes, circulating load or residence-time distributions.
