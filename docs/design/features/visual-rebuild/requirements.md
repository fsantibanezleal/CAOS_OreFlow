# OreFlow visual and interaction rebuild: requirements

Status: implementation in progress; user acceptance has not been recorded. This document records the defects reported after v0.02.001. A green build is not acceptance.

| ID | Requirement | Verification gate |
| --- | --- | --- |
| VR-01 | THE app SHALL use the shared shell's theme tokens, typography, header, footer, tabs and focus styles without a second app-owned palette. | CSS token audit; rendered light/dark screenshots of all six routes. |
| VR-02 | THE app SHALL open on a useful process instrument, with no marketing hero, oversized product wordmark or decorative orbit. | Source check for rendered hero; first-viewport screenshot at 390×844, 628×748, 1280×800, 1600×900. |
| VR-03 | THE app SHALL keep navigation directly clickable and discoverable at every supported width, in one row of chrome. | Pointer-driven navigation across all six routes at each target viewport; one-row measurement. |
| VR-04 | THE app SHALL make long research content scroll within its owner while retaining reachable tabs and footer. | Wheel/trackpad and keyboard scroll from heading to section references on every document route; scroll-owner measurement. |
| VR-05 | WHEN a user changes a process input, THE app SHALL update all linked streams, plots and readouts from the same engine, and disclose whether the state is replay or live. | Browser action test against Python/TypeScript parity fixtures and mass-balance assertion. |
| VR-06 | THE primary visualization SHALL communicate unit operations and measured/assumed quantities rather than a decorative numbered-node sequence. | Expert review of annotated, rendered circuit against artifact fields; each visible quantity traced to a contract field. |
| VR-07 | THE scientific routes SHALL put equations, assumptions, diagrams, cited evidence and inspectable results in navigable sections rather than billboard-scale introductions. | Route-by-route content inventory, linked reference audit, keyboard/pointer tab traversal, viewport screenshots. |
| VR-08 | THE release SHALL be withheld until design, accessibility, interaction, scientific-boundary and deployment gates all pass; HTTP 200/build green alone do not suffice. | Release checklist and production browser walkthrough in both themes and languages. |
| VR-09 | CASE changes SHALL switch to their declared process family, stream path, applicable controls and method results, rather than merely replacing the case label. | Gold gravity, magnetite magnetic and phosphate desliming browser checks; 72-variant Python/TypeScript parity. |
| VR-10 | THE walkthrough SHALL visibly traverse process stages, pause and step, while clearly saying it is not a physical-time simulation. | Play/pause/step and case-switch browser checks at desktop and mobile widths. |
| VR-11 | THE App SHALL open the currently selected scenario in a focus route through a visible control beside the selector; return SHALL preserve the case, variant and live parameter values. The focus route SHALL use the shared-shell stage/HUD/right-rail primitive. | Click App entry, change a live parameter, click return and assert the same case/value; direct-link, phone, EN/ES and light/dark checks. |

ADR-0070 is marked proposed, not accepted as a global convention. OreFlow satisfies its applicability test (selected cases, several live inputs and dense flowsheet/size response), and Felipe's request for the missing focus mode authorizes this product-specific implementation. This does not alter the status of the management ADR for other products.

Evidence boundary: the current cases are authored simulator scenarios, and the particle reference is not a plant recovery campaign. Visual polish cannot upgrade that evidence.
