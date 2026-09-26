# Process engine v2 requirements

Scope: the complete rebuild tracked in issue #35. Every requirement names the check that fails when
it is violated. Test files are under `tests/` (Python) and `frontend/src/test/` (TypeScript).

## Streams and conservation

| ID | Requirement | Named gate |
| --- | --- | --- |
| PE-01 | THE engine SHALL represent every stream as mass flow in t/h by size class on one fixed fourth-root-of-two grid and by mineral, plus water in t/h. | `tests/test_engine_core.py::test_grid_and_stream_shapes` |
| PE-02 | THE engine SHALL close solids, each element and water at every unit and over the circuit within 1e-9 relative, computed from the output streams independently of the solver. | `tests/test_engine_balances.py::test_unit_and_circuit_closure_all_variants`; `scripts/check_artifacts.py` balance recheck of shipped artifacts |
| PE-03 | THE engine SHALL compute every element grade from mineral masses and stoichiometric element contents derived from standard atomic weights. | `tests/test_engine_core.py::test_stoichiometry_from_atomic_weights` |

## Comminution

| ID | Requirement | Named gate |
| --- | --- | --- |
| PE-04 | THE crusher SHALL compute `p = (I - C)(I - B C)^-1 f` with the Whiten classification function, conserve mass, and give a finer product for a smaller closed-side setting. | `tests/test_crusher.py::test_whiten_form_mass_and_css_response` |
| PE-05 | WHEN the target P80 is reachable within installed power, THE grinding solver SHALL return a steady state whose overflow P80 and circulating load match the target and design values within 0.5%. | `tests/test_grinding.py::test_target_and_circulating_load_met` |
| PE-06 | THE closed grinding circuit SHALL deliver all new-feed solids of each mineral to the overflow at steady state. | `tests/test_grinding.py::test_overflow_equals_new_feed_by_mineral` |
| PE-07 | IF the required mill power exceeds the installed power, THEN THE solver SHALL run at installed power, report `power_limited = true` and return the coarser achieved P80. | `tests/test_grinding.py::test_power_limited_mode` |
| PE-08 | WHERE the Moly-Cop default breakage parameters are used, THE closed-circuit solver SHALL reproduce the BallSim_Direct base-case specific energy (8.56 kWh/t) within 20% at its feed, F80, P80 and circulating load. | `tests/test_oracles.py::test_molycop_base_case` |
| PE-09 | THE energy report SHALL give the Bond operating work index `E / (10/sqrt(P80) - 10/sqrt(F80))` and SHALL reproduce the GMG worked example. | `tests/test_energy.py::test_gmg_worked_example` |
| PE-10 | THE Rittinger and Kick records SHALL be calibrated to Bond at the declared reference reduction, SHALL diverge from Bond away from it, and SHALL NOT enter the reported specific energy. | `tests/test_energy.py::test_laws_calibrated_and_not_summed` |

## Classification

| ID | Requirement | Named gate |
| --- | --- | --- |
| PE-11 | THE cyclone SHALL partition each particle class with the Rosin-Rammler form, a water bypass equal to the underflow water split of the water balance, and a density-corrected cut. | `tests/test_classification.py::test_partition_bypass_and_density_correction` |
| PE-12 | THE Plitt sizing SHALL return cyclone count, pressure and Plitt cut for the required cut, and the Plitt cut at the chosen count SHALL be within 10% of the required cut. | `tests/test_classification.py::test_plitt_sizing_consistency` |

## Separation

| ID | Requirement | Named gate |
| --- | --- | --- |
| PE-13 | THE flotation banks SHALL be perfectly mixed cells in series with per-cell recovery `(k tau + ENT w)/(1 + k tau + ENT w)`, and with ENT = 0 a bank SHALL equal `1 - (N/(N + k tau))^N`. | `tests/test_flotation.py::test_bank_reduces_to_tanks_in_series` |
| PE-14 | THE rate constant SHALL be proportional to bubble surface area flux `Sb = 6 Jg / D32`. | `tests/test_flotation.py::test_rate_follows_bubble_surface_flux` |
| PE-15 | THE degree of entrainment SHALL follow Savassi et al. (1998) and SHALL equal 0.2 at the entrainment parameter when the drainage parameter is 1. | `tests/test_flotation.py::test_savassi_entrainment` |
| PE-16 | THE cleaner tails SHALL recycle to the rougher feed and the recycle SHALL converge to a residual below 1e-10 t/h and a per-class relative change below 1e-12. | `tests/test_flotation.py::test_cleaner_recycle_converges` |
| PE-17 | THE stage recoveries SHALL be computed on each stage's own feed, and `flotation_recovery_pct` SHALL differ from overall recovery whenever an upstream loss exists. | `tests/test_flotation.py::test_stage_and_overall_recovery_are_distinct` |
| PE-18 | THE gold circuit SHALL treat a bleed of the cyclone underflow with a gravity unit; gold circulating load SHALL exceed ore circulating load; gravity recovery SHALL rise with bleed with diminishing returns. | `tests/test_separation.py::test_bleed_response_and_gold_circulating_load`; `tests/test_oracles.py::test_laplante_trend` |
| PE-19 | THE magnetite circuit SHALL recover more than 90% of liberated magnetite, and concentrate Fe grade SHALL rise when the target P80 falls from 75 to 45 um. | `tests/test_separation.py::test_grade_rises_with_finer_grind`; `tests/test_oracles.py::test_zandrivierspoort_trend` |
| PE-20 | THE phosphate circuit SHALL send desliming overflow to tailings, report the P2O5 lost to slimes, and a coarser desliming cut SHALL raise that loss. | `tests/test_separation.py::test_deslime_cut_tradeoff` |

## Physical directions

| ID | Requirement | Named gate |
| --- | --- | --- |
| PE-21 | WHEN collector dose rises, THE primary recovery SHALL NOT fall, and beyond the valuable-mineral saturation dose THE final concentrate grade SHALL fall, in every flotation case. | `tests/test_directions.py::test_collector_trades_grade_for_recovery` |
| PE-22 | WHEN ore hardness rises at fixed target and throughput, THE required specific energy SHALL rise; WHILE power-limited, THE achieved P80 SHALL coarsen, and WHERE the circuit has no slimes rejection, recovery SHALL NOT rise. | `tests/test_directions.py::test_hardness_effects` |
| PE-22b | WHERE the circuit rejects slimes, WHEN the product coarsens, THE slimes loss SHALL fall (the reason not to overgrind a desliming feed). | `tests/test_directions.py::test_desliming_coarser_product_reduces_slimes_loss` |
| PE-23 | WHEN throughput rises, THE flotation residence time SHALL fall and, WHERE the circuit has no slimes rejection, recovery SHALL NOT rise. | `tests/test_directions.py::test_throughput_effects` |
| PE-24 | WHEN gas velocity rises, THE rougher water recovery and entrained gangue SHALL rise. | `tests/test_directions.py::test_aeration_raises_entrainment` |
| PE-25 | WHEN the target P80 becomes finer, THE required energy SHALL rise and the valuable liberation SHALL rise. | `tests/test_directions.py::test_grind_energy_and_liberation` |

## Methods

| ID | Requirement | Named gate |
| --- | --- | --- |
| PE-26 | THE first-order, Kelsall, Klimpel, gamma and compressed/stretched exponential records SHALL be least-squares fits to the engine's batch curve, each reporting parameters, fit RMSE, convergence, the plant-bank projection under the bank residence distribution and its error against the exact distributed bank recovery. | `tests/test_kinetics.py::test_fits_and_bank_projection` |
| PE-27 | THE constrained optimizer SHALL maximize recovered primary element subject to grade, power and water constraints, report the slacks, and SHALL NOT report an infeasible point as optimal. | `tests/test_optimization.py::test_constraints_respected` |
| PE-28 | THE uncertainty record SHALL be seeded and report P05, P50, P95 and constraint probabilities; nominal variants SHALL carry first-order and total Sobol indices. | `tests/test_uncertainty.py::test_seeded_quantiles_and_sobol` |
| PE-29 | THE learned records SHALL be evaluated on an interpolation split and leave-one-case-out on recovery, grade and energy; the histogram gradient boosting method SHALL use `HistGradientBoostingRegressor`; the MLP SHALL stop on validation loss; the GP SHALL report interval coverage; the autoencoder SHALL report its threshold, false-alarm and false-accept rates. | `tests/test_learning.py::test_protocols_and_model_identity` (sandbox design); `scripts/check_artifacts.py` benchmark schema |

## Contracts, parity and provenance

| ID | Requirement | Named gate |
| --- | --- | --- |
| PE-30 | ONE contract SHALL declare every input's unit, bounds, step, applicability and cross-field rules; the exported JSON, the API validator and the browser SHALL accept and reject exactly the same states. | `tests/test_contract.py::test_export_matches_validator`; `tests/test_live_api.py::test_api_and_contract_agree`; `frontend/src/test/contract.test.ts` |
| PE-30b | Every state THE contract accepts SHALL be solved by the engine without error, with every unit closing within 1e-9 relative, a consistent particle-class split, no negative class mass and a strict-JSON trace. | `tests/test_contract.py::test_engine_solves_the_envelope` |
| PE-31 | THE TypeScript engine SHALL reproduce every baked variant's metrics and curves within 1e-6 relative. | `frontend/src/test/parity.test.ts` |
| PE-32 | Every variant SHALL change exactly one declared input relative to its case nominal. | `tests/test_cases.py::test_variants_are_single_factor` |
| PE-33 | Every numeric literal in the engine modules SHALL be declared with its unit and source, or be structural. | `scripts/check_units.py` in the CI guards job |
| PE-34 | Every case parameter SHALL carry its unit and the research section it comes from. | `tests/test_cases.py::test_parameters_carry_units_and_sources` |

## Interface

| ID | Requirement | Named gate |
| --- | --- | --- |
| PE-35 | THE document language SHALL follow the interface language on every route including `/focus`, and every number SHALL be formatted with the active locale. | `frontend/src/test/locale.test.ts`; browser gate `lang` check in both languages |
| PE-36 | No UI component SHALL re-implement an engine formula; every plotted curve SHALL come from the trace. | `scripts/check_ui_formulas.py`; `frontend/src/test/trace-curves.test.ts` |
| PE-37 | THE circuit view SHALL draw the recycle streams (cyclone underflow to mill, cleaner tails to rougher, gravity bleed) with tonnages from the trace. | `frontend/src/test/flowsheet.test.ts` on every baked variant; browser screenshot QA in both themes and languages at phone, tablet and desktop |
| PE-38 | Sweeps SHALL run in a Web Worker on request and SHALL NOT recompute on every slider event. | `frontend/src/test/worker-sweeps.test.ts`; `scripts/check_ui_formulas.py` rule 3 |
| PE-39 | THE browser SHALL compute the learned lane's features exactly as the bake does (1e-12 relative) and SHALL reproduce the exported surrogate's predictions and the guard's verdict at every case's nominal state from the reference the bake writes into `models/process_surrogate.json`. | `frontend/src/test/surrogate.test.ts` |
