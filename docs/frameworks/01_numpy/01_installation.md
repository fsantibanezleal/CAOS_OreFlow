# NumPy: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../01_numpy.md](../01_numpy.md).

## The pin

NumPy is the whole of `requirements.txt`, the engine lane:

```text
numpy==2.2.6
```

Every other lane includes it: `requirements-precompute.txt` starts with `-r requirements.txt`,
`requirements-gpu.txt` includes the precompute file, and the VPS installs `requirements.txt` with
`requirements-api.txt`. The engine therefore runs on the same NumPy in the bake, in the tests and
behind the API.

## Installing

Use the repository's environments; never a global interpreter:

```powershell
./scripts/setup.ps1        # creates .venv and .venv-gpu, installs every lane
```

```bash
./scripts/setup.sh
```

On its own, for a scratch environment:

```bash
python -m pip install "numpy==2.2.6"
```

Check it:

```powershell
.venv\Scripts\python.exe -c "import numpy; print(numpy.__version__); numpy.show_config()"
```

## One BLAS thread per bake worker

The bake runs the case stage in parallel worker processes (half the logical cores, at most twelve).
Each engine system is 63 by 63, far too small for a threaded BLAS to help, and twelve processes each
starting a thread per core would oversubscribe the machine. `data-pipeline/pipeline/pipeline.py`
therefore sets, before the workers start:

```python
for variable in ("OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "OMP_NUM_THREADS"):
    os.environ.setdefault(variable, "1")
```

`setdefault` leaves a value you set yourself in place. Results do not depend on the thread count: the
solves are deterministic, and the artifacts are assembled in catalog order whatever order the
workers finish in.

## Platform notes

- Python 3.12 is the verified interpreter (CI and the development machine); `pyproject.toml`
  declares `target-version = "py311"` for ruff.
- The wheels on PyPI bundle their BLAS (OpenBLAS), so nothing else is installed on Windows, Linux or
  the VPS.
- NumPy 2 removed a number of aliases (`np.float_`, `np.product` and others); the engine uses none of
  them, so an upgrade within 2.x is a pin change followed by the full suite and a bake comparison.
