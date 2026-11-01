# Prediction observable requirements

The scoring boundary checks prediction shape, finiteness and unit-scale consistency independently of accuracy.

| ID | Requirement | Named gate |
|---|---|---|
| LO-001 | THE scoring boundary SHALL reject non-finite or misaligned predictions and answers wholly outside the declared observable range widened by one full span. | `tests/test_observable.py::test_adversarial_a_fraction_cannot_answer_a_percent_observable` |
| LO-002 | THE learning transforms SHALL fit training rows only and SHALL treat numerically constant training features as unit scale. | `tests/test_observable.py::test_adversarial_numerically_constant_training_features_do_not_amplify_unseen_values` |
| LO-003 | THE score record SHALL identify unexpected constant predictions separately from declared constant baselines while retaining their numerical error as negative evidence. | `tests/test_observable.py::test_adversarial_unexpected_constant_predictions_are_explicit_negative_evidence` |
| LO-004 | THE shipped-artifact validator SHALL recompute range/status consistency and SHALL reject missing prediction diagnostics. | `tests/test_observable.py::test_adversarial_shipped_scores_cannot_omit_the_runtime_check` |
