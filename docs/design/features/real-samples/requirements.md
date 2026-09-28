# Real-sample mode requirements

Status: planned (0.07.000, CAOS_OreFlow #63)

Scope: issue #51. The workbench's source is a synthetic case, a GeoMet ore sample or an iron-plant hour. Research:
CAOS_MANAGE `wip/oreflow/research-2026-09-28-0.07.md` sections 4 and 5; the soft sensor's own requirements are
IS-01 to IS-06 (`features/industrial-soft-sensor/`).

| ID | Requirement | Named gate |
| --- | --- | --- |
| RS-01 | THE pipeline SHALL read the GeoMet comminution and locked-cycle tables from the pinned Zenodo 7051975 files, verify their SHA-256, and record every row it excludes, with the reason. | `tests/test_real_samples.py::test_sources_pinned_and_ledger` |
| RS-02 | THE pipeline SHALL compute each comminution sample's Bond ball-mill work index as `1.1023 * 44.5 / (P1^0.23 * Gbp^0.82 * (10/sqrt(P80) - 10/sqrt(F80)))` from its BWI test columns. It SHALL label the column mapping as inferred and reproduce 15.2 to 26.1 kWh/t, median 20.2, over the 60 samples. | `tests/test_real_samples.py::test_bond_work_index` |
| RS-03 | THE pipeline SHALL set a locked-cycle sample's feed by a normative mineralogy (Cu to chalcopyrite, the remaining S to pyrite, the rest gangue) and label it an assumption. IF the assays cannot close (S below chalcopyrite's need), THEN it SHALL exclude the sample and record why. | `tests/test_real_samples.py::test_normative_mineralogy` |
| RS-04 | THE pipeline SHALL give each locked-cycle sample the work index of the nearest comminution sample in its drill hole, or the deposit median, and SHALL record which and the distance. | `tests/test_real_samples.py::test_work_index_assignment` |
| RS-05 | THE engine SHALL run the soft porphyry's circuit on each sample's feed and work index, at the case's nominal operating point, and the record SHALL keep the engine's recovery beside the measured locked-cycle recovery and the GeoMet lane's out-of-fold predictions. | `scripts/check_artifacts.py` real-sample schema; `tests/test_real_samples.py::test_record_fields` |
| RS-06 | THE browser SHALL reproduce each sample's engine run within 1e-6 relative. | `frontend/src/test/real-samples-parity.test.ts` |
| RS-07 | WHEN an iron-plant hour is the source, THE workbench SHALL show the hour's sensors and lab grades, the soft sensor's out-of-fold next-hour silica against the measured value, and the persistence baseline. The engine views SHALL state that the plant's reverse cationic circuit is not an engine family. | `frontend/gate.mjs` real-sample checks; `frontend/src/test/real-samples-claims.test.ts` |
| RS-08 | WHILE a real sample is the source, THE rail SHALL disable the controls that describe the datum (the ore, the head grade, the work index), keep the plant's operating controls, and say why each disabled one is fixed. | `frontend/gate.mjs` rail check in each source |
| RS-09 | THE Case view SHALL state what the sample fixes and what the engine still authors (the circuit, the breakage and flotation parameters, the liberation). | `frontend/src/test/real-samples-claims.test.ts` |
| RS-10 | THE browser gate SHALL cover each source in both themes and languages at the three desktop viewports and on the phone. | `frontend/gate.mjs` matrix with the source axis |
