# Data contract

OreFlow has two process boundaries and two measured-data lanes. Every page states the expected
fields and units, what is rejected, what is flagged, and how missing or out-of-range data is handled.

| Page | Boundary | Where it lives |
|---|---|---|
| [01 Operating contract](data-contract/01_operating-contract.md) | Contract 1: the operating envelope every state must satisfy before the engine runs | `data-pipeline/pipeline/io/contract.py`, exported to `data/derived/contract/operating_contract.json` |
| [02 Trace and live API](data-contract/02_trace-and-live-api.md) | The trace of one circuit evaluation and the HTTP routes that serve it | `data-pipeline/pipeline/engine/trace.py`, `app/routers/content.py` |
| [03 Case artifacts](data-contract/03_case-artifacts.md) | Contract 2: the baked case artifacts and manifests the web replay lane reads | `data-pipeline/pipeline/stages/export.py` |
| [04 Particle lane](data-contract/04_particle-lane.md) | HZDR RODARE particle-separation workbook and its learned models | `data-pipeline/run_particles.py` |
| [05 GeoMet lane](data-contract/05_geomet-lane.md) | GeoMet v4 locked-cycle-test recoveries and assay predictors | `data-pipeline/run_geomet.py` |

The rule shared by every boundary: a value that is missing, non-numeric, non-finite or physically
impossible is rejected with a named code; nothing is coerced silently. A value that is plausible but
outside the region a model was built for is accepted with a flag that travels with the result.
