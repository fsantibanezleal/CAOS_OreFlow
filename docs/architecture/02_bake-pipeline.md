# 02 The bake

`data-pipeline/run.py` (or `scripts/precompute.ps1`, which also refreshes the two measured lanes)
turns the engine, the case catalog and the methods into the committed artifacts of
`data/derived/` and `models/`. It never runs in CI (ADR-0074): the bake trains the learned lane, so
it is a local job, and CI only re-validates what it produced.

## Stages

| Stage | What it does | Output |
|---|---|---|
| `contract` | resolves Contract 1 for every case (the classifier cut's bounds from the nominal state's solved cut) and records the probe verdicts | `contract/operating_contract.json`, `contract/contract_probes.json` |
| `learning` | the learned lane on a 3072-state design (CUDA when available), and the optimizer's screen: the networks' weights and a Gaussian process on recovery, checked against ONNX Runtime and scikit-learn | `learning.json`, `models/process_surrogate.onnx`, `models/process_guard.onnx`, `models/process_surrogate.json`, `models/process_screen.json`, `models/process_gp_cholesky.bin` |
| `cases` | per case, in parallel: each of the eight variants' trace, screened optimization and uncertainty records; the nominal variant's Sobol record | `cases/<case>.json` |
| `benchmark` | the cross-case summary from this run's records and the recomputed oracles | `benchmark.json` |
| `studies` | per case, in parallel: the mechanism ablations and the uncertainty seed study | `studies.json` |
| `real_samples` | the GeoMet samples in the soft porphyry's circuit, from the pinned tables in `data/raw` | `real_samples.json` |
| `manifests` | removes any case file the catalog no longer has; byte counts, SHA-256, headline metrics and KPI checks per case; the index | `manifests/<case>.json`, `manifests/index.json` |
| `validation` | `scripts/check_artifacts.py`, in process | `validation.json`; a failure fails the bake |

Since 0.07.000 the learning stage runs before the cases, because the cases' optimizer screens its search step
with the models this bake exports. The learned lane depends only on the contract and the catalog, so the order is
free. A development bake with `--reuse-learning` takes the learning record from an earlier bake and reads the
models directory it is given; its records are marked, and the artifact checks refuse to let them be committed.

## Determinism and parallelism

Every record is seeded: the Latin hypercube of the uncertainty record, the Saltelli design, the
optimizer starts, the learning design, its splits and every model; the optimizer's comparisons ask for more than
round-off, so the browser repeats them. The case and study stages therefore run in
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
machine (32 logical cores, RTX 4070 Laptop GPU) the case stage takes about twenty minutes on twelve
workers since 0.07.000, when every target-mode optimizer began to run twice (with and without the screen) and
along the weight path, and the learning stage half an hour to over an hour, depending on what else the machine
runs. The measurements (cases, then learning):
- 1293 s and 4082 s for the committed 0.07.000 bake of 2026-09-30, with the studies in 129 s and the real samples in
  3 s, while a parity run, the Python suite and browser checks shared the machine;
- 375 s and 1688 s for 0.05.000, unloaded, on 2026-09-26;
- 517 s and 3180 s for the committed 0.06.000 bake of 2026-09-28, which shared the machine with another job;
- 605 s and 4622 s for its predecessor that day, also loaded.

The validation record carries the timings of the bake it belongs to. Every other stage takes under a second.
