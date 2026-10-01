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

- **The triangular solve is LAPACK's.** `scipy.linalg.solve_triangular` calls LAPACK's `trtrs` from the wheel's
  bundled OpenBLAS; the screen's variance therefore depends on the build only at round-off, which the export check
  bounds against scikit-learn (1e-8). Until 0.06.000 the pin also held COBYLA's iterates (PRIMA's port); the
  optimizer no longer uses SciPy.
- **The samplers take `rng`.** `qmc.LatinHypercube` and `qmc.Sobol` accept a NumPy `Generator` through
  the `rng` keyword, which the code uses; the older `seed` keyword is still accepted but is not what
  OreFlow passes.
- **Wheels bundle their libraries.** No Fortran compiler or BLAS installation is needed on Windows or
  Linux.
