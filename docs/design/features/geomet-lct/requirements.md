# Measured locked-cycle recovery lane

| ID | Requirement | Named gate |
| --- | --- | --- |
| GM-01 | WHEN the source is fetched, THE pipeline SHALL verify the exact published file checksum and license before processing. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_gm_01` |
| GM-02 | THE pipeline SHALL reject rows with missing or invalid LCT recovery and SHALL keep a row-level exclusion ledger. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_gm_02` |
| GM-03 | WHEN models are evaluated, THE pipeline SHALL fit imputation and scaling inside each training fold, and SHALL prevent same-hole reuse across train and test. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_gm_03` |
| GM-04 | THE pipeline SHALL report mean baseline, ridge, random forest and Gaussian-process predictions on the same original LCT rows under both hole and spatial-zone holdouts. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_gm_04` |
| GM-05 | THE web SHALL distinguish measured locked-cycle test recovery from authored simulator recovery and SHALL expose observed-versus-predicted values and spatial sample positions in a selectable view. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_gm_05` |
| GM-06 | THE result SHALL never imply plant operating-point calibration because grind, collector and residence are absent from the LCT source. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_gm_06` |
| GM-07 | WHEN a user supplies an assay CSV locally, THE pipeline SHALL validate the five-feature contract, fit or load a source-pinned checkpoint, emit all three learned predictions, and flag missing or out-of-training-range inputs. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_gm_07` |
