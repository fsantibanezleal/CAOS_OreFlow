# Release verification record

This file is the release gate for OreFlow. It separates reproducibility evidence from serving evidence so a green local build is not mistaken for a live deployment.

## Local scientific gate

- Contract 1 validation: passed.
- Contract 2 artifact/index validation: passed.
- Coverage: 12 cases, 72 variants, 1,368 method cells and 19 methods.
- Python: Ruff passed and the full test suite passed.
- Data: HZDR RODARE workbook fetched, SHA256 checked and summarized; raw input remains ignored.
- Compute: the local accelerator environment is installed and CUDA-ready. The available host reported no compatible CUDA device, so the registry records CPU fallback.

## Local product gate

- TypeScript typecheck: passed.
- Frontend unit tests: passed.
- Vite production build: passed.
- Rendered checks: six routes, EN/ES switch, light/dark switch, architecture modal, responsive layout, live controls and benchmark table inspected in a browser.
- API smoke: health, catalog, benchmark and validated simulation returned successful responses.

## Remote gate

The remote gate is complete only after the public GitHub repository, GitHub Pages project site and `oreflow.ml.fasl-work.com` VPS service have each been checked from outside the local workspace. The deploy script performs health and catalog checks, while the operator record must include the final commit, workflow run and live URLs.
