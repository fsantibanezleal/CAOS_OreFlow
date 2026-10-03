# Ablation study and page tabs requirements

Status: implemented in 0.07.000 (CAOS_OreFlow #63); the convergence verdict is in `tasks.md`

Scope: issues #56 (Implementation, at least 8 tabs) and #57 (Experiments, the six planned tabs with a baked
ablation study). The plan of 2026-09-13 lists the tabs; `plans/oreflow/plan-0.07.md` item 6 fixes them at 9 and 7.

| ID | Requirement | Named gate |
| --- | --- | --- |
| AB-01 | THE ablation study (`methods/ablations.py`) SHALL declare one switch per mechanism: `entrainment`, `composite_classes`, `cleaner_recirculation`, `regrind` and `gravity_bleed`. Four act on the case's parameters and one on an engine flag (`FlotationPlant.cleaner_tail_to_rougher`). Each is on by default and changes nothing when on. Amended in 0.08.000 (review of 0.07.000, W-03): it said the engine declares them. | `tests/test_ablations.py::test_switches_default_on_and_inert` |
| AB-02 | WHEN a mechanism is switched off, THE engine SHALL still close every balance within 1e-9 relative, and THE study record SHALL name the switch for every case. Amended in 0.08.000 (review of 0.07.000, W-03): it asked for the switch in the trace, which never recorded it. | `tests/test_ablations.py::test_closure_with_each_switch_off` |
| AB-03 | THE bake SHALL record, for every case whose circuit has the mechanism, the nominal state's recovery, grade, energy and recovered metal with the mechanism off, against on. A case without the mechanism SHALL be recorded as not applicable, not as zero. | `scripts/check_artifacts.py` ablation schema; `tests/test_ablations.py::test_not_applicable_is_not_zero` |
| AB-04 | THE browser SHALL reproduce every ablation record within 1e-6 relative. | `frontend/src/test/ablation-parity.test.ts` |
| PG-01 | THE Experiments page SHALL have seven tabs: design, data (every dataset with its licence, hash and use), splits (with the leakage-safe protocol diagram), metrics, variant effects, uncertainty, and ablations. | `frontend/gate.mjs` tab census; `frontend/src/test/pages.test.ts` |
| PG-02 | THE Implementation page SHALL have nine tabs: the six of 0.06, the model registry (every exported model, its inputs, outputs, training data, hash and parity tolerance), the GPU lane, and deployment. | `frontend/gate.mjs` tab census; `frontend/src/test/pages.test.ts` |
| PG-03 | EVERY number the new tabs quote SHALL be held to the records by a claim test. | `frontend/src/test/experiments-claims.test.ts`, `frontend/src/test/implementation-claims.test.ts` |
| PG-04 | EVERY new tab SHALL be browser-verified in both themes and languages at the three desktop viewports and on the phone, with the captures read, and SHALL pass the text-fit, ellipsis, rail and canvas-text probes. | `frontend/gate.mjs` full matrix |
