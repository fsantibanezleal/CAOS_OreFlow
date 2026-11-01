# Prediction observable requirements

The scoring boundary checks prediction shape, finiteness and unit-scale consistency independently of accuracy.

| ID | Requirement | Named gate |
|---|---|---|
| LO-001 | THE scoring boundary SHALL reject non-finite or misaligned predictions and answers wholly outside the declared observable range widened by one full span. | `tests/test_observable.py::test_adversarial_a_fraction_cannot_answer_a_percent_observable` |
| LO-002 | THE learning transforms SHALL fit training rows only and SHALL treat numerically constant training features as unit scale. | `tests/test_observable.py::test_adversarial_numerically_constant_training_features_do_not_amplify_unseen_values` |
| LO-003 | THE score record SHALL identify unexpected constant predictions separately from declared constant baselines while retaining their numerical error as negative evidence. | `tests/test_observable.py::test_adversarial_unexpected_constant_predictions_are_explicit_negative_evidence` |
| LO-004 | THE shipped-artifact validator SHALL recompute range/status consistency and SHALL reject missing prediction diagnostics. | `tests/test_observable.py::test_adversarial_shipped_scores_cannot_omit_the_runtime_check` |
| LO-005 | WHEN a finite transfer prediction fails the range check, THE evaluator SHALL retain its context and diagnostics with null metrics and an explicit rejection; nonfinite, shape and fitting errors SHALL remain fatal. | `tests/test_learning_rejection.py::test_adversarial_only_range_failure_can_be_preserved_as_rejected_transfer` |
| LO-006 | WHEN an individual held-out case fails the range check, THE grouped evaluator SHALL retain the failed case even if pooled predictions overlap the envelope. | `tests/test_learning_rejection.py::test_adversarial_a_failed_individual_case_is_not_hidden_by_pooled_overlap` |
| LO-007 | THE comparisons SHALL retain attempted, scored and rejected fold counts and SHALL compare models on explicitly matched admissible cohorts. | `tests/test_learning_rejection.py::test_adversarial_denominators_and_matched_cohorts_preserve_failed_folds` |
| LO-008 | THE live learned view SHALL describe guard decisions as reconstruction-threshold signals without asserting training support or predictive accuracy, and SHALL identify its protocol scores as separately fitted fold models. | `frontend/src/workbench/views/LearningView.test.tsx::adversarial: threshold decisions cannot prove support or accuracy` |
| LO-009 | THE active target's conditional metrics SHALL retain their attempted/scored/rejected counts beside them, and full evidence SHALL remain reachable inside the existing learned-view instrument. | `frontend/src/workbench/views/LearningView.test.tsx::adversarial: complete evidence stays inside the existing aside`, `frontend/src/workbench/views/LearningView.test.tsx::adversarial: all-null conditional results retain planned attempts` |
