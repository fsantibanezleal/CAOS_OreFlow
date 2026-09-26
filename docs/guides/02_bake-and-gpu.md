# 02 Bake the artifacts (and the GPU lane)

The bake turns the engine, the case catalog and the methods into the committed records in
`data/derived/` and `models/`. The site, the service and every test read those records, so a change to
anything the records depend on is not finished until the bake has run and its output is committed with
the change.

## When a bake is needed

| You changed | Bake? |
|---|---|
| an engine module (`data-pipeline/pipeline/engine/`) or its constants, atomic weights or mineral table | yes, and the TypeScript port must change the same way ([architecture 03](../architecture/03_browser-engine.md)) |
| the case catalog (`pipeline/cases/catalog.py`) or the contract (`pipeline/io/contract.py`) | yes |
| a method (`pipeline/methods/`) or its settings | yes |
| the interface, the content pages, the docs | no |

## Run it

```powershell
./scripts/fetch-data.ps1          # once: the HZDR workbook and the GeoMet tables (the measured lanes need them)
./scripts/precompute.ps1          # the process bake, then the particle lane, then the GeoMet lane
```

`precompute.ps1` uses `.venv-gpu` when it exists and `.venv` otherwise, and passes its arguments to
`data-pipeline/run.py`: `--workers N` sets the number of case processes (default half the logical cores,
at most twelve); `--output` and `--models` redirect the output (see the sandbox below). The process bake
runs six stages and stops with an error if the last one, the artifact checks, finds anything:

| Stage | Writes | Time in the committed bake |
|---|---|---|
| contract | `contract/operating_contract.json`, `contract/contract_probes.json` | under 1 s |
| cases | `cases/<case>.json`: every variant's trace, optimization and uncertainty records, the nominal Sobol record | 686.7 s on 12 workers in the committed bake, which shared the machine with browser checks (374.9 s unloaded) |
| learning | `learning.json`, `models/process_surrogate.onnx`, `process_guard.onnx`, `process_surrogate.json` | 2106.0 s on CUDA in the committed bake (1688.0 s unloaded) |
| benchmark | `benchmark.json` | under 1 s |
| manifests | `manifests/<case>.json`, `manifests/index.json` | under 1 s |
| validation | `validation.json` (the checks of `scripts/check_artifacts.py`, run in process) | under 1 s |

The times are those recorded in the committed `validation.json` (development machine: 32 logical cores,
RTX 4070 Laptop GPU). Each stage and each finished case prints a timestamped line; a bake still running
after 45 minutes prints every thread's stack once, so a stall shows where it is.

## The GPU lane

`.venv-gpu` holds PyTorch built for CUDA 12.6 (`requirements-gpu.txt`). The learned lane picks
`cuda` when `torch.cuda.is_available()` is true and the CPU otherwise, and records the choice: the
learning record's model identity reads `torch.nn.Sequential (cuda)` for the committed bake, and the particle
record stores `device` and `torch_version`. A CPU bake is a valid bake that says so; it is slower in the
learning stage only. Check the device before a bake:

```powershell
./scripts/gpu_probe.ps1
```

The VPS runs no training and needs no GPU: it serves the committed records and runs the engine behind the
API.

## A sandbox bake

To see what a change would produce without touching the committed records:

```powershell
./scripts/smoke.ps1 -Bake         # the whole local gate, then a bake into build/smoke (ignored by git)
```

The sandbox is seeded with the committed measured lanes, since the process bake validates them but does
not produce them.

## After the bake

1. `python scripts/check_artifacts.py` (the bake has already run it; run it again after any manual step).
2. The frontend tests, the parity test first: `cd frontend; npm run test`. After an engine change the port
   must reproduce every new trace within 1e-6.
3. Re-render the case pages: `node --experimental-strip-types scripts/render_use_cases.mjs`.
4. The claims tests (`case-claims`, `experiments-claims`, `benchmark-claims`, `test_learning_findings`)
   fail where the prose quotes a number the bake changed; correct the prose, never the test.
5. Commit the records, the models, the pages and the code that produced them together, so no commit
   pairs code with records of another version.
