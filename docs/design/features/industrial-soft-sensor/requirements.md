# Industrial iron-flotation soft-sensor requirements

Status: implemented in 0.07.000 (CAOS_OreFlow #63); the convergence verdict is in `tasks.md`

Scope: issue #52, brought from branch `task/oreflow-industrial-soft-sensor` onto the 0.07 code. An observational
next-hour quality forecast on open data from one iron-ore plant, separate from the copper circuit and from any
set-point advice. Research: the dossier of 2026-09-28 (not published); the sources it verified are cited on [methodology page 16](../../../methodologies/16_industrial-soft-sensor.md).

| ID | Requirement | Named gate |
| --- | --- | --- |
| IS-01 | THE pipeline SHALL pin the publisher's CC0 version-1 archive by checksum, read the named CSV, verify its population (737,453 rows, 24 columns) and record every source row and hour. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_is_01` |
| IS-02 | THE pipeline SHALL reject every hour whose nominally hourly laboratory silica label varies within the hour (an interpolated label), and SHALL NOT treat the 20-second sensor rows as independent laboratory observations. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_is_02` |
| IS-03 | THE response SHALL be the next hour's measured silica in the concentrate. The learned predictors SHALL exclude both concentrate assays, the future target and the date. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_is_03` |
| IS-04 | THE evaluation SHALL use chronological, disjoint future windows with an expanding history and at least a 24-hour embargo between training and test, with every preprocessing step fitted inside the training window. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_is_04` |
| IS-05 | THE Benchmark page SHALL show the observed and predicted traces, the error per window and model, the persistence baseline, the exclusions and the one-plant, non-causal interpretation, with every quoted number held to the record. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_is_05` |
| IS-06 | THE lane SHALL stay separate from the copper locked-cycle recovery and the authored circuit's optimizer, and SHALL NOT recommend a set point. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_is_06` |
