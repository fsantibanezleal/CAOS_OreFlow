# OreFlow notebooks / Notebooks OreFlow

A bilingual didactic path through comminution, flotation kinetics, machine-learning validation, constrained optimization and uncertainty/sensitivity analysis. The five topics progress from interpreting committed records to running production methods and comparing them with published research. Every notebook states the assumptions and limitations of its evidence, reads committed OreFlow records and imports pipeline methods instead of copying them. Start at `en/README.md` or `es/README.md`; see the template's [notebook guide](../docs/guides/08_notebooks.md).

Run: `scripts/setup.ps1 -Notebooks` on Windows or `scripts/setup.sh --notebooks`; validate with `python scripts/check_notebooks.py` and `python scripts/run_notebooks.py --check --tmp <temp-root>`.

Run the following from the repository root after setup has installed the exact versions in `notebooks/requirements.txt`. The first runner command executes all lessons in fresh kernels and writes their outputs. The static check then inspects the saved notebooks; the final runner command executes temporary copies and compares them with those saved outputs. Each command must succeed before the next one runs.

For Bash, set `CAOS_TEMP_ROOT` to a configured external temporary root outside the repository before running this block. The interpreter is selected from the pinned notebook environment:

```bash
: "${CAOS_TEMP_ROOT:?Set CAOS_TEMP_ROOT to a configured external temporary root outside the repository}"
export CAOS_TEMP_ROOT
if [[ -x .venv-notebooks/Scripts/python.exe ]]; then
  notebook_python=.venv-notebooks/Scripts/python.exe
else
  notebook_python=.venv-notebooks/bin/python
fi
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
export VECLIB_MAXIMUM_THREADS=1 NUMEXPR_NUM_THREADS=1
"$notebook_python" scripts/run_notebooks.py &&
"$notebook_python" scripts/check_notebooks.py &&
"$notebook_python" scripts/run_notebooks.py --check --tmp "$CAOS_TEMP_ROOT"
```

For PowerShell on Windows, set `CAOS_TEMP_ROOT` to a configured external temporary root outside the repository before running these equivalent commands:

```powershell
if ([string]::IsNullOrWhiteSpace($env:CAOS_TEMP_ROOT)) {
  throw 'Set CAOS_TEMP_ROOT to a configured external temporary root outside the repository before running notebooks.'
}
$env:OPENBLAS_NUM_THREADS = '1'
$env:OMP_NUM_THREADS = '1'
$env:MKL_NUM_THREADS = '1'
$env:VECLIB_MAXIMUM_THREADS = '1'
$env:NUMEXPR_NUM_THREADS = '1'
& ./.venv-notebooks/Scripts/python.exe scripts/run_notebooks.py
if ($LASTEXITCODE -ne 0) { throw 'Fresh notebook execution failed.' }
& ./.venv-notebooks/Scripts/python.exe scripts/check_notebooks.py
if ($LASTEXITCODE -ne 0) { throw 'Saved notebook validation failed.' }
& ./.venv-notebooks/Scripts/python.exe scripts/run_notebooks.py --check --tmp $env:CAOS_TEMP_ROOT
if ($LASTEXITCODE -ne 0) { throw 'Fresh output comparison failed.' }
```

For a bounded execution, add `--only notebooks/en/01-comminution/01-the-record.ipynb` to the runner commands (or select the corresponding Spanish lesson). An output-writing run must finish before a fresh comparison is meaningful; the check does not populate missing outputs. Missing input artifacts or rejected computations remain failures with diagnostics.
