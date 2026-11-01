# Release result collection requirements

| ID | EARS requirement | Gate |
| --- | --- | --- |
| RR-01 | WHEN collecting records, the collector SHALL require learning v2 and matching engine/contract identities across the learning record, index, manifests and cases. | `tests/test_collect_results.py::test_adversarial_mixed_identity_refused` |
| RR-02 | WHEN resolving indexed artifacts, the collector SHALL reject missing, duplicate, foreign, hash-drifted or unlisted case/manifest files and inconsistent counts. | `tests/test_collect_results.py::test_adversarial_catalog_corruption_refused` |
| RR-03 | WHEN exporting learning scores, the collector SHALL validate persisted status, evaluation identity and summary consistency, retain rejected IDs/null metrics/affected rows, and expose attempted/scored/rejected denominators. | `tests/test_collect_results.py::test_adversarial_dishonest_scores_and_cohorts_refused` |
| RR-04 | WHEN comparing models, the collector SHALL show conditional summaries separately from comparisons on identical admissible fold IDs, including null summaries for empty cohorts. | `tests/test_collect_results.py::test_adversarial_empty_admissible_set_stays_null_and_keeps_hard_folds` |
| RR-05 | WHEN collecting uncertainty evidence, the collector SHALL retain seed-specific folds and summaries, GP coverage with row denominators and guard rates with declared probe counts. | `tests/test_collect_results.py::test_adversarial_uncertainty_evidence_refused` |
| RR-06 | WHEN comparing optimizer runs, the collector SHALL pair screened and unscreened records for the same variant, distinguish infeasible outcomes from feasible endpoint agreement, and keep exact calls separate from screening/audit counts. | `tests/test_collect_results.py::test_adversarial_optimizer_dishonesty_refused` |
| RR-07 | WHEN rendering JSON or Markdown, the collector SHALL produce deterministic complete tables with named algorithms, units, denominators and input SHA256 provenance, without manufacturing numerical results or rankings. | `tests/test_collect_results.py::test_adversarial_output_cannot_drop_null_rows_or_input_hashes` |
| RR-08 | WHEN given output paths, the CLI SHALL reject repository/input destinations and accept only external paths or stdout, without changing any input. | `tests/test_collect_results.py::test_adversarial_cli_refuses_unsafe_output_without_modifying_input` |

Inputs are authored simulator evidence. Collection is preparation for scientific
interpretation, not measured plant validation or a release acceptance gate.
