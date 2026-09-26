# ONNX and ONNX Runtime: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../06_onnx.md](../06_onnx.md).

## Python

`requirements-gpu.txt` pins both, beside PyTorch:

```text
onnx==1.20.0
onnxruntime==1.24.2
```

`onnx` is needed by the exporter (`torch.onnx.export`); `onnxruntime` runs the exported files on the
CPU (`CPUExecutionProvider`) for the export check and the reference block. They live in the GPU lane
because only the learned lane needs them; `scripts/setup.ps1` installs them into `.venv-gpu`.

```powershell
.venv-gpu\Scripts\python.exe -c "import onnx, onnxruntime; print(onnx.__version__, onnxruntime.__version__, onnxruntime.get_available_providers())"
```

## Browser

`frontend/package.json` pins the web runtime:

```json
"onnxruntime-web": "1.29.0"
```

It is installed with the rest of the frontend (`npm ci` in `frontend/`). Two settings decide how it is
served:

- **The WebAssembly files are served once, from `ort/`.** `frontend/copy-data.mjs` copies
  `ort-wasm-simd-threaded.wasm` and `ort-wasm-simd-threaded.mjs` from the package into
  `frontend/public/ort/`, and `frontend/vite.config.ts` resolves onnxruntime-web with the
  `onnxruntime-web-use-extern-wasm` condition, the package's build that expects its WebAssembly from a
  path instead of embedding it. Without that condition the bundle carries a second, hashed copy of
  about 14 MB.
- **One thread.** The code sets `ort.env.wasm.numThreads = 1`. Several threads need
  `SharedArrayBuffer`, which a browser only enables on a cross-origin isolated page (served with
  COOP and COEP headers); GitHub Pages cannot send them, and for networks this small one thread is
  fast enough.

The ONNX files themselves are copied by the same script from `models/` into `frontend/public/models/`
(`.onnx` and `.json` only), so the site serves exactly the committed networks.

## CI

The frontend job installs onnxruntime-web and runs `surrogate.test.ts` in Node, where the same
WebAssembly runtime executes the committed files. The Python runtime is not installed in CI: the
export checks happened in the bake and are recorded in `learning.json`.
