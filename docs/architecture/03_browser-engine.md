# 03 The browser engine

The workbench computes live: when a control moves, the browser runs the process engine on the new
state. It does so with `frontend/src/engine/`, a line-by-line TypeScript port of
`data-pipeline/pipeline/engine/`, and not with a simplified model. The Python engine is canonical; the
port has to reproduce it.

## How the port stays faithful

- **One source of constants.** `constants.ts` imports `engine/data/constants.json`,
  `atomic_weights.json` and `minerals.json` from the Python package at build time, so the two engines
  cannot drift in a number. `scripts/check_units.py` rejects an undeclared numeric literal in either
  engine's source.
- **The same algorithms in the same order.** Every module mirrors its Python counterpart: the size
  grid, the Whiten crusher, the three-mixer population balance, the Plitt cyclone, the Illinois root
  finders, the host-limited composite fixed point, flotation banks and recycles, magnetic separation,
  desliming, the energy report, the audit and the trace. Sums run in the same order and additions are
  grouped the same way, so the iterates of the root finders and fixed points follow the same path.
  Python's half-to-even rounding is reproduced where the cyclone count is rounded.
- **Linear algebra without LAPACK.** `linalg.ts` solves the 63-class systems by LU decomposition with
  partial pivoting. It is not bit-identical to LAPACK, and it does not need to be: the results agree to
  about 1e-14 relative.
- **One contract.** `contract.ts` ports `validate()` and interprets the same exported contract file.
- **The same quadrature.** The kinetic bank projection uses the Gauss-Laguerre table exported with the
  contract, not a table computed in the browser.

## Gates

- `frontend/src/test/parity.test.ts` (PE-31): for every one of the 72 baked variants, the port
  re-simulates the case from the artifact's own definition and point and must match the baked trace
  within 1e-6 relative in every metric, stream record, curve and kinetic record, with the same flag
  codes. Audit residuals, which are round-off magnitudes, are held below 1e-9 instead; the engine's
  iteration counters may differ by two. The kinetic fits' Levenberg-Marquardt step counts are not
  compared: on a flat valley a last-bit difference changes when the stopping test is met, while the
  fitted parameters, the fit error and the projections still agree within 1e-6. On the nominal cases
  the largest difference in any physical metric is about 1e-14 relative.
- The first full bake showed one real disagreement, not round-off in a number that matters: the
  payable's recovery by size in size classes holding 1e-17 to 1e-10 of the rougher-feed payable (the
  coarse tail past the cyclone) differed by up to 2.5% between the languages, because the class
  composition there is round-off of the cyclone split. Both engines now report those classes as empty
  (`null`) below a declared share of 1e-8 (`numerics.curve_class_share_floor`), and the parity test
  compares the empty classes exactly.
- `frontend/src/test/contract.test.ts` (PE-30): the port's validator reproduces every verdict of
  `contract_probes.json`.
- `frontend/src/test/sweep.test.ts`: the sweep enumerates its grid, validates every state first, and
  never simulates a rejected one.
- `frontend/src/test/worker-sweeps.test.ts` (PE-38): the worker module, run against a stand-in for the
  worker scope, streams a sweep cell by cell, stops it between cells when a newer sweep starts or on a
  cancel, and answers an evaluation with the trace of the state it was sent.
- `frontend/src/test/trace-curves.test.ts` (PE-36): every value the grinding and separation charts
  plot, on every baked variant, is a number of the trace (copied, reversed, or in a display unit).
- `scripts/check_ui_formulas.py` (PE-36, PE-38): no engine arithmetic in interface files, interface
  files import only the engine's interface, and sweeps start only from an explicit request.
- `frontend/src/test/surrogate.test.ts` (PE-39): the browser's learned lane against the bake's
  reference, below.

## Sweeps in a worker

A response map or a decision surface needs tens of evaluations. `sweep.ts` evaluates a one- or
two-input grid, validating each state and recording rejected ones with their codes; `worker.ts` runs
it in a Web Worker, streams each cell back as it finishes, yields between cells so a newer request can
cancel an older one, and is only ever started by an explicit request, never by a slider event
(PE-38).

## The learned lane in the browser

The Methods view sets the exported surrogate beside the engine. `learning/features.ts` ports the
learned lane's 22 physical features (the payable fraction, throughput per installed megawatt, the
grind, the carriers' share-weighted liberation size, composite content, density, floatability and
dose ratio, the rougher gas velocity, cells and volume per t/h, the bleed, the desliming cut and four
circuit descriptors); `learning/surrogate.ts` standardizes them with the scalers the bake wrote and runs
`models/process_surrogate.onnx` and `models/process_guard.onnx` with onnxruntime-web (WebAssembly, one
thread, the runtime served once from `ort/`), in one call per network for a whole sweep. The bake
writes a `reference` block into `models/process_surrogate.json`: every case's nominal features,
ONNX Runtime predictions and guard error. `surrogate.test.ts` recomputes the features in TypeScript
(1e-12 relative), runs the same ONNX files with onnxruntime-web and matches the predictions at float32
precision and the guard's verdict exactly.

## The interface on top

The workbench validates a state with the contract, sends it to the worker, and keeps only the newest
reply, so a dragged slider never queues stale traces. The views draw the trace: the flowsheet from its
topology and stream records, the charts from its curves and method records. The grinding and
separation views build their charts with `grindingCharts` and `separationCharts`, which the focus
route reuses to put any single chart on its stage.

## Cost

One evaluation takes about 40 to 150 ms in Node on the development machine, including JIT warm-up on
the first run; a 9 by 9 sweep therefore takes a few seconds in the worker, while the interface stays
responsive.
