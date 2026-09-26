# Release verification record

This file is the release gate for OreFlow. It separates reproducibility evidence from serving evidence so a green local build is not mistaken for a live deployment. The newest release is first; each section records what was checked, where and when.

## 0.05.001, 2026-09-26

### Local gate

- The committed bake of 0.05.001: contract, cases (686.7 s on 12 workers), learning (2106.0 s, CUDA, RTX 4070 Laptop GPU), benchmark, manifests and validation, run while browser checks shared the machine; `validation.json` records `passed: true`. It was made into a sandbox and compared file by file with the 0.05.000 records before it was adopted whole. Of the 38 tracked files under `data/derived` and `models`, 28 changed, and only in version, hash and byte fields (40), timings (8) and 94 random-forest scores (85 in `learning.json`, 9 in `benchmark.json`), at most 2.7e-15 relative. Every case number and ONNX export is identical, and the contract digest is unchanged.
- `scripts/smoke.ps1` passed in 161 s on the release commit: the eight guards (406 tracked files), the use-case page check (13 pages), ruff, 341 Python tests, the typecheck, 174 frontend tests and the production build.
- Browser gate on the served build of the release:
  - the full matrix, 684 checks (1280x800, 1600x900 and 2560x1440; dark and light; English and Spanish);
  - the phone and tablet pass, 28 checks;
  - the App and focus routes of the gold, magnetite and phosphate circuits at 1280x800 and 2560x1440, 40 checks each.
- The screenshots read:
  - on the release build, at 1280x800 in dark Spanish: every App view and sub-tab, and the focus route;
  - in dark English: the Grinding view and three Methods records;
  - at 1600x900 in light Spanish: the Circuit, Separation and Response views, both Case views, the learned lane and the focus route;
  - at 2560x1440 in dark English: the Grinding, Separation and Response views and every Methods record;
  - the Separation view of the gold, magnetite and phosphate circuits at 1280x800 in dark English and at 2560x1440 in light Spanish;
  - full view on a phone in Spanish: the Grinding view and the Optimizer record;
  - on the builds before it: every capture of every view and content page in dark Spanish at 1280x800, where the faults below were found.
- The first run of that set, on the release candidate (commit `8c17f93`), passed the matrix, the phone and tablet pass and the gold and phosphate circuits. It failed one check: the magnetite Separation facts at 1280x800, 0.29 full under the new text-panel floor. Reading that run's captures, and those of the builds after it, found faults the gate did not measure, most of them in Spanish at 1280x800. Three gate checks were added (`RAIL_PROBE`, `ELLIPSIS_PROBE`, `CANVAS_TEXT_PROBE`), and each failed the build before its fix. This release fixes:
  - text panels beside the charts from 1800 by 1000 px. At 2560x1440 the Methods panels measured 0.19 to 0.35 full, and the Grinding facts about a fifth (an estimate from the screenshot). They are now strips under the charts, 0.53 to 0.93 full. The gate fails a text panel its content fills less than 30%;
  - the magnetite Separation facts, 0.29 full beside the view's one chart at 1280x800. They are now a strip under it at every size, 0.71 full at 1280x800, and the chart grew from 0.31 to 0.41 of the viewport;
  - the rail, which cut every control's value at its edge ("720 t,", "8,0 r"). Its controls column took the width of the longest row. The column now stays within the rail, and a long control name wraps. `RAIL_PROBE` failed all ten App views on the build before this fix;
  - the readout's status, cut to "Dentro de todas las verif..." with no title. It is now "Sin avisos del motor", and a cut status or cursor reading carries its full text. `ELLIPSIS_PROBE` failed the status on all ten App views before this fix;
  - text on the charts' canvas that did not fit. The four Sobol factor names ran into each other, y titles longer than a short plot were cut at both ends ("Ganancia en metal recuperado (%)", "Error del guardia"), and level labels sat on data points ("nominal", "óptimo", "sin cambio"). Category labels now wrap to their category, the chart draws its y title wrapped to the plot's height, and a level's label takes the free place nearest the right end of its line. Each chart declares what it could not fit, and `CANVAS_TEXT_PROBE` fails any of it, and any visible chart that declared nothing. On the build before the declarations every chart was silent (15 views failed); squeezed to 220 px, the Sobol chart declares all four labels;
  - a phone chart's legend, which stood in a narrow column beside its title and left the size-distribution plot about 50 px tall. Below 860 px it runs under the title;
  - the Uncertainty histogram, which ranged its x axis on the bin centres and so cut its first and last bars in half. A bar chart on a numeric axis now reaches half a bin past them. Its bars keep their share of the bin at any width, where at 2560 px they had stopped at 64 px. The binning is tested over all 288 recorded distributions (the gate does not measure bar geometry);
  - the Optimizer headline, which gave the gain without its sign and read as the optimum's own recovered metal;
  - a failed build, which reported the Pages fallback's missing `index.html` instead of its own error.

## 0.05.000, 2026-09-26

### Local gate

- The committed bake of 2026-09-26: contract, cases (374.9 s on 12 workers), learning (1688.0 s, CUDA, RTX 4070 Laptop GPU), benchmark, manifests and validation; `validation.json` records `passed: true`. It is the re-run of the day's first bake after a catalog text correction (µm and P₂O₅), made into a sandbox and compared file by file before it was adopted whole: every case number is identical, the ONNX exports and the surrogate record are bit-identical, and the only numeric differences are 81 random-forest scores in `learning.json` and 9 in `benchmark.json`, at most 5.8e-15 relative. `scripts/check_artifacts.py` recomputes every unit balance of the 72 variants from the stored streams (within 1e-9), the contract digest, the byte counts and hashes of every artifact, and the method, learning, particle and GeoMet records.
- `scripts/smoke.ps1` passed in 89 s: the eight guards (template residue, content standards over 402 tracked files, CI budget, units, interface formulas, diagram languages and colours, SDD with 49 live requirements, artifacts), the use-case page check (13 pages), ruff, 341 Python tests, the typecheck, 165 frontend tests (the parity of all 72 variants within 1e-6 among them) and the production build.
- Browser gate on the served build of the release: the full matrix, 684 checks (1280x800, 1600x900 and 2560x1440; dark and light; English and Spanish), covering every view and sub-tab of the App route, the modal's five tabs, the focus route and its round trip, and every tab and sub-tab of the five content pages; the phone and tablet pass, 28 checks (both themes and both languages at 390x844 and 768x1024); and the App and focus routes of the gold, magnetite and phosphate circuits at 1280x800 and 2560x1440, 40 checks each. The screenshots were read: every Benchmark tab in all twelve combinations (as contact sheets); the Circuit view and the Case context in all four theme and language pairings at 1600x900, and the Circuit view at 390x844 and 768x1024 in light English and dark Spanish; every Methods record and the Response sweep in dark English and light Spanish at 1600x900; and further captures of every view at the other sizes while the defects above were found and fixed.
- The convergence verdict (`docs/design/features/process-engine-v2/tasks.md`, T23) runs the gate each of the 49 live requirements names: all 49 met.
- The full matrix and the checks added while it ran found, and this release fixes:
  - the case catalog, 1338 px wide at 1280x800 in Spanish;
  - the flowsheet, which stopped growing past a readable cell: at 2560x1440 it spanned 74.5% of its frame's width, and 73.4% on the focus route, while the gate's check of the svg's own box passed at 86.7%. It now scales as one piece, to 97.5%, and the gate measures the drawing against its frame;
  - with the drawing measured, the feed label under the readout column on the focus route at 1280x800, and the LIMS cleaner's concentrate and tail drawn along one line;
  - at phone width, the gate clause of PE-37 the desktop matrix did not cover: the rail's row shrunk to 61 px under its controls, flowsheet boxes overlapping (10 pairs in the copper circuit), a chart label over its axis; at 768 px in Spanish, the header's actions off the screen (shell known defect 10);
  - citation labels in English on Spanish pages (shell known defect 9), formulas without subscripts, "20 um" in the phosphate description, and the case provenance printed in English on the Spanish Case view (a scan of every view and page in Spanish for English words found nothing else);
  - the Benchmark uncertainty table, which needed 135 px of sideways scroll at 1280 px in Spanish, the Implementation gates table, widened past the page by its own new row, and the Response heatmap's ticks, which mixed precisions on one axis.

### Remote gate

- PR #36 (the release) and #37 (architecture 05's update steps) merged into `develop`; CI runs `36249347564` and `36249567624` passed the scientific, contracts and frontend jobs. Promotion PR #38 merged into `main` at `0d6245b3747f04097f25e6827924eab826e0971f`; CI `36249650821` and Pages `36249650834` passed for that commit, which carries the annotated tag `v0.05.000` and the GitHub release OreFlow v0.05.000.
- The ML VPS checkout fast-forwarded from `8897456` to `0d6245b`, installed the runtime requirements, built the site, returned the checkout to `fasl` and restarted the running `oreflow.service`; the local `/healthz` reported 0.05.000 and the checkout read back clean.
- The external checks of architecture 05, from outside the build machine:
  1. `https://oreflow.ml.fasl-work.com/healthz` reported 0.05.000.
  2. `/api/cases` answered `oreflow.index/v2` with 12 cases and 72 variants; `/api/benchmark` answered `oreflow.benchmark/v2` of 0.05.000 with the same contract digest.
  3. `POST /api/simulate` for the nominal states of the soft copper porphyry and the fine magnetite answered 200, `oreflow.live/v2`, lane `live-api`, with recovery equal to the bake within 1e-9 and every unit's balance closed (at most 1.0e-13 relative over 15 units, 4.2e-16 over 10); a throughput of 50,000 t/h answered 422, `oreflow.rejection/v1`, code `out_of_range`.
  4. On both hosts the root, `/methodology`, `/benchmark`, `/introduction` and `/experiments` (without the slash, after one redirect), `/methodology/`, `/benchmark/`, `/implementation/` and `/focus/copper_porphyry_soft` answered 200 with the app.
  5. The browser gate with `OF_BASE` set to each public host (the smoke pair of combinations with the five content pages, and the phone and tablet pass in both themes and languages) passed 142 checks on the VPS and 142 on Pages, and the captures were read. Its first VPS run failed only the architecture modal's tabs 2 to 5: the gate read the diagram before the next tab's diagram had arrived over the network (the capture shows it rendered), so the gate now waits for the tab's own diagram.
  6. The certificate served for `oreflow.ml.fasl-work.com` names that host (CN and SAN), is issued by Let's Encrypt YE1, is valid to 2026-12-12 and verifies.
- Scientific boundary: the twelve cases are authored inside published ranges, not calibrated plants; the learned lane's held-out-case scores bound transfer between authored plants. Felipe's acceptance of the design is not recorded.

## 0.04.000 and earlier

### Local scientific gate (0.04.000)

- Contract 1 validation: passed.
- Contract 2 artifact/index validation: passed.
- Coverage: 12 cases, 72 variants, 1,512 method records and 21 registered methods; check applicability separately.
- Python: Ruff passed and the full test suite passed.
- Data: HZDR RODARE workbook fetched, SHA256 recorded, and processed to an independent four-case particle benchmark; raw input remains ignored. The test sheet has constructed oracle probabilities but no realized test classes; case 4 has 663 rows excluded from the common finite comparison.
- Compute: PyTorch 2.12.0+cu126 executed a tensor operation and trained the circuit MLP, autoencoder and independent HZDR particle MLP on the local RTX 4070 Laptop GPU. `models/registry.json` records the simulator lane; the particle artifact independently records `device: cuda`. The particle ONNX export was tested against its local PyTorch checkpoint over 32 vectors (absolute/relative tolerance 0.000001) and exercised in a browser with changed feature inputs. This is local training evidence, not VPS GPU evidence.

### Local product gate (0.03.004 and 0.04.000)

#### 0.04.000 investigation and measured-data lane (2026-09-24)

- Local verification: all Python and frontend tests passed; Vite production build and Contract 2 artifact check passed. The GeoMet artifact is pinned to SHA256 `e7968c250c1ccc17b63da6d9624473dd92b32a7ba8d8772e70070a0115e42eda` and holds 52 eligible measured LCT rows, 29 holes, five whole-hole folds, three spatial-zone folds and four complete prediction matrices.
- Rendered interaction verification: EN/light and ES/dark at 390, 628, 1280 and 1600 px for the operating envelope, with no document overflow or JavaScript errors; constraint-empty state, reset, point selection, JSON download, apply-to-circuit, family switch and angular projection exercised. Measured Benchmark inspected at 390 and 1280 px with 52 rendered points, model/holdout switch and no document overflow/errors. Screenshots and JSON report are local ignored QA output.
- Local full-data GeoMet checkpoint and example five-assay CSV prediction smoke passed. Predictions are descriptive within this sparse source and are not plant set-points. The circuit simulator is still uncalibrated, and the four topology families remain a limitation.
- Remote CI, Pages, VPS HTTPS and live-browser verification are recorded below. Engineering verification does not establish user design acceptance or plant validity.

#### 0.03.004 focus and flowsheet correction (2026-09-24)

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

### Remote gate (0.04.000)

The remote gate is complete only after the public GitHub repository, GitHub Pages project site and `oreflow.ml.fasl-work.com` VPS service have each been checked from outside the local workspace. The deploy script performs health and catalog checks, while the operator record must include the final commit, workflow run and live URLs.

#### 0.04.000, 2026-09-24

- Feature PR #28 and content-standard correction #29 merged into `develop`; CI run `36006829137` passed scientific, contracts and frontend jobs. Promotion PR #30 merged into `main` at `f30f40406dfcb9a96b82c44ab294d80a882c51a7`; CI `36006937653` and Pages `36006937745` passed.
- A live health readback exposed a stale hard-coded API version. Corrective PR #31 merged into `develop` with CI `36007403877` passing; promotion PR #32 merged into final `main` commit `4c35fbc231602a40c2fc494dd070305c0d0c9099`. CI `36007515696` and Pages `36007515772` passed for that exact SHA.
- The ML VPS checkout fast-forwarded to `4c35fbc231602a40c2fc494dd070305c0d0c9099`, built the frontend and restarted the active `oreflow.service`. Public HTTPS `/`, `/methodology`, `/benchmark` and the compact GeoMet artifact returned 200; `/healthz` reported `0.04.000`. A public `/api/simulate` request for the magnetic case returned `oreflow.live/v1`, positive magnetic recovery and zero flotation recovery.
- Rendered public-domain QA at 390, 628, 1280 and 1600 px repeated the constraint, selection, export, apply-to-circuit, topology switch, projection and bilingual/theme interactions with no document overflow or browser errors. The measured Benchmark showed 52 points at 390 and 1280 px. Pages passed the same rendered interaction script. At 390 px, each of Introduction, Methodology, Implementation, Experiments and Benchmark scrolled within its fixed shell, and mobile Focus mode opened on the selected scenario.
- Remaining scientific boundary: no external operating-control/plant-metallurgy campaign calibrates the four circuit families. Measured GeoMet LCT prediction and simulator operating-point analysis must remain separate; this release is not a validated plant decision system. User visual acceptance remains open.
