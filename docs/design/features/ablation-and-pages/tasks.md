# Ablation study and page tabs tasks

- [x] T1 (AB-01, AB-02). Mechanism switches in both engines, with the inertness and closure tests.
- [x] T2 (AB-03, AB-04). The ablation stage, its records and checks, the bake in a sandbox, and browser parity.
- [x] T3 (PG-01, PG-03). The Experiments page's data, splits, uncertainty and ablations tabs, transcribed from the
  records and dossiers: diagrams (themed, bilingual SVG), equations, references and claim tests.
- [x] T4 (PG-02, PG-03). The Implementation page's model registry, GPU lane and deployment tabs, transcribed from
  the code, `models/` and architecture 05, with claim tests.
- [x] T5 (PG-04). The full browser matrix with the captures read. The full matrix ran on the release build, with the captures read (`docs/release-verification.md`, 0.07.000).
- [x] Convergence: every AB and PG requirement with its gate's result. Below.

## Convergence verdict, 0.07.000 (2026-09-30)

ADR-0075 section 4: each requirement, the gate it names and that gate's result on the release (the committed
bake and its validation, the Python and frontend suites on the committed records, the full optimizer parity,
and the browser gate's records on the served build). A parametrized test counts each of its cases. The gate's
1280x800 dark English combination is its re-check alone, after a socket-buffer error during a concurrent test
run failed three of its checks in the full run (`docs/release-verification.md`, 0.07.000).

| Requirement | Result on the release |
|---|---|
| AB-01 | met: `test_switches_default_on_and_inert` 1/1 |
| AB-02 | met: `test_closure_with_each_switch_off` 12/12 |
| AB-03 | met: `check_artifacts.py` passed in the bake; `test_not_applicable_is_not_zero` 1/1 |
| AB-04 | met: `ablation-parity.test.ts` 12/12 |
| PG-01 | met: `gate.mjs` tab census: 48/48; `pages.test.ts` 3/3 |
| PG-02 | met: `gate.mjs` tab census: 48/48; `pages.test.ts` 3/3 |
| PG-03 | met: `experiments-claims.test.ts` 8/8; `implementation-claims.test.ts` 4/4 |
| PG-04 | met: `gate.mjs` full matrix: 924/924 |
