# Workbench shell and focus route: tasks

- [x] WB-014. Declare the product kind and hold the gate route to the product identity; adversarial tests reject invalid metadata and attempts to redirect Focus checks.
- [x] WB-015. Permit a Focus waiver only for an explicitly declared surface and require the same reason in product metadata and the SDD ADR-0070 row.
- [x] Reconcile the six direct routes and Focus workbench against the published shared shell and its browser gate.
- [x] WB-016. Add a case-topology-driven Focus walkthrough with synchronized active unit, calculated stream ledger, step/pause controls and adjustable inspection interval; exercise it in the served-build browser gate.

## Convergence

The requirement checks are `tests/adversarial/test_app_kind.py`; the complete rendered-state and return-state checks run through `frontend/gate.mjs` against a served build.
