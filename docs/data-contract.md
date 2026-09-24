# Data contract

OreFlow has two boundaries. Contract 1 is `pipeline/io/contract.py`: it validates an operating point before the numerical engine receives it. Contract 2 is the JSON artifact and manifest emitted by `stages/export.py` and consumed by the web replay lane.

The input schema is intentionally narrow enough for a browser request and rich enough to couple throughput, size, hardness, density, water, air, reagent and residence time. Rejection is used for missing or physically impossible values. Review flags are used for plausible but unusual intensities, including very high throughput, reagent dose, water use and very low head grade.

The output case schema is `oreflow.case/v1`. A case artifact contains six variants and an explicit `process_family`. Each variant stores the complete size grid, feed, crushed, ground and overflow cumulative passing curves, a kinetic curve (zero for the magnetic circuit), metric dictionary and all 21 method records. Records distinguish `precomputed`, `not-applicable`, and `unavailable`. The manifest points to the artifact, records its byte count, engine version, seed, lane and evaluation summary. `frontend/src/lib/contract.types.ts` mirrors the shape.

This design makes the repo applicable to new operating-point data while preserving an honest boundary between exact offline evidence and the browser's bounded live response.

## Independent particle-learning lane

`data-pipeline/run_particles.py` reads the local, ignored HZDR RODARE workbook (DOI 10.14278/rodare.336; CC BY 4.0), preserving its original Train data and Test data sheets. The training sheet has 68,008 rows with A/B classes for four *constructed* separation cases; 15% of those rows is reserved for MLP early stopping. The test sheet has 29,147 rows with constructed oracle probabilities and published reference predictions, but **no observed A/B classes**. Consequently, this lane reports probability RMSE/MAE/bias and expected-selection curves, not classification accuracy, observed recovery, or a plant benchmark.

The input vector is exactly `Aspect Ratio`, `Solidity`, `ECD` and `Mineral 1 surface`. All probability and prediction columns, labels for other cases, duplicated particle descriptors and other mineral fields are excluded. The standardizer is fitted only on training-fit rows. A seeded L1 logistic fit is made per case, while a shared 4–32–32–4 PyTorch MLP uses local CUDA when available and exports a small ONNX model for on-demand browser inference. The published predictions are a reference from the workbook, not a model refitted by OreFlow. Case 4 has missing oracle/reference values; comparisons for all three model sources use the same 28,484 finite test rows (663 excluded). The other cases use all 29,147 test rows. This missingness is recorded per case in the artifact.

`data/derived/source/hzdr_particle_benchmark.json` (`oreflow.particle-benchmark/v1`) holds source SHA256 and license, split/device/feature metadata, held-out metrics, 20-bin calibration and 101-point threshold curves per case and model. `models/particle_mlp.onnx` is the executable inference artifact. `scripts/check_artifacts.py` validates both lanes without retraining in CI. The raw workbook and PyTorch checkpoint are local-only, reproducible from the source and scripts.
