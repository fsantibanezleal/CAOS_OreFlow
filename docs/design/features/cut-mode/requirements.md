# Classifier-cut mode requirements

Status: implemented in 0.07.000 (CAOS_OreFlow #63); the convergence verdict is in `tasks.md`

Scope: issue #55. In operation the cyclone's cut is set by its hardware and pressure, the mill draws its power,
and the product size and circulating load follow. The engine's target mode solves the reverse. The cut mode adds
the operating direction on the same contract, in both engines. Research: the dossier of 2026-09-28 (not published); the sources it verified are cited on [methodology page 03](../../../methodologies/03_grinding-circuit.md).

| ID | Requirement | Named gate |
| --- | --- | --- |
| CM-01 | THE contract SHALL declare the host mineral's corrected cut `d50c_um` for every case, bounded by 0.8 and 1.6 times the cut the target mode solves at the nominal state, with a step and bilingual messages, and SHALL accept 0 (the nominal) as the target mode. A positive cut is the cut mode, in which the engine ignores `target_p80_um` and `circulating_load` and reports them as results (changed during T2: one numeric input, not a `grinding_mode` enumeration plus a rule on which inputs are given; design, Contract). | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_01` |
| CM-02 | WHILE the cut mode is on, THE grinding solver SHALL hold the given cut and solve the energy per pass for which the mill draws the installed power, `e (1 + C(e, d50c)) F = P_installed`. `C` is the circulating load at that energy and cut, and `F` the new feed (t/h). | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_02` |
| CM-03 | WHILE the cut mode is on, THE engine SHALL report the achieved P80, the circulating load and the specific energy as results, and SHALL flag `circulating_load_out_of_range` when the load leaves the declared plausible range. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_03` |
| CM-04 | THE two modes SHALL agree where they meet: a target-mode state, re-run in the cut mode at its own solved cut and at the target mode's power, reproduces its P80 and circulating load within 0.5%. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_04` |
| CM-05 | THE balance audit SHALL close every unit and the circuit within 1e-9 relative in the cut mode. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_05` |
| CM-06 | THE bake SHALL carry, per case, a cut-mode variant at the nominal state's solved cut and one at 0.8 of it (8 variants per case, 96 in all), and the browser SHALL reproduce them within 1e-6 relative. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_06` |
| CM-07 | THE Grinding view SHALL show which quantities are set and which follow in the loaded mode, and the rail SHALL enable only the inputs of that mode. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_07` |
| CM-08 | THE Methodology's comminution page SHALL give both formulations, with their equations and sources. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_08` |
| CM-09 | WHEN the mill cannot draw its installed power at the held cut, or the cut sets a circulating load above `grinding.cut_mode_load_max` (600%, authored), THE engine SHALL refuse the state with the code `power_unreachable_at_cut` or `circulating_load_above_bound`, in Python, the service (HTTP 422, `oreflow.rejection/v1`) and the browser, and no method SHALL report it as solved: the optimizer counts it infeasible and the uncertainty record counts it as a refused draw (added in 0.08.000 from the review of 2026-10-02, E-01). | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_cm_09` |
