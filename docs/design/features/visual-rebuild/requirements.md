# OreFlow visual and interaction rebuild: requirements

Status: superseded by process-engine-v2 (0.05.000), design section 12: the interface was rebuilt on the new trace (PE-35 to PE-40) and its layout, language, figure and modal rules are measured by `frontend/gate.mjs`. The rows below record the defects reported after v0.02.001; they are not a live specification.

| ID | Requirement | Verification gate |
| --- | --- | --- |
| VR-01 | THE app SHALL use the shared shell's theme tokens, typography, header, footer, tabs and focus styles without a second app-owned palette. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_01` |
| VR-02 | THE app SHALL open on a useful process instrument, with no marketing hero, oversized product wordmark or decorative orbit. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_02` |
| VR-03 | THE app SHALL keep navigation directly clickable and discoverable at every supported width, in one row of chrome. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_03` |
| VR-04 | THE app SHALL make long research content scroll within its owner while retaining reachable tabs and footer. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_04` |
| VR-05 | WHEN a user changes a process input, THE app SHALL update all linked streams, plots and readouts from the same engine, and disclose whether the state is replay or live. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_05` |
| VR-06 | THE primary visualization SHALL communicate unit operations and measured/assumed quantities rather than a decorative numbered-node sequence. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_06` |
| VR-07 | THE scientific routes SHALL put equations, assumptions, diagrams, cited evidence and inspectable results in navigable sections rather than billboard-scale introductions. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_07` |
| VR-08 | THE release SHALL be withheld until design, accessibility, interaction, scientific-boundary and deployment gates all pass; HTTP 200/build green alone do not suffice. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_08` |
| VR-09 | CASE changes SHALL switch to their declared process family, stream path, applicable controls and method results, rather than merely replacing the case label. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_09` |
| VR-10 | THE walkthrough SHALL visibly traverse process stages, pause and step, while clearly saying it is not a physical-time simulation. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_10` |
| VR-11 | THE App SHALL open the currently selected scenario in a focus route through a visible control beside the selector; return SHALL preserve the case, variant and live parameter values. The focus route SHALL use the shared-shell stage/HUD/right-rail primitive. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_vr_11` |

ADR-0070 is marked proposed, not accepted as a global convention. OreFlow satisfies its applicability test (selected cases, several live inputs and dense flowsheet/size response), and Felipe's request for the missing focus mode authorizes this product-specific implementation. This does not alter the status of the management ADR for other products.

Evidence boundary: the current cases are authored simulator scenarios, and the particle reference is not a plant recovery campaign. Visual polish cannot upgrade that evidence.
