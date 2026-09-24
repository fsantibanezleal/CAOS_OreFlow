# OreFlow visual and interaction rebuild — requirements

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

Evidence boundary: the current cases are authored simulator scenarios, and the particle reference is not a plant recovery campaign. Visual polish cannot upgrade that evidence.
