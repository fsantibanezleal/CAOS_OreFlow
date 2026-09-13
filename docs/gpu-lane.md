# GPU lane

The local accelerator environment is `.venv-gpu`, ignored by Git. `scripts/setup.ps1` installs the verified scientific stack and the PyTorch and ONNX dependencies. The train stage selects `cuda` when `torch.cuda.is_available()` is true, stores the device in `models/registry.json` and exports small ONNX artifacts. If the host has no compatible NVIDIA device, the same training code runs on CPU and records that fact.

The ML VPS target is documented as CPU-only, so it serves precomputed artifacts and the bounded API. It does not claim to provide GPU compute. Heavy training belongs on a local or explicitly provisioned accelerator host.
