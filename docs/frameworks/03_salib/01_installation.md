# SALib: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../03_salib.md](../03_salib.md).

## The pin

```text
SALib==1.6.0
```

It is in `requirements-precompute.txt`. SALib 1.6.0 requires NumPy 2 or later, SciPy 1.9.3 or
later, pandas 2 or later, matplotlib 3.5 or later and multiprocess; OreFlow uses none of its plotting
or parallel parts, and all of these resolve in the same environment.

## Installing

```powershell
./scripts/setup.ps1
```

On its own:

```bash
python -m pip install "SALib==1.6.0"
```

Check it:

```powershell
.venv\Scripts\python.exe -c "import SALib; print(SALib.__version__)"
```

## Notes

- The package name is `SALib` on PyPI and the import is `SALib` (capitalized).
- `SALib.sample.sobol` is the current name of the Saltelli sampler; the older `SALib.sample.saltelli`
  module has been deprecated since 1.4.6. OreFlow imports `SALib.sample.sobol` and
  `SALib.analyze.sobol`.
- The sampler draws its base points from SciPy's scrambled Sobol sequence (`qmc.Sobol` in twice as
  many dimensions as inputs), which warns when the base sample count is not a power of two because
  the sequence loses its balance otherwise. OreFlow's 256 is one.
