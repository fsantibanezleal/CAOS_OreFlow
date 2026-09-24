# Release verification record

This file is the release gate for OreFlow. It separates reproducibility evidence from serving evidence so a green local build is not mistaken for a live deployment.

## Local scientific gate

- Contract 1 validation: passed.
- Contract 2 artifact/index validation: passed.
- Coverage: 12 cases, 72 variants, 1,512 method records and 21 registered methods; check applicability separately.
- Python: Ruff passed and the full test suite passed.
- Data: HZDR RODARE workbook fetched, SHA256 recorded, and processed to an independent four-case particle benchmark; raw input remains ignored. The test sheet has constructed oracle probabilities but no realized test classes; case 4 has 663 rows excluded from the common finite comparison.
- Compute: PyTorch 2.12.0+cu126 executed a tensor operation and trained the circuit MLP, autoencoder and independent HZDR particle MLP on the local RTX 4070 Laptop GPU. `models/registry.json` records the simulator lane; the particle artifact independently records `device: cuda`. The particle ONNX export was tested against its local PyTorch checkpoint over 32 vectors (absolute/relative tolerance 0.000001) and exercised in a browser with changed feature inputs. This is local training evidence, not VPS GPU evidence.

## Local product gate

- TypeScript typecheck: passed.
- Frontend unit tests: passed.
- Vite production build: passed.
- Rendered checks before promotion: workbench circuit topology for rougher and magnetite, five-stage magnetic replay advancing and stopping, 390 px single-row shell header/footer, and browser ONNX inference with changed input vector inspected. Full six-route EN/ES/light/dark and production checks remain release gates, not inferred from these local checks.
- API smoke: health, catalog, benchmark and validated simulation returned successful responses.

## Remote gate

The remote gate is complete only after the public GitHub repository, GitHub Pages project site and `oreflow.ml.fasl-work.com` VPS service have each been checked from outside the local workspace. The deploy script performs health and catalog checks, while the operator record must include the final commit, workflow run and live URLs.
