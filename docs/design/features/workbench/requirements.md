# Requirements: OreFlow case workbench

The App is an instrument for selecting one processing case, changing its operating state and inspecting computed results with their provenance.

| ID | Requirement | Gate |
|---|---|---|
| OFW-001 | WHEN a reader selects a case, variant or operating control, THE workbench SHALL recompute the case-specific circuit and expose linked process-unit streams, model results, uncertainty and source status for that selected state. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_wb_016`; `frontend/scripts/gate.mjs` |
