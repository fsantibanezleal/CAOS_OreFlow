# OreFlow scripts

- `setup.ps1` / `setup.sh`: create the local pipeline environment; add `-Notebooks` / `--notebooks` for the notebook kernel.
- `precompute.ps1` / `precompute.sh`: run the canonical bake and checks.
- `check_artifacts.py`: independently verify committed scientific records and balances.
- Template gates: SDD, notebook, README area, SVG animation, deployment, technology pin, contract and web-baseline checks.
- `gpu_probe.ps1` / `gpu_probe.sh`: record accelerator availability before using the optional GPU training lane.

Use the documented device data root for source downloads, model weights and temporary outputs. Do not commit raw source archives or local environments.
