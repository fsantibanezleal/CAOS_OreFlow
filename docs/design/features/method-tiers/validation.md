# Validation

| requirement | adversarial check | gate |
|---|---|---|
| MT-001 | Remove a method's notebook mapping or thin its manuscript section below the evidence floor; the depth guards must reject the missing coverage. | `tests/adversarial/test_check_notebook_depth.py::test_adversarial_complete_tool_coverage`; `tests/adversarial/test_manuscript_depth.py::test_adversarial_a_method_or_contract_left_out_of_the_report_fails` |
