# Validation

| requirement | adversarial check | gate |
|---|---|---|
| WB-014 | Remove the workbench-kind declaration or try to move the Focus check to another route; the design guard must identify invalid product metadata or reject the redirected measurement. | `tests/adversarial/test_app_kind.py::test_the_template_example_is_a_workbench_with_focus_and_passes` |
| WB-015 | Change the waiver reason in only one of the product metadata and ADR-0070 row, or attempt the waiver on a workbench; the design guard must reject the inconsistent or inapplicable waiver. | `tests/adversarial/test_app_kind.py::test_a_reason_that_differs_from_the_sdd_row_fails` |
| WB-016 | Remove the topology-driven sequence or replace its stream ledger with empty values; the browser gate must fail stepping, active-unit synchronization, computed streams, interval playback or the pause control. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_wb_016` |
