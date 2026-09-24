# Operating-envelope investigation requirements

| ID | Requirement | Named gate |
| --- | --- | --- |
| OE-01 | WHEN a case is selected, THE workbench SHALL calculate a bounded, deterministic candidate set using that case's applicable controls and the same live engine as the circuit view. | `frontend/src/test/operating-envelope.test.ts`: family axes, repeatability; browser case-switch check. |
| OE-02 | WHEN nominal or stressed-recovery, grade, energy, water or collector limits change, THE workbench SHALL classify every candidate by each applicable explicit constraint and SHALL report an empty feasible set without inventing an optimum. | `operating-envelope.test.ts`: feasibility and impossible limits; browser constraint check. |
| OE-03 | THE workbench SHALL expose non-dominated feasible candidates under recovered valuable mass, power and collector mass (or magnetic water demand), and SHALL name the finite-grid boundary. | `operating-envelope.test.ts`: dominance oracle; browser readout check. |
| OE-04 | WHEN a candidate is inspected or applied, THE workbench SHALL show its settings and deltas against the current baseline, and application SHALL update the shared circuit state. | Pointer-driven browser apply/return check; `operating-envelope.test.ts`: candidate metrics. |
| OE-05 | WHERE a stress envelope is shown, THE workbench SHALL identify its declared parameter perturbations as sensitivity, not a confidence interval or plant uncertainty. | `operating-envelope.test.ts`: stress ordering; copy audit. |
| OE-06 | WHEN a record is exported, THE workbench SHALL include the case, process family, baseline, bounds, constraints, sampled candidates, selected candidate and scientific disclaimer in machine-readable JSON. | `operating-envelope.test.ts`: report schema and serialization; browser download check. |
| OE-07 | THE analysis SHALL fit the fixed viewport, remain keyboard and pointer operable, and present equivalent EN/ES labels in both themes. | Playwright 390/628/1280/1600 screenshots, DOM overflow and keyboard checks. |
