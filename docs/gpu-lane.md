# GPU lane

The local accelerator environment is `.venv-gpu`, ignored by Git. `scripts/setup.ps1` installs the verified scientific stack and the PyTorch and ONNX dependencies. The learned lane (`pipeline/methods/learning.py`) selects `cuda` when `torch.cuda.is_available()` is true, stores the device of every network in `data/derived/learning.json` and exports the surrogate and the guard to ONNX (`models/process_surrogate.onnx`, `models/process_guard.onnx`). If the host has no compatible NVIDIA device, the same training code runs on CPU and records that fact.

The ML VPS target is documented as CPU-only, so it serves precomputed artifacts and the bounded API. It does not claim to provide GPU compute. Heavy training belongs on a local or explicitly provisioned accelerator host.
