# Prediction observable validation

| Requirement | Adversarial check | Gate |
|---|---|---|
| LO-001 | A fractional answer to a 40-60 percent observable, NaN output and unequal shapes are rejected; a poor finite same-unit forecast remains scoreable. | `tests/test_observable.py::test_adversarial_a_fraction_cannot_answer_a_percent_observable` |
| LO-002 | Repeated decimal training features with roundoff-sized variance retain unit scale when an unseen value is transformed. | `tests/test_observable.py::test_adversarial_numerically_constant_training_features_do_not_amplify_unseen_values` |
| LO-003 | A constant forecast is explicitly identified; a declared mean baseline has a separate status. | `tests/test_observable.py::test_adversarial_unexpected_constant_predictions_are_explicit_negative_evidence` |
| LO-004 | Tampered bounds/status and omitted diagnostics fail independent artifact consistency checks. | `tests/test_observable.py::test_adversarial_the_artifact_validator_recomputes_status_and_bounds` |
| LO-005 | A genuine out-of-range transfer retains null metrics and diagnostics; NaN and shape errors remain fatal. | `tests/test_learning_rejection.py::test_adversarial_only_range_failure_can_be_preserved_as_rejected_transfer` |
| LO-006 | One bad case inside a pooled group cannot be hidden by another case's overlapping predictions. | `tests/test_learning_rejection.py::test_adversarial_a_failed_individual_case_is_not_hidden_by_pooled_overlap` |
| LO-007 | A two-fold cohort with one rejected model retains both attempts and computes every model's matched scores on the same remaining fold. | `tests/test_learning_rejection.py::test_adversarial_denominators_and_matched_cohorts_preserve_failed_folds` |
