# ONNX and ONNX Runtime: applying it to a network of your own

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## Export and verify

The pattern of `export_onnx` works for any PyTorch module:

```python
import numpy as np
import onnxruntime
import torch

model = model.to("cpu").eval()
torch.onnx.export(model, torch.zeros((1, n_features)), "my_model.onnx",
                  input_names=["features"], output_names=["targets"],
                  dynamic_axes={"features": {0: "rows"}, "targets": {0: "rows"}}, opset_version=17, dynamo=False)
session = onnxruntime.InferenceSession("my_model.onnx", providers=["CPUExecutionProvider"])
check = rows[:64].astype(np.float32)
with torch.no_grad():
    expected = model(torch.from_numpy(check)).numpy()
assert np.max(np.abs(session.run(None, {"features": check})[0] - expected)) <= 1e-5
```

Ship three things together: the `.onnx` file, the scalers the network expects, and a reference block
of inputs with their ONNX Runtime outputs. The reference is what makes a second runtime (the browser,
another language, a device) testable end to end: it must reproduce the reference, not a retrained
network.

## Serve it in a static site

- Serve the WebAssembly runtime from one path and point `ort.env.wasm.wasmPaths` at it; with Vite, the
  `onnxruntime-web-use-extern-wasm` resolve condition keeps a second copy out of the bundle.
- Set `ort.env.wasm.numThreads = 1` unless the page is cross-origin isolated; GitHub Pages cannot be.
- Load the runtime and the sessions lazily, on the first request that needs them, and keep the
  sessions for the page's life.
- Batch: with a dynamic row axis, a sweep of 81 states is one `run` call, not 81.
- Put the version in the file URLs and bypass the HTTP cache, or a deployment can pair a new page with
  an old network cached from the previous release.

## Traps

- **float32 in, float32 out.** The networks run in float32, so a prediction carries about seven
  significant digits; compare runtimes with a relative tolerance, never with equality. The features and
  the scalers can stay in float64 until the tensor is built.
- **Names are the interface.** Renaming an output in the export breaks every consumer silently at
  run time (`.targets` becomes undefined); keep the names in one place and test them.
- **Opsets and exporters change.** The TorchScript exporter is deprecated in current PyTorch; the check
  against the runtime is what keeps an exporter change from shipping a wrong file.
- **Standardize with the scalers of the network you load**, not recomputed ones: the surrogate and the
  guard in OreFlow each have their own feature scalers, from the rows each was trained on.
- **A browser result is still a surrogate's.** The Methods view prints the engine's answer beside the
  surrogate's and the guard's verdict under both; the surrogate never replaces the engine on the page.
