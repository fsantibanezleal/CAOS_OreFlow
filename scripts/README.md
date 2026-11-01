# OreFlow scripts

- `setup.ps1` / `setup.sh`: create the local pipeline environment; add `-Notebooks` / `--notebooks` for the notebook kernel.
- `precompute.ps1` / `precompute.sh`: run the canonical bake and checks.
- `check_artifacts.py`: independently verify committed scientific records and balances.
- `generate_contract_types.mjs`: generate the browser's operating-contract and learning types from their JSON Schemas; `--check` fails on stale output without rewriting files.
- `check_deploy_place.py`: enforce one deployment target, with systemd and nginx assets for VPS deployments. The template also accepts structured targets, including a static site paired with a bounded VPS service.
- `tests/adversarial/test_deploy_place.py`: planted-invalid-target checks for the deployment guard, including mixed Pages/VPS files and missing service or nginx assets.
- Template gates: SDD, notebook, README area, SVG animation, deployment, technology pin, contract and web-baseline checks.
- `gpu_probe.ps1` / `gpu_probe.sh`: record accelerator availability before using the optional GPU training lane.

Use the documented device data root for source downloads, model weights and temporary outputs. Do not commit raw source archives or local environments.
