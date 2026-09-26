# 05 PyTorch

PyTorch trains OreFlow's three neural networks: the MLP surrogate of the process engine, the
autoencoder that guards it against states unlike its training design, and the particle network of the
HZDR lane. All three are small, fully connected and trained on the local GPU when one is present; all
three are exported to ONNX ([06](06_onnx.md)), which is what the browser runs. PyTorch itself never
reaches the site, the service or CI.

## At a glance

| | |
|---|---|
| Package | `torch` |
| Version | 2.12.0+cu126 (the CUDA 12.6 build) |
| Licence | BSD-3-Clause |
| Declared in | `requirements-gpu.txt`, with `--extra-index-url https://download.pytorch.org/whl/cu126` |
| Lane | Offline bake only (the learned lane and the particle lane) |
| Used by | `data-pipeline/pipeline/methods/learning.py` (`_train_network`, `guard`, `export_onnx`), `data-pipeline/pipeline/stages/particle_experiment.py` |
| Hardware of the committed bake | NVIDIA GeForce RTX 4070 Laptop GPU, CUDA 12.6 (`learning.json` and the particle record store `cuda`) |

## Read in order

1. [Installation](05_pytorch/01_installation.md): the CUDA wheel, the probe, and the CPU fallback.
2. [Usage in OreFlow](05_pytorch/02_usage.md): the three networks, their training loops, early
   stopping, the guard's threshold and what the records store.
3. [Applying it](05_pytorch/03_applying.md): training a surrogate of your own simulator the same way,
   and what a GPU does and does not change.
4. [`example.py`](05_pytorch/example.py): trains the lane's MLP with the lane's own training function on
   a small engine design and reports the device, the early stop and the scores.

Related: [04 scikit-learn](04_scikit-learn.md) (the other four surrogates), [06 ONNX](06_onnx.md),
[methodology 14](../methodologies/14_learned-lane.md).
