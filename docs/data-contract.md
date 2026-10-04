# Data contract

![The data contracts: the operating contract, the trace and the artifacts](../frontend/public/svg/tech/05-data-contracts.svg)

OreFlow has two process boundaries, the records the bake writes from them, and three measured-data lanes. Every
page states the expected fields and units, what is rejected, what is flagged, and how missing or out-of-range data
is handled.

| Page | Boundary | Where it lives |
|---|---|---|
| [01 Operating contract](data-contract/01_operating-contract.md) | Contract 1: the operating envelope every state must satisfy before the engine runs | `data-pipeline/pipeline/io/contract.py`, exported to `data/derived/contract/operating_contract.json` |
| [02 Trace and live API](data-contract/02_trace-and-live-api.md) | The trace of one circuit evaluation and the HTTP routes that serve it | `data-pipeline/pipeline/engine/trace.py`, `app/routers/content.py` |
| [03 Case artifacts](data-contract/03_case-artifacts.md) | Contract 2: the baked case artifacts, their manifests and the index, the learning record, the studies record, the real-sample record, the benchmark and the validation record | `data-pipeline/pipeline/stages/cases.py` (each case), `data-pipeline/pipeline/pipeline.py` (manifests, index, learning, validation), `data-pipeline/pipeline/stages/studies.py`, `data-pipeline/pipeline/stages/real_samples.py`, `data-pipeline/pipeline/stages/benchmark.py` |
| [04 Particle lane](data-contract/04_particle-lane.md) | HZDR RODARE particle-separation workbook, its record and its network | `data-pipeline/run_particles.py` |
| [05 GeoMet lane](data-contract/05_geomet-lane.md) | GeoMet locked-cycle tests and comminution samples: the assay lane, the real samples' inputs and new assays | `data-pipeline/run_geomet.py`, `data-pipeline/pipeline/cases/real_samples.py` |
| [06 Iron-plant soft sensor](data-contract/06_iron-plant.md) | One iron-ore plant's hourly sensors and laboratory assays, and the forecast record | `data-pipeline/run_iron_plant.py` |

The rule shared by every boundary: a value that is missing, non-numeric, non-finite or physically
impossible is rejected with a named code; nothing is coerced silently. A value that is plausible but
outside the region a model was built for is accepted with a flag that travels with the result.
