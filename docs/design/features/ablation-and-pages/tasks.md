# Ablation study and page tabs tasks

- [x] T1 (AB-01, AB-02). Mechanism switches in both engines, with the inertness and closure tests.
- [x] T2 (AB-03, AB-04). The ablation stage, its records and checks, the bake in a sandbox, and browser parity.
- [x] T3 (PG-01, PG-03). The Experiments page's data, splits, uncertainty and ablations tabs, transcribed from the
  records and dossiers: diagrams (themed, bilingual SVG), equations, references and claim tests.
- [x] T4 (PG-02, PG-03). The Implementation page's model registry, GPU lane and deployment tabs, transcribed from
  the code, `models/` and architecture 05, with claim tests.
- [x] T5 (PG-04). The full browser matrix with the captures read. The full matrix ran on the release build, with the captures read (`docs/release-verification.md`, 0.07.000).
- [x] Convergence: every AB and PG requirement with its gate's result. Below.

## Convergence verdict, 0.08.000 (2026-10-04)

ADR-0075 section 4: each live requirement, the gate it names and that gate's result on the 0.08.000 release: the
release bake and its validation, the Python and frontend suites on the final tree,
the full optimizer parity (`OF_PARITY=full`, six processes) and the browser gate's records on the served release
build, every capture read (`docs/release-verification.md`, 0.08.000). A parametrized test passes when every one
of its cases does.

| Requirement | Result on the 0.08.000 release |
|---|---|
| AB-01 | met: `test_switches_default_on_and_inert` passed |
| AB-02 | met: `test_closure_with_each_switch_off` passed (12 cases) |
| AB-03 | met: `test_not_applicable_is_not_zero` passed; `check_artifacts.py` passed on the adopted records (the bake's validation stage, and again after adoption) |
| AB-04 | met: `ablation-parity.test.ts` passed (12 tests) |
| PG-01 | met: `pages.test.ts` passed (4 tests); `gate.mjs` on the served release build (`index-NqgWRgWC.js`): 1,332 of 1,332 checks, the full matrix in all 16 combinations, the review pass and the phone and tablet pass, every capture read |
| PG-02 | met: `pages.test.ts` passed (4 tests); `gate.mjs` on the served release build (`index-NqgWRgWC.js`): 1,332 of 1,332 checks, the full matrix in all 16 combinations, the review pass and the phone and tablet pass, every capture read |
| PG-03 | met: `experiments-claims.test.ts` passed (9 tests); `implementation-claims.test.ts` passed (6 tests) |
| PG-04 | met: `gate.mjs` on the served release build (`index-NqgWRgWC.js`): 1,332 of 1,332 checks, the full matrix in all 16 combinations, the review pass and the phone and tablet pass, every capture read |

8 of 8 met.

## Convergence verdict, 0.07.000 (2026-09-30)

ADR-0075 section 4: each requirement, the gate it names and that gate's result on the release (the committed
bake and its validation, the Python and frontend suites on the committed records, the full optimizer parity,
and the browser gate's records on the served build). A parametrized test counts each of its cases. The gate's
1280x800 dark English combination is its re-check alone, after a socket-buffer error during a concurrent test
run failed three of its checks in the full run (`docs/release-verification.md`, 0.07.000).

| Requirement | Result on the release |
|---|---|
| AB-01 | met: `test_switches_default_on_and_inert` 1/1 (the engine declares one of the five switches; the study declares them all, as AB-01 now says) |
| AB-02 | not met as then written: `test_closure_with_each_switch_off` 12/12 checked the closure, but the trace never recorded the switch. The requirement was reworded in 0.08.000 (the study record names it), and the test reads the committed record (review of 0.07.000, W-03) |
| AB-03 | met: `check_artifacts.py` passed in the bake; `test_not_applicable_is_not_zero` 1/1 |
| AB-04 | met: `ablation-parity.test.ts` 12/12 |
| PG-01 | met: `gate.mjs` tab census: 48/48; `pages.test.ts` 3/3 |
| PG-02 | met: `gate.mjs` tab census: 48/48; `pages.test.ts` 3/3 |
| PG-03 | met: `experiments-claims.test.ts` 8/8; `implementation-claims.test.ts` 4/4 |
| PG-04 | met: `gate.mjs` full matrix: 924/924 |
