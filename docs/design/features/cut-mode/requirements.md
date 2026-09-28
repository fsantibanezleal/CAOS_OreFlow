# Classifier-cut mode requirements

Status: planned (0.07.000, CAOS_OreFlow #63)

Scope: issue #55. In operation the cyclone's cut is set by its hardware and pressure, the mill draws its power,
and the product size and circulating load follow. The engine's target mode solves the reverse. The cut mode adds
the operating direction on the same contract, in both engines. Research: CAOS_MANAGE
`wip/oreflow/research-2026-09-28-0.07.md` section 3.

| ID | Requirement | Named gate |
| --- | --- | --- |
| CM-01 | THE contract SHALL declare `grinding_mode` (`target`, the 0.06 behaviour and the default; or `cut`) and, for the cut mode, the host mineral's corrected cut `d50c_um` with per-case bounds, a step and bilingual messages. The cross-field rule SHALL reject `target_p80_um` and `circulating_load` as inputs in the cut mode. | `tests/test_contract.py::test_cut_mode_declared_and_exclusive`; `frontend/src/test/contract.test.ts` |
| CM-02 | WHILE the cut mode is on, THE grinding solver SHALL hold the given cut and solve the energy per pass for which the mill draws the installed power, `e (1 + C(e, d50c)) F = P_installed`. `C` is the circulating load at that energy and cut, and `F` the new feed (t/h). | `tests/test_grinding.py::test_cut_mode_meets_installed_power` |
| CM-03 | WHILE the cut mode is on, THE engine SHALL report the achieved P80, the circulating load and the specific energy as results, and SHALL flag `circulating_load_out_of_range` when the load leaves the declared plausible range. | `tests/test_grinding.py::test_cut_mode_reports_and_flags` |
| CM-04 | THE two modes SHALL agree where they meet: a target-mode state, re-run in the cut mode at its own solved cut and at the target mode's power, reproduces its P80 and circulating load within 0.5%. | `tests/test_grinding.py::test_modes_agree_at_the_same_state` |
| CM-05 | THE balance audit SHALL close every unit and the circuit within 1e-9 relative in the cut mode. | `tests/test_engine_balances.py::test_cut_mode_closure`; `scripts/check_artifacts.py` |
| CM-06 | THE bake SHALL carry, per case, a cut-mode variant at the nominal state's solved cut and one at a finer cut, and the browser SHALL reproduce them within 1e-6 relative. | `frontend/src/test/parity.test.ts` over all variants |
| CM-07 | THE Grinding view SHALL show which quantities are set and which follow in the loaded mode, and the rail SHALL enable only the inputs of that mode. | `frontend/gate.mjs` grinding-mode check, both modes, themes and languages |
| CM-08 | THE Methodology's comminution page SHALL give both formulations, with their equations and sources. | `frontend/src/test/methodology-claims.test.ts` cut-mode block |
