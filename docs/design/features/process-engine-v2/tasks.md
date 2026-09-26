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
- [x] T21 Canonical bake with the GPU lane; full test suite; guards; build; visual QA in both themes and languages at three viewports.
  The bake was re-run after a catalog text correction and adopted whole: every case number and ONNX
  export reproduced bit for bit, and the random-forest scores within 6e-15. `scripts/smoke.ps1` passes
  (341 Python and 165 frontend tests). The browser gate passes the full matrix (684 checks), its new phone
  and tablet pass (28, both themes and languages at each size) and the gold, magnetite and phosphate
  circuits (40 each); the screenshots were read. Its runs found, and the release fixes: the Spanish case
  catalog wider than a 1280 px page; a flowsheet that stopped growing past a readable cell while the gate
  measured the svg's own box (the gate now measures the drawing against its frame); the focus route's feed
  label under the readout column; the LIMS cleaner's two products on one line; at phone width, the rail
  shrunk under its controls, overlapping flowsheet boxes and a chart label over its axis; the header's
  actions off the screen at tablet widths in Spanish (shell known defect 10); citation labels in English
  on Spanish pages (defect 9); formulas without subscripts; "20 um" in the phosphate description; the
  case provenance in English on the Spanish Case view; the Benchmark uncertainty table, which needed a
  sideways scroll at 1280 px (a gate check now fails that); the Implementation gates table, widened past
  a 1280 px page by its own new row; and the Response heatmap's ticks, which mixed precisions on one axis.
- [x] T22 Release 0.05.000, backfilled tags, PRs, CI, Pages, VPS deploy, live verification, CAOS_MANAGE records.
  Tags `v0.02.000` to `v0.04.000` backfilled; PRs #36 to #40 through `develop` and `main` with every CI and
  Pages run green; the annotated tag `v0.05.000` and its GitHub release; the VPS updated with the steps of
  architecture 05 (the setup script is not the update path); the six external checks passed, the browser
  gate with 142 checks on each public host (`docs/release-verification.md`, remote gate); CAOS_MANAGE
  carries the product, deployment, plan, registry and manuscript records, and issue #35 is closed.
- [x] T23 Convergence verdict against every requirement.
  Every live requirement (the 42 of this feature and the 7 of `geomet-lct`) runs the gate it names on the
  release: 49 of 49 met (the table below). Not requirements, and still open: Felipe's acceptance of the
  design, and any plant calibration (the twelve cases are authored inside published ranges).

## Convergence verdict, 0.05.000 (2026-09-26)

ADR-0075 section 4: each live requirement, the gate it names, and that gate's result on the release (the
committed bake, the smoke run, and the browser gate's records on the served build). A parametrized test
passes when every one of its cases does.

| Requirement | Named gate | Result on the release |
|---|---|---|
| PE-01 | `tests/test_engine_core.py::test_grid_and_stream_shapes` | `test_grid_and_stream_shapes` passed |
| PE-02 | `tests/test_engine_balances.py::test_unit_and_circuit_closure_all_variants`; `scripts/check_artifacts.py` balance recheck of shipped artifacts | `test_unit_and_circuit_closure_all_variants` passed (72 cases); `check_artifacts.py` passed |
| PE-03 | `tests/test_engine_core.py::test_stoichiometry_from_atomic_weights` | `test_stoichiometry_from_atomic_weights` passed |
| PE-04 | `tests/test_crusher.py::test_whiten_form_mass_and_css_response` | `test_whiten_form_mass_and_css_response` passed |
| PE-05 | `tests/test_grinding.py::test_target_and_circulating_load_met` | `test_target_and_circulating_load_met` passed (12 cases) |
| PE-06 | `tests/test_grinding.py::test_overflow_equals_new_feed_by_mineral` | `test_overflow_equals_new_feed_by_mineral` passed (12 cases) |
| PE-07 | `tests/test_grinding.py::test_power_limited_mode` | `test_power_limited_mode` passed |
| PE-08 | `tests/test_oracles.py::test_molycop_base_case` | `test_molycop_base_case` passed |
| PE-09 | `tests/test_energy.py::test_gmg_worked_example` | `test_gmg_worked_example` passed |
| PE-10 | `tests/test_energy.py::test_laws_calibrated_and_not_summed` | `test_laws_calibrated_and_not_summed` passed |
| PE-11 | `tests/test_classification.py::test_partition_bypass_and_density_correction` | `test_partition_bypass_and_density_correction` passed |
| PE-12 | `tests/test_classification.py::test_plitt_sizing_consistency` | `test_plitt_sizing_consistency` passed (12 cases) |
| PE-13 | `tests/test_flotation.py::test_bank_reduces_to_tanks_in_series` | `test_bank_reduces_to_tanks_in_series` passed |
| PE-14 | `tests/test_flotation.py::test_rate_follows_bubble_surface_flux` | `test_rate_follows_bubble_surface_flux` passed |
| PE-15 | `tests/test_flotation.py::test_savassi_entrainment` | `test_savassi_entrainment` passed |
| PE-16 | `tests/test_flotation.py::test_cleaner_recycle_converges` | `test_cleaner_recycle_converges` passed (11 cases) |
| PE-17 | `tests/test_flotation.py::test_stage_and_overall_recovery_are_distinct` | `test_stage_and_overall_recovery_are_distinct` passed |
| PE-18 | `tests/test_separation.py::test_bleed_response_and_gold_circulating_load`; `tests/test_oracles.py::test_laplante_trend` | `test_bleed_response_and_gold_circulating_load` passed; `test_laplante_trend` passed |
| PE-19 | `tests/test_separation.py::test_grade_rises_with_finer_grind`; `tests/test_oracles.py::test_zandrivierspoort_trend` | `test_grade_rises_with_finer_grind` passed; `test_zandrivierspoort_trend` passed |
| PE-20 | `tests/test_separation.py::test_deslime_cut_tradeoff` | `test_deslime_cut_tradeoff` passed |
| PE-21 | `tests/test_directions.py::test_collector_trades_grade_for_recovery` | `test_collector_trades_grade_for_recovery` passed (11 cases) |
| PE-22 | `tests/test_directions.py::test_hardness_effects` | `test_hardness_effects` passed (11 cases) |
| PE-22b | `tests/test_directions.py::test_desliming_coarser_product_reduces_slimes_loss` | `test_desliming_coarser_product_reduces_slimes_loss` passed |
| PE-23 | `tests/test_directions.py::test_throughput_effects` | `test_throughput_effects` passed (10 cases) |
| PE-24 | `tests/test_directions.py::test_aeration_raises_entrainment` | `test_aeration_raises_entrainment` passed (9 cases) |
| PE-25 | `tests/test_directions.py::test_grind_energy_and_liberation` | `test_grind_energy_and_liberation` passed (4 cases) |
| PE-26 | `tests/test_kinetics.py::test_fits_and_bank_projection` | `test_fits_and_bank_projection` passed (11 cases) |
| PE-27 | `tests/test_optimization.py::test_constraints_respected` | `test_constraints_respected` passed (4 cases) |
| PE-28 | `tests/test_uncertainty.py::test_seeded_quantiles_and_sobol` | `test_seeded_quantiles_and_sobol` passed |
| PE-29 | `tests/test_learning.py::test_protocols_and_model_identity` (sandbox design); `scripts/check_artifacts.py` benchmark schema | `test_protocols_and_model_identity` passed; `check_artifacts.py` passed |
| PE-30 | `tests/test_contract.py::test_export_matches_validator`; `tests/test_live_api.py::test_api_and_contract_agree`; `frontend/src/test/contract.test.ts` | `test_export_matches_validator` passed; `test_api_and_contract_agree` passed; `contract.test.ts` 2 tests passed |
| PE-30b | `tests/test_contract.py::test_engine_solves_the_envelope` | `test_engine_solves_the_envelope` passed (12 cases) |
| PE-31 | `frontend/src/test/parity.test.ts` | `parity.test.ts` 72 tests passed |
| PE-32 | `tests/test_cases.py::test_variants_are_single_factor` | `test_variants_are_single_factor` passed (12 cases) |
| PE-33 | `scripts/check_units.py` in the CI guards job | `check_units.py` passed |
| PE-34 | `tests/test_cases.py::test_parameters_carry_units_and_sources` | `test_parameters_carry_units_and_sources` passed (12 cases) |
| PE-35 | `frontend/src/test/locale.test.ts`; browser gate `lang` check in both languages | `locale.test.ts` 9 tests passed; browser gate: 832 checks passed (en, es) |
| PE-36 | `scripts/check_ui_formulas.py`; `frontend/src/test/trace-curves.test.ts` | `check_ui_formulas.py` passed; `trace-curves.test.ts` 12 tests passed |
| PE-37 | `frontend/src/test/flowsheet.test.ts` on every baked variant; browser screenshot QA in both themes and languages at phone, tablet and desktop | `flowsheet.test.ts` 24 tests passed; browser gate: 832 checks passed (en, es); the Circuit view read in all four theme and language pairings at 1600x900, and in light English and dark Spanish at 390x844 and 768x1024 |
| PE-38 | `frontend/src/test/worker-sweeps.test.ts`; `scripts/check_ui_formulas.py` rule 3 | `worker-sweeps.test.ts` 4 tests passed; `check_ui_formulas.py` passed |
| PE-39 | `frontend/src/test/surrogate.test.ts` | `surrogate.test.ts` 13 tests passed |
| PE-40 | `frontend/src/test/case-claims.test.ts`; browser gate case/Context screenshots | `case-claims.test.ts` 10 tests passed; browser gate: 832 checks passed (en, es); the Case context read in all four theme and language pairings at 1600x900 |
| GM-01 | `tests/test_geomet.py::test_source_hash`; fetch script checksum check. | `test_source_hash` passed; the source was not re-fetched in this release; its pinned SHA256 is checked by `test_source_hash` and by `check_artifacts.py` |
| GM-02 | `tests/test_geomet.py::test_contract_and_missingness`. | `test_contract_and_missingness` passed |
| GM-03 | `tests/test_geomet.py::test_group_splits`; artifact fold auditor. | `test_group_splits` passed; `check_artifacts.py` holds the committed artifact to 5 hole folds and 3 zone folds over the 52 rows; hole disjointness is `test_group_splits` |
| GM-04 | `tests/test_geomet.py::test_benchmark_matrix`; artifact coverage guard. | `test_benchmark_matrix` passed; `check_artifacts.py` holds the four-model matrix and every prediction complete under both protocols |
| GM-05 | `frontend/gate.mjs`: every tab of the Benchmark page, the measured-lane tables loaded, in both themes and languages; every screenshot read. | browser gate: 96 Benchmark tab checks in 12 viewport, theme and language combinations passed; all 96 Benchmark captures read, as contact sheets |
| GM-06 | Copy audit, `tests/test_geomet.py::test_evidence_boundary`. | `test_evidence_boundary` passed; copy audit: the Benchmark page statements are held to the records by `benchmark-claims.test.ts` (6 tests passed), and the SDD sentence on the GeoMet result was corrected in this release |
| GM-07 | `tests/test_geomet.py::test_assay_input_contract`; local batch smoke with a source-free input file. | `test_assay_input_contract` passed; local batch smoke: `run_geomet.py --predict data/examples/geomet-assays.csv` wrote three model predictions and the evidence boundary for 1 row, 0 outside the reference range |

49 live requirements; 49 met; unmet: none.
