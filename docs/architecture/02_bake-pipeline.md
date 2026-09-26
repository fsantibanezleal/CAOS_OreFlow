# 02 The bake

`data-pipeline/run.py` (or `scripts/precompute.ps1`, which also refreshes the two measured lanes)
turns the engine, the case catalog and the methods into the committed artifacts of
`data/derived/` and `models/`. It never runs in CI (ADR-0074): the bake trains the learned lane, so
it is a local job, and CI only re-validates what it produced.

## Stages

| Stage | What it does | Output |
|---|---|---|
| `contract` | resolves Contract 1 for every case and records the probe verdicts | `contract/operating_contract.json`, `contract/contract_probes.json` |
| `cases` | per case, in parallel: each variant's trace, optimization and uncertainty records; the nominal variant's Sobol record | `cases/<case>.json` |
| `learning` | the learned lane on a 3072-state design (CUDA when available) | `learning.json`, `models/process_surrogate.onnx`, `models/process_guard.onnx`, `models/process_surrogate.json` |
| `benchmark` | the cross-case summary from this run's records and the recomputed oracles | `benchmark.json` |
| `manifests` | removes any case file the catalog no longer has; byte counts, SHA-256, headline metrics and KPI checks per case; the index | `manifests/<case>.json`, `manifests/index.json` |
| `validation` | `scripts/check_artifacts.py`, in process | `validation.json`; a failure fails the bake |

## Determinism and parallelism

Every record is seeded: the Latin hypercube of the uncertainty record, the Saltelli design, the
optimizer starts, the learning design, its splits and every model. The case stage therefore runs in
parallel worker processes (spawned, half the logical cores and at most twelve, one BLAS thread each
because the engine's systems are small) without changing any result: the workers only decide the
order in which cases finish, and the artifacts are assembled in catalog order.

## What cannot ship

The index and the benchmark are built from the records of the same run, never by listing files on
disk, and every artifact carries the engine version and the contract digest. A bake that stops
halfway leaves an index that does not match, and the artifact checks reject a learning record, a
benchmark or a case from another version or contract. The last stage recomputes every unit balance
from the stored streams, so an artifact whose balance does not close cannot be committed as valid,
and it rejects any file in `cases/` or `manifests/` that the index does not list: the site copies
those folders whole, so a case left over from an older catalog would otherwise ship.

## Observability

Each stage and each finished case prints a timestamped line, and a bake still running after 45
minutes prints the stack of every thread once, so a stall shows where it is. On the development
machine (32 logical cores, RTX 4070 Laptop GPU) the case stage takes five to six minutes on twelve
workers and the learning stage about thirty (375 s and 1688 s unloaded on 2026-09-26; the committed
bake of 0.05.001, run while browser checks shared the machine, took 687 s and 2106 s, and its validation
record carries them); every other stage takes under a second.
