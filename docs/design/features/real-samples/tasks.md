# Real-sample mode tasks

- [x] T1 (RS-01, RS-02). A real-sample stage: pinned sources, the ledger and the Bond work index, with tests. Done in `19e67cb`.
- [x] T2a (RS-03b). Read Tafirenyika et al. 2022 and Jiang et al. 2025; author bornite and chalcocite (formula,
  density, flotation parameters relative to chalcopyrite) with their sources, and test the stoichiometry. Done in `259c242`, from the primary texts cited on methodology page 15 (T2a of #51).
- [x] T2 (RS-03, RS-04). The normative mineralogy and the work-index assignment, with tests. Done in `19e67cb` and `92f6cd2` (the nearest sample by 3-D distance).
- [x] T3 (RS-05). Engine runs, the record, the schema and checks; the bake in a sandbox. Done in `259c242`.
- [x] T4 (RS-06). The browser runs and parity. Done in `259c242`.
- [x] T5 (IS-02 to IS-06, from the soft-sensor branch). The soft-sensor lane rebased onto 0.07, baked, with its
  Benchmark tab. Done in `81aedea`.
- [x] T6 (RS-07, RS-08, RS-09). The source selector, the rail's disabled controls with their reasons, each view's
  reaction or statement, the Case view text; claim tests. Done in `81aedea`; the fixes from the captures in `495dad3`.
- [x] T7 (RS-10). The gate's source axis, with the captures read. The source axis in `495dad3`; the full matrix ran on the release build.
- [x] Convergence: every RS and IS requirement with its gate's result. Below (IS in `industrial-soft-sensor`).

## Convergence verdict, 0.08.000 (2026-10-04)

ADR-0075 section 4: each live requirement, the gate it names and that gate's result on the 0.08.000 release: the
release bake and its validation, the Python and frontend suites on the final tree,
the full optimizer parity (`OF_PARITY=full`, six processes) and the browser gate's records on the served release
build, every capture read (`docs/release-verification.md`, 0.08.000). A parametrized test passes when every one
of its cases does.

| Requirement | Result on the 0.08.000 release |
|---|---|
| RS-01 | met: `test_sources_pinned_and_ledger` passed |
| RS-02 | met: `test_bond_work_index` passed |
| RS-03 | met: `test_normative_mineralogy` passed |
| RS-03b | met: `test_stoichiometry_from_atomic_weights` passed; `test_copper_minerals_sourced` passed |
| RS-04 | met: `test_work_index_assignment` passed |
| RS-05 | met: `test_record_fields` passed; `check_artifacts.py` passed on the adopted records (the bake's validation stage, and again after adoption) |
| RS-06 | met: `real-samples-parity.test.ts` passed (53 tests) |
| RS-07 | met: `real-samples-claims.test.ts` passed (4 tests); `gate.mjs` on the served release build (`index-NqgWRgWC.js`): 1,332 of 1,332 checks, the full matrix in all 16 combinations, the review pass and the phone and tablet pass, every capture read |
| RS-08 | met: `gate.mjs` on the served release build (`index-NqgWRgWC.js`): 1,332 of 1,332 checks, the full matrix in all 16 combinations, the review pass and the phone and tablet pass, every capture read |
| RS-09 | met: `real-samples-claims.test.ts` passed (4 tests) |
| RS-10 | met: `gate.mjs` on the served release build (`index-NqgWRgWC.js`): 1,332 of 1,332 checks, the full matrix in all 16 combinations, the review pass and the phone and tablet pass, every capture read |

11 of 11 met.

## Convergence verdict, 0.07.000 (2026-09-30)

ADR-0075 section 4: each requirement, the gate it names and that gate's result on the release (the committed
bake and its validation, the Python and frontend suites on the committed records, the full optimizer parity,
and the browser gate's records on the served build). A parametrized test counts each of its cases. The gate's
1280x800 dark English combination is its re-check alone, after a socket-buffer error during a concurrent test
run failed three of its checks in the full run (`docs/release-verification.md`, 0.07.000).

| Requirement | Result on the release |
|---|---|
| RS-01 | met: `test_sources_pinned_and_ledger` 1/1 |
| RS-02 | met: `test_bond_work_index` 1/1 |
| RS-03 | met: `test_normative_mineralogy` 1/1 |
| RS-03b | met: `test_stoichiometry_from_atomic_weights` 1/1; `test_copper_minerals_sourced` 1/1 |
| RS-04 | met: `test_work_index_assignment` 1/1 |
| RS-05 | met: `check_artifacts.py` passed in the bake; `test_record_fields` 1/1 |
| RS-06 | met: `real-samples-parity.test.ts` 53/53 |
| RS-07 | met: `gate.mjs` real-sample checks: 36/36; `real-samples-claims.test.ts` 3/3 |
| RS-08 | met: `gate.mjs` rail check in each source: 36/36 |
| RS-09 | met: `real-samples-claims.test.ts` 3/3 |
| RS-10 | met: `gate.mjs` matrix with the source axis: 36/36 |
