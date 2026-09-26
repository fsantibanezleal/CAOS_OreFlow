# ONNX and ONNX Runtime: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## Export, and the check that follows it (`methods/learning.py`, `export_onnx`)

```python
cpu = model.to("cpu").eval()
dummy = torch.zeros((1, n_inputs), dtype=torch.float32)
torch.onnx.export(cpu, dummy, str(path), input_names=[input_name], output_names=[output_name],
                  dynamic_axes={input_name: {0: "rows"}, output_name: {0: "rows"}}, opset_version=17, dynamo=False)
session = onnxruntime.InferenceSession(str(path), providers=["CPUExecutionProvider"])
ort_out = session.run(None, {input_name: check_rows.astype(np.float32)})[0]
difference = float(np.max(np.abs(ort_out - _predict_network(cpu, check_rows))))
if difference > tolerance:
    raise AssertionError(...)
```

- The graph is traced on the CPU with a one-row dummy input; the **dynamic row axis** lets the browser
  send a whole sweep in one call.
- **Named inputs and outputs** (`features` to `targets` for the surrogate, `features` to
  `reconstruction` for the guard, `features` to `logits` for the particle network) are the contract the
  browser code relies on.
- **Opset 17** and the TorchScript exporter (`dynamo=False`): torch 2.12 still ships that exporter,
  deprecated in favour of the `torch.export` path, and the code silences only its deprecation warning.
  The ONNX Runtime check right after the export is what verifies the file, whatever the exporter.
- The check runs the first 64 standardized design rows through both and fails the bake if the largest
  absolute difference exceeds `learning.onnx_tolerance` (1e-5). The committed record stores the
  differences: 1.7e-6 for the surrogate and 1.9e-6 for the guard.

## The scalers and the reference block (`models/process_surrogate.json`)

The networks see standardized features and produce standardized targets, so the scalers ship with them:
the feature means and scales, the target means and scales, the guard's own feature scalers and its
threshold. `surrogate_reference` then adds a `reference` block: for each case's nominal state, the 22
features computed in Python, the surrogate's three predictions and the guard's error and verdict, all
through ONNX Runtime. It is the answer the browser must reproduce.

## The browser (`frontend/src/learning/surrogate.ts`)

```ts
const ort = await import('onnxruntime-web/wasm');
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
const surrogate = await ort.InferenceSession.create(url('models/process_surrogate.onnx'), { executionProviders: ['wasm'] });
```

- The runtime is loaded on first use, not with the page.
- `learning/features.ts` computes the same 22 features from the case's ore, plant and operating point
  as `learning.features` does in Python.
- A whole batch of states is standardized into one `Float32Array` and sent in one call per network;
  the targets are returned to their units with the target scalers, and the guard's mean squared
  reconstruction error is compared with the threshold.
- Every file request carries the app version and bypasses the cache, like every artifact request.

The Methods view's learned-lane sub-tab shows the surrogate's answer beside the engine's for the
current state and for a sweep, with the guard's verdict. The Benchmark page's Measured lanes tab runs
`particle_mlp.onnx` on four particle features set with sliders (bounded by the training data's 1st and
99th percentiles), standardizes them with the particle record's scalers, and turns the four logits into
probabilities with the logistic function.

## The chain of checks

| Link | Check | Where |
|---|---|---|
| PyTorch to the ONNX file | largest difference on 64 design rows at most 1e-5 | `export_onnx`, at every bake; recorded in `learning.json` |
| Python features to browser features | within 1e-12 relative, for every case | `surrogate.test.ts` |
| ONNX Runtime (Python) to onnxruntime-web | predictions and guard error within 1e-4 relative, same verdict | `surrogate.test.ts`, against the reference block |
| PyTorch checkpoint to the particle file | 32 seeded vectors within 1e-6 | `tests/test_particle_experiment.py`, when the local checkpoint exists |
| The committed files to the site | copied, not rebuilt | `copy-data.mjs` |

No link retrains, so each compares against something committed.
