# SciPy: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../02_scipy.md](../02_scipy.md).

## The pin

```text
scipy==1.17.1
```

It sits in `requirements-precompute.txt`, the offline lane, together with pandas, openpyxl,
scikit-learn, joblib and SALib; that file includes `requirements.txt`, so NumPy comes with it. The
VPS does not install it: the service runs the engine, which needs only NumPy.

## Installing

```powershell
./scripts/setup.ps1        # .venv gets requirements-precompute.txt; .venv-gpu gets it through requirements-gpu.txt
```

On its own:

```bash
python -m pip install "scipy==1.17.1"
```

Check it:

```powershell
.venv\Scripts\python.exe -c "import scipy; print(scipy.__version__)"
```

## Version notes that matter here

- **COBYLA is PRIMA's implementation.** In 1.17.1, `minimize(method="COBYLA")` runs the pure-Python
  port of Zhang's PRIMA (the module docstring of `scipy/optimize/_cobyla_py.py` says so and cites
  it). It accepts `bounds`, and `catol` sets the constraint tolerance. A change of SciPy version can
  change the iterates, so the committed optimization records belong to this pin: `example.py` re-runs
  the optimizer and fails when its result differs from the committed record, and an upgrade is
  followed by a bake.
- **The samplers take `rng`.** `qmc.LatinHypercube` and `qmc.Sobol` accept a NumPy `Generator` through
  the `rng` keyword, which the code uses; the older `seed` keyword is still accepted but is not what
  OreFlow passes.
- **Wheels bundle their libraries.** No Fortran compiler or BLAS installation is needed on Windows or
  Linux.
