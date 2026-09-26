# Derived artifacts

The committed, reproducible evidence the public workbench and the API serve.

| Path | Written by | Content |
|---|---|---|
| `contract/operating_contract.json`, `contract/contract_probes.json` | bake, stage `contract` | Contract 1 and the probe verdicts every validator replays |
| `cases/<case>.json` | bake, stage `cases` | Contract 2: definition, six variants with traces and method records |
| `manifests/<case>.json`, `manifests/index.json` | bake, stage `manifests` | byte counts, SHA-256, headline metrics, KPI checks, the index |
| `learning.json` | bake, stage `learning` | the learned lane record (the ONNX models are in `models/`) |
| `benchmark.json` | bake, stage `benchmark` | the cross-case summary, oracles, method outcomes |
| `validation.json` | bake, stage `validation` | the in-process artifact checks |
| `source/hzdr_summary.json`, `source/hzdr_particle_benchmark.json` | `data-pipeline/run_particles.py` | the HZDR particle lane |
| `source/geomet_lct_benchmark.json` | `data-pipeline/run_geomet.py` | the GeoMet locked-cycle lane with paired bootstrap intervals |

Every process artifact is derived from the declared engine and seeded designs; the cases are
authored scenarios inside published ranges, not plant measurements, and nothing here is a claim of
plant accuracy or of transfer across mines. The raw inputs of the measured lanes are not committed:
recreate them with `scripts/fetch-data.ps1`, then run the lanes. The schemas are documented in
`docs/data-contract/`.
