# PyTorch: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../05_pytorch.md](../05_pytorch.md).

## The pin and the wheel index

`requirements-gpu.txt`:

```text
-r requirements-precompute.txt
--extra-index-url https://download.pytorch.org/whl/cu126
torch==2.12.0+cu126
onnx==1.20.0
onnxruntime==1.24.2
```

The `+cu126` build comes from PyTorch's own index; the ordinary PyPI wheel for Windows resolved to a
CPU-only build on the development machine, which is why the index is explicit. The file's comment
says the same: on other hardware, pick the wheel from the official PyTorch selector and check
`torch.cuda.is_available()` before claiming a GPU run.

## Installing

```powershell
./scripts/setup.ps1        # builds .venv-gpu from requirements-gpu.txt and probes CUDA at the end
```

The probe on its own:

```powershell
./scripts/gpu_probe.ps1
```

prints the platform, the torch build, whether CUDA is available, the CUDA version and the device, for
example `{'torch': '2.12.0+cu126', 'cuda_available': True, 'cuda_version': '12.6', 'device': 'NVIDIA
GeForce RTX 4070 Laptop GPU'}`.

## Without a GPU

Nothing changes but the time. The training code picks the device with

```python
torch.device("cuda" if torch.cuda.is_available() else "cpu")
```

and records it: `learning.json` stores the device of every network (`final.mlp_training.device`, and
the model identity `torch.nn.Sequential (cuda)`), and the particle record stores `device` and
`torch_version`. A CPU bake is valid, and says so. The networks are small (5827 parameters for the
surrogate, 956 for the guard), so the whole learning stage runs on a CPU as well, only slower.

## CI never installs it

`scripts/check_ci_budget.py` fails a workflow that installs `requirements-gpu.txt`, `torch` or the
precompute lane (ADR-0074). The trained networks are committed as ONNX files, so nothing downstream
needs PyTorch.
