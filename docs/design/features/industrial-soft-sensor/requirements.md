# Industrial iron-flotation soft-sensor requirements

Status: planned (0.07.000, CAOS_OreFlow #63)

Scope: issue #52, brought from branch `task/oreflow-industrial-soft-sensor` onto the 0.07 code. An observational
next-hour quality forecast on open data from one iron-ore plant, separate from the copper circuit and from any
set-point advice. Research: CAOS_MANAGE `wip/oreflow/research-2026-09-28-0.07.md` section 5.

| ID | Requirement | Named gate |
| --- | --- | --- |
| IS-01 | THE pipeline SHALL pin the publisher's CC0 version-1 archive by SHA-256, read the named CSV, verify its population (737,453 rows, 24 columns) and record every source row and hour. | `tests/test_iron_plant.py::test_source_pinned_and_population`; `scripts/check_artifacts.py` |
| IS-02 | THE pipeline SHALL reject every hour whose nominally hourly laboratory silica label varies within the hour (an interpolated label), and SHALL NOT treat the 20-second sensor rows as independent laboratory observations. | `tests/test_iron_plant.py::test_interpolated_hours_excluded` |
| IS-03 | THE response SHALL be the next hour's measured silica in the concentrate. The learned predictors SHALL exclude both concentrate assays, the future target and the date. | `tests/test_iron_plant.py::test_features_and_pairs` |
| IS-04 | THE evaluation SHALL use chronological, disjoint future windows with an expanding history and at least a 24-hour embargo between training and test, with every preprocessing step fitted inside the training window. | `tests/test_iron_plant.py::test_forward_windows_and_embargo` |
| IS-05 | THE Benchmark page SHALL show the observed and predicted traces, the error per window and model, the persistence baseline, the exclusions and the one-plant, non-causal interpretation, with every quoted number held to the record. | `frontend/src/test/iron-plant-claims.test.ts`; `frontend/gate.mjs` benchmark tab census |
| IS-06 | THE lane SHALL stay separate from the copper locked-cycle recovery and the authored circuit's optimizer, and SHALL NOT recommend a set point. | `tests/test_iron_plant.py::test_no_set_point_advice`; `frontend/src/test/iron-plant-claims.test.ts` |
