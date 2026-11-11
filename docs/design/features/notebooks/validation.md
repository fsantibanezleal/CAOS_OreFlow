# Validation

| requirement | adversarial check | gate |
|---|---|---|
| NB-001 | Remove a required topic from `notebooks/coverage.json`, hide authored prose in HTML or remove sensitivity and adaptation content; the static depth guard must fail without executing the notebook. | `tests/adversarial/test_check_notebook_depth.py::test_adversarial_complete_tool_coverage`; `tests/adversarial/test_check_notebook_depth.py::test_adversarial_hidden_dom_and_unclosed_comments_earn_nothing` |
