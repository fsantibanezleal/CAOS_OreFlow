# Derived artifacts

The committed, reproducible evidence the public workbench and the API serve.

| Path | Written by | Content |
|---|---|---|
| `contract/operating_contract.json`, `contract/contract_probes.json` | bake, stage `contract` | Contract 1 and the probe verdicts every validator replays |
| `cases/<case>.json` | bake, stage `cases` | Contract 2: definition, eight variants (the last two in the cut mode) with traces and method records |
| `manifests/<case>.json`, `manifests/index.json` | bake, stage `manifests` | byte counts, SHA-256, headline metrics, KPI checks, the index |
| `learning.json` | bake, stage `learning` | the learned lane record (the ONNX models and the optimizer's screen, `process_screen.json` with `process_gp_cholesky.bin`, are in `models/`) |
| `benchmark.json` | bake, stage `benchmark` | the cross-case summary, oracles, method outcomes |
| `studies.json` | bake, stage `studies` | the mechanism ablations and the uncertainty seed study |
| `real_samples.json` | bake, stage `real_samples` | the GeoMet samples run in the soft porphyry's circuit, beside their tests and the lane's predictions |
| `validation.json` | bake, stage `validation` | the in-process artifact checks |
| `source/hzdr_summary.json`, `source/hzdr_particle_benchmark.json` | `data-pipeline/run_particles.py` | the HZDR particle lane |
| `source/geomet_lct_benchmark.json` | `data-pipeline/run_geomet.py` | the GeoMet locked-cycle lane with paired bootstrap intervals |
| `source/iron_plant_soft_sensor.json` | `data-pipeline/run_iron_plant.py` | the iron-plant soft-sensor lane: next-hour silica on forward windows |

Every process artifact is derived from the declared engine and seeded designs; the cases are
authored scenarios whose plausibility ranges are authoring constraints, not plant measurements, and nothing here is
a claim of plant accuracy or of transfer across mines. The raw inputs of the measured lanes are not committed:
`scripts/fetch-data.ps1` (or `.sh`) fetches the HZDR workbook and the GeoMet tables, `run_iron_plant.py` downloads
its own archive, and `scripts/precompute` runs the three lanes before the bake. The schemas are documented in
[`docs/data-contract/`](../../docs/data-contract.md).
