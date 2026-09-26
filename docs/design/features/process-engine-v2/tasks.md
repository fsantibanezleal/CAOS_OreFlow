# Process engine v2 tasks

Each unit is finished with code, tests and its `docs/methodologies/` page (plus a `docs/frameworks/`
card for any library it introduces) in the same commit before the next one starts.

- [x] T01 Units registry, size grid, atomic weights, minerals, streams and balance auditor (PE-01, PE-02, PE-03, PE-33). Engine commit 8c62512; the shipped-artifact balance recheck of PE-02 lands with T16.
- [x] T02 Whiten matrix crusher and crushing energy (PE-04).
- [x] T03 Energy-specific PBM, mixers in series, Rosin-Rammler cyclone with bypass and density correction, water balance, target and power-limited solves (PE-05, PE-06, PE-07, PE-11, PE-22, PE-25).
- [x] T04 Plitt cyclone sizing (PE-12) and the Moly-Cop oracle (PE-08).
- [x] T05 Bond, operating work index, calibrated Rittinger and Kick, GMG oracle (PE-09, PE-10).
- [x] T06 Flotation banks, Sb kinetics, Savassi entrainment, water, cleaner recycle, stage recoveries, bank profile (PE-13 to PE-17, PE-21, PE-23, PE-24).
- [x] T07 Gravity gold in the grinding loop and the Laplante oracle (PE-18).
- [x] T08 LIMS magnetite and the Zandrivierspoort oracle (PE-19).
- [x] T09 Desliming (PE-20).
- [x] T10 Case catalog re-authored with sources; single-factor variants (PE-32, PE-34). Engine commit 8c62512.
- [x] T11 Contract 1 export, API validation, live API tests (PE-30, PE-30b). The browser validator and
  `frontend/src/test/contract.test.ts`, which replays `contract_probes.json`, land with T17 and T18.
- [x] T12 Kinetic fits and bank projection (PE-26): five lumped models, including the gamma form of the dossier.
- [x] T13 Constrained optimization (PE-27): grade, power and process-water constraints; water capacities authored per case.
- [x] T14 Uncertainty and Sobol (PE-28): scrambled Latin hypercube, authored spreads, SALib Saltelli indices.
- [x] T15 Learned lane with interpolation and leave-one-case-out protocols, ONNX (PE-29); the baked
  results and the test that pins the page's findings land with T16.
- [x] T16 Pipeline stages, artifacts, manifests, benchmark, non-vacuous validation, check_artifacts (PE-02).
  Canonical bake of 2026-09-26: 12 cases and 72 variants, validation passed (cases 375 s on twelve
  workers, learning 1688 s with CUDA; re-run after T21's catalog text correction, it reproduced every
  case number and ONNX export bit for bit, and the random-forest scores within 6e-15). The checker also rejects a case file the index does not list and
  holds the benchmark's variant metrics equal to the artifacts. The parity test's first run found the
  payable's recovery by size unresolvable in near-empty size classes; both engines now report those
  classes as empty below a declared share. Methodology page 14's findings are pinned to the record.
- [x] T17 TypeScript engine port, Web Worker sweeps, parity test on all variants (PE-31, PE-38).
  All 72 baked variants reproduce within 1e-6 relative (about 1e-14 on the physical metrics); the
  kinetic fits' step counts are diagnostics and are not compared. The worker test drives the real
  worker module; that sweeps start only from an explicit request is checked by
  `scripts/check_ui_formulas.py`, which lands with T18.
- [x] T18 Workbench, circuit, response, methods, compare and focus views on the new trace; locale formatter and document language (PE-35, PE-36, PE-37).
  The old workbench, its components and its tests are removed. The learned lane runs in the browser
  (PE-39). Gates: `trace-curves.test.ts`, `flowsheet.test.ts`, `locale.test.ts`, `surrogate.test.ts`,
  `scripts/check_ui_formulas.py` and `frontend/gate.mjs` (smoke run at 1280x800 dark English and
  1600x900 light Spanish: 24 checks pass, every screenshot read). The full matrix is T21.
- [x] T19 Methodology, Introduction, Implementation, Experiments, Benchmark content, citations and architecture modal from the dossier.
  Every page is topics on one layout (prose, equations, limits, a figure, references) and reads its
  numbers from the committed artifacts; `experiments-claims.test.ts` and `benchmark-claims.test.ts` hold
  every count, range and direction the pages state to the records (PE-40 extends to them). The gate
  now visits every tab of every page and measures boxes (its document-width check could not fail while
  the body is the scroll container), clipping inside views, equations wider than their box, figure text
  that crosses a box, the in-browser particle network, and the architecture modal in both languages.
  The pre-0.05 interface, its two stylesheets and its five diagrams are removed; `check_ui_formulas.py`
  exempts nothing, and `check_units.py`, `check_ui_formulas.py` and `check_arch_i18n.py` run in CI.
- [x] T20 `docs/` wiki tree, README, STRUCTURE, CHANGELOG, manuscript rewrite.
  The wiki has its six themes (architecture 01 to 05, methodologies 01 to 14, data contract 01 to 05,
  fifteen framework nodes with runnable Python examples that assert what they print, five guides, twelve
  use-case pages rendered from the records by `scripts/render_use_cases.mjs` and checked in CI), and
  `check_sdd.py` gates the design documents. Writing it against the code found and fixed: Spanish numbers
  printed with decimal points (a locale probe now gates it), five figure labels crossed by lines and an
  energy-law figure whose curves did not meet at their calibration point (a stroke probe), shell defect 1
  unapplied and a gate check that could not fail because of it, a Sobol record that ranked round-off, a
  CI budget gap for the GPU requirements, a broken smoke script, two English words in shared formulas (a
  test), variant notes that did not hold for every circuit, and a stale service README.
- [ ] T21 Canonical bake with the GPU lane; full test suite; guards; build; visual QA in both themes and languages at three viewports.
- [ ] T22 Release 0.05.000, backfilled tags, PRs, CI, Pages, VPS deploy, live verification, CAOS_MANAGE records.
- [ ] T23 Convergence verdict against every requirement.
