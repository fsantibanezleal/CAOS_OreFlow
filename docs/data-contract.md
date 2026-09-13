# Data contract

OreFlow has two boundaries. Contract 1 is `pipeline/io/contract.py`: it validates an operating point before the numerical engine receives it. Contract 2 is the JSON artifact and manifest emitted by `stages/export.py` and consumed by the web replay lane.

The input schema is intentionally narrow enough for a browser request and rich enough to couple throughput, size, hardness, density, water, air, reagent and residence time. Rejection is used for missing or physically impossible values. Review flags are used for plausible but unusual intensities, including very high throughput, reagent dose, water use and very low head grade.

The output case schema is `oreflow.case/v1`. A case artifact contains six variants. Each variant stores the complete size grid, feed, crushed, ground and overflow cumulative passing curves, a flotation recovery curve, metric dictionary and all 19 method outputs. The manifest points to the artifact, records its byte count, engine version, seed, lane and evaluation summary. `frontend/src/lib/contract.types.ts` mirrors the shape.

This design makes the repo applicable to new operating-point data while preserving an honest boundary between exact offline evidence and the browser's bounded live response.
