# 06 ONNX and ONNX Runtime

ONNX is the file format that carries OreFlow's three trained networks out of the bake, and ONNX Runtime
is what runs them afterwards, twice: in Python, to check each export against PyTorch and to write a
reference answer for every case, and in the browser (onnxruntime-web on WebAssembly), where the
Methods view runs the surrogate and the guard beside the engine and the Benchmark page runs the particle
network on inputs the reader chooses. The browser never trains anything and never calls a server: it
runs the committed files.

## At a glance

| | |
|---|---|
| Packages | `onnx` (the format and the exporter's dependency), `onnxruntime` (Python), `onnxruntime-web` (browser) |
| Versions | 1.20.0, 1.24.2, 1.29.0 |
| Licences | Apache-2.0, MIT, MIT |
| Declared in | `requirements-gpu.txt` (Python), `frontend/package.json` (browser) |
| The files | `models/process_surrogate.onnx` (24 134 bytes), `models/process_guard.onnx` (4709), `models/process_surrogate.json` (scalers, threshold and the reference block), `models/particle_mlp.onnx` (6057) |
| Export | `torch.onnx.export`, opset 17, a dynamic row axis, checked with ONNX Runtime within 1e-5 |
| Browser | onnxruntime-web's WebAssembly build, one thread, the runtime served from `ort/` (`frontend/src/learning/surrogate.ts`, `frontend/src/content/lanes.tsx`) |
| Gate | `frontend/src/test/surrogate.test.ts` (PE-39): the browser's features within 1e-12 relative, the predictions and the guard error within 1e-4 relative (the networks run in float32), the guard's verdict exactly |

## Read in order

1. [Installation](06_onnx/01_installation.md): the Python packages, the browser package, and how the
   runtime is served.
2. [Usage in OreFlow](06_onnx/02_usage.md): the export and its check, the reference block, the browser
   sessions, and the chain of checks from PyTorch to the page.
3. [Applying it](06_onnx/03_applying.md): exporting and serving a network of your own, and the traps
   of float32, threads and caching.
4. [`example.py`](06_onnx/example.py): recomputes every case's features, runs the committed surrogate
   and guard with ONNX Runtime, and reproduces the reference block the browser is tested against.

Related: [05 PyTorch](05_pytorch.md), [11 Vite](11_vite.md) (the build condition that serves the
runtime once), [architecture 03](../architecture/03_browser-engine.md).
