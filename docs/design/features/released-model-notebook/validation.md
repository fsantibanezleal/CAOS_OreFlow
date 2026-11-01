# Released-model notebook validation

| Requirement | Adversarial check | Gate |
|---|---|---|
| LN-01 | Wrong release/digest or model identity cannot be presented as a valid released-model experiment. | `tests/test_notebook_methods.py::test_adversarial_released_model_provenance` |
| LN-02 | Distinct three-target values cannot be silently reordered or reduced to recovery alone. | `tests/test_notebook_methods.py::test_adversarial_released_model_targets` |
| LN-03 | A deliberately insensitive guard's accepted out-of-bound feature probes remain in counts and output. | `tests/test_notebook_methods.py::test_adversarial_guard_misses_are_retained` |
| LN-04 | A fixture whose GP mean differs from its neural prediction exposes a wrong interval centre; empty accepted subsets remain null. | `tests/test_notebook_methods.py::test_adversarial_gp_coverage_uses_its_own_mean` |

These regressions exercise the actual notebook diagnostic helpers with explicit adversarial inputs. They do not
substitute for fresh execution with the completed release's real artifacts. The final local gate executes all
32 notebooks in fresh kernels, checks numeric bindings and errors, and reviews actual EN/ES outputs and figures.
