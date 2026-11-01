# Released-model notebook requirements

The learning comparison must exercise the already declared production networks, reconstruction guard and GP
intervals, alongside its separate four-reference experiment. No model is retrained for this addition.

| ID | Requirement | Gate |
|---|---|---|
| LN-01 | THE worked experiment SHALL require matching release version, contract digest and declared model-file identity before using frozen production artifacts. | `tests/test_notebook_methods.py::test_adversarial_released_model_provenance` |
| LN-02 | THE inference comparison SHALL retain all three named neural targets in their declared units and SHALL identify its separately seeded simulator challenge independently of held-out-fold scores. | `tests/test_notebook_methods.py::test_adversarial_released_model_targets` |
| LN-03 | THE guard experiment SHALL retain unchanged features and controlled synthetic continuous-feature probes outside declared global bounds, frozen threshold decisions and accepted shifted probes. | `tests/test_notebook_methods.py::test_adversarial_guard_misses_are_retained` |
| LN-04 | THE interval experiment SHALL centre intervals on the production GP mean and SHALL report complete-cohort and per-case coverage before any filtered subset, using null metrics when a subset is empty. | `tests/test_notebook_methods.py::test_adversarial_gp_coverage_uses_its_own_mean` |
