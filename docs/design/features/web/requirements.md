# Workbench shell and focus route: requirements

Status: live

ADR-0058 requires the shared application shell. ADR-0070 applies because OreFlow has an interactive process workbench with a selected case and live controls; Focus mode opens that process instrument in a stage-sized route and restores the selected state on return.

| ID | Requirement | Verification gate |
| --- | --- | --- |
| WB-014 | THE product SHALL declare whether its primary route is a workbench or a surface in `product.json`; the design gate SHALL reject an invalid kind and shall not let gate arguments redirect the required Focus measurement. | `tests/adversarial/test_app_kind.py::test_the_template_example_is_a_workbench_with_focus_and_passes` |
| WB-015 | WHEN a product waives Focus mode, THE waiver SHALL be limited to a surface and SHALL give the same substantive reason in `product.json` and the SDD's ADR-0070 row. | `tests/adversarial/test_app_kind.py::test_a_reason_that_differs_from_the_sdd_row_fails` |
| WB-016 | WHEN Focus mode displays a calculated flowsheet, THE App SHALL let the user step or play through its applicable unit operations, pause, adjust the step interval, and inspect each operation's computed input/output stream quantities, grades and balance closure; THE App SHALL identify this as a steady-state inspection sequence rather than elapsed plant time. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_wb_016` |
