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

### 0.04.000 investigation and measured-data lane (2026-09-24)

- Local verification: all Python and frontend tests passed; Vite production build and Contract 2 artifact check passed. The GeoMet artifact is pinned to SHA256 `e7968c250c1ccc17b63da6d9624473dd92b32a7ba8d8772e70070a0115e42eda` and holds 52 eligible measured LCT rows, 29 holes, five whole-hole folds, three spatial-zone folds and four complete prediction matrices.
- Rendered interaction verification: EN/light and ES/dark at 390, 628, 1280 and 1600 px for the operating envelope, with no document overflow or JavaScript errors; constraint-empty state, reset, point selection, JSON download, apply-to-circuit, family switch and angular projection exercised. Measured Benchmark inspected at 390 and 1280 px with 52 rendered points, model/holdout switch and no document overflow/errors. Screenshots and JSON report are local ignored QA output.
- Local full-data GeoMet checkpoint and example five-assay CSV prediction smoke passed. Predictions are descriptive within this sparse source and are not plant set-points. The circuit simulator is still uncalibrated, and the four topology families remain a limitation.
- Remote CI, Pages, VPS HTTPS and live-browser verification are recorded below. Engineering verification does not establish user design acceptance or plant validity.

### 0.03.004 focus and flowsheet correction (2026-09-24)

- Shared focus layout was added to `@fasl-work/caos-app-shell` and the OreFlow route uses it outside the document shell. The normal workbench retains its scientific routes and tabs; the flowsheet is again the primary circuit visual with explicit stream values.
- Click-through QA in the local browser: App focus entry opened the selected copper-molybdenum case; feed rate changed 640 to 800 t/h and updated readouts; Return restored the same case and 800 t/h. The focus case picker changed to free-milling gold and displayed a distinct gravity/rougher branch. Phone width 390 px, both themes and Spanish labels were inspected. This is local browser evidence, not production or user design acceptance.
- Full multi-route production QA and Felipe's visual acceptance remain release gates. The 12 authored cases are not 12 distinct topologies: they currently fall into rougher, gravity/rougher, magnetic and deslime/rougher families.
- Production phone inspection of 0.03.002 found an empty CSS grid row under the flowsheet after hiding the obsolete stage tabs. 0.03.003 removed that row; a 390 px live browser check confirmed the panel fills its available space.
- 0.03.004 changes the focus classifier description from "measured" to "calculated" streams, preserving the simulator-truth boundary.

- TypeScript typecheck: passed.
- Frontend unit tests: passed.
- Vite production build: passed.
- Rendered checks before promotion: workbench circuit topology for rougher and magnetite, five-stage magnetic replay advancing and stopping, 390 px single-row shell header/footer, and browser ONNX inference with changed input vector inspected. Full six-route EN/ES/light/dark and production checks remain release gates, not inferred from these local checks.
- API smoke: health, catalog, benchmark and validated simulation returned successful responses.

## Remote gate

The remote gate is complete only after the public GitHub repository, GitHub Pages project site and `oreflow.ml.fasl-work.com` VPS service have each been checked from outside the local workspace. The deploy script performs health and catalog checks, while the operator record must include the final commit, workflow run and live URLs.

### 0.04.000, 2026-09-24

- Feature PR #28 and content-standard correction #29 merged into `develop`; CI run `36006829137` passed scientific, contracts and frontend jobs. Promotion PR #30 merged into `main` at `f30f40406dfcb9a96b82c44ab294d80a882c51a7`; CI `36006937653` and Pages `36006937745` passed.
- A live health readback exposed a stale hard-coded API version. Corrective PR #31 merged into `develop` with CI `36007403877` passing; promotion PR #32 merged into final `main` commit `4c35fbc231602a40c2fc494dd070305c0d0c9099`. CI `36007515696` and Pages `36007515772` passed for that exact SHA.
- The ML VPS checkout fast-forwarded to `4c35fbc231602a40c2fc494dd070305c0d0c9099`, built the frontend and restarted the active `oreflow.service`. Public HTTPS `/`, `/methodology`, `/benchmark` and the compact GeoMet artifact returned 200; `/healthz` reported `0.04.000`. A public `/api/simulate` request for the magnetic case returned `oreflow.live/v1`, positive magnetic recovery and zero flotation recovery.
- Rendered public-domain QA at 390, 628, 1280 and 1600 px repeated the constraint, selection, export, apply-to-circuit, topology switch, projection and bilingual/theme interactions with no document overflow or browser errors. The measured Benchmark showed 52 points at 390 and 1280 px. Pages passed the same rendered interaction script. At 390 px, each of Introduction, Methodology, Implementation, Experiments and Benchmark scrolled within its fixed shell, and mobile Focus mode opened on the selected scenario.
- Remaining scientific boundary: no external operating-control/plant-metallurgy campaign calibrates the four circuit families. Measured GeoMet LCT prediction and simulator operating-point analysis must remain separate; this release is not a validated plant decision system. User visual acceptance remains open.
