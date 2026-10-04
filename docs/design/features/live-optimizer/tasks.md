# Live optimizer tasks

- [x] T1 (OP-02, OP-03, OP-04; OP-01 with T3). The pattern search with the progressive barrier in
  `data-pipeline/pipeline/methods/pattern_search.py` and its port `frontend/src/engine/pattern_search.ts`, tested
  on analytic problems (a bowl, a disc from an infeasible corner, an impossible constraint, a search step) with
  the same evaluation digests in both languages. The declared constants move to `engine/data/constants.json` with
  T3.
- [x] T2 (OP-05). Export the Gaussian process (`process_gp.json`) from the learning stage, with the export test
  against scikit-learn. Run the screen through `onnxruntime` in the bake. Done in `c8b78e3`, changed during T2: the export is `process_screen.json` with `process_gp_cholesky.bin`, and both languages run the networks and the GP in float64 instead of ONNX Runtime (design, Screen).
- [x] T3 (OP-06, OP-07). Records, schema and `scripts/check_artifacts.py` checks: the screen table, the saving,
  the weight path. Done in `c8b78e3`; the benchmark's screen fields in `5c33cb3`.
- [x] T4 (OP-08). TypeScript port in `frontend/src/engine/optimize.ts` and the screen in `frontend/src/learning/screen.ts` (planned as
  `learning/gp.ts`), and the
  parity test over all variants and weights. Done in `c8b78e3` and `259c242` (the declared decrease tolerance), with the Gaussian process in `learning/screen.ts`; the full parity ran on the release records.
- [x] T5 (OP-09, OP-10). The contract's weights control; the worker's `optimize` request; the Methods view
  control, trace and screen table; the browser-gate check. Done in `c8b78e3`; the gate check in `495dad3`.
- [x] T6 (OP-11). Methodology (optimizer page), Benchmark (optimization tab) and Implementation texts, from the
  records, with claim tests; references Torczon 1997, Audet and Dennis 2006 and 2009, Booker et al. 1999. Done in `5b9ad54`, `b490ee3` and `e6a378e`, on the release records.
- [x] Convergence: every OP requirement with its gate's result. Below.

## Convergence verdict, 0.08.000 (2026-10-04)

ADR-0075 section 4: each live requirement, the gate it names and that gate's result on the 0.08.000 release: the
release bake and its validation, the Python and frontend suites on the final tree,
the full optimizer parity (`OF_PARITY=full`, six processes) and the browser gate's records on the served release
build, every capture read (`docs/release-verification.md`, 0.08.000). A parametrized test passes when every one
of its cases does.

| Requirement | Result on the 0.08.000 release |
|---|---|
| OP-01 | met: `test_objective_and_decisions` passed |
| OP-02 | met: `test_poll_mesh_and_stopping` passed |
| OP-03 | met: `test_progressive_barrier` passed |
| OP-04 | met: `test_infeasible_reports_least_violating` passed |
| OP-05 | met: `test_screen_accepts_only_inside_envelope` passed |
| OP-06 | met: `test_record_fields` passed; `check_artifacts.py` passed on the adopted records (the bake's validation stage, and again after adoption) |
| OP-07 | met: `check_artifacts.py` passed on the adopted records (the bake's validation stage, and again after adoption) |
| OP-08 | met: `optimizer-parity.test.ts` passed (96 tests with OF_PARITY=full) |
| OP-09 | met: `worker-optimize.test.ts` passed (2 tests); `gate.mjs` on the served release build (`index-NqgWRgWC.js`): 1,332 of 1,332 checks, the full matrix in all 16 combinations, the review pass and the phone and tablet pass, every capture read |
| OP-10 | met: `test_weights_declared` passed; `contract.test.ts` passed (3 tests) |
| OP-11 | met: `benchmark-claims.test.ts` passed (13 tests); `methodology-claims.test.ts` passed (5 tests); `implementation-claims.test.ts` passed (6 tests) |

11 of 11 met.

## Convergence verdict, 0.07.000 (2026-09-30)

ADR-0075 section 4: each requirement, the gate it names and that gate's result on the release (the committed
bake and its validation, the Python and frontend suites on the committed records, the full optimizer parity,
and the browser gate's records on the served build). A parametrized test counts each of its cases. The gate's
1280x800 dark English combination is its re-check alone, after a socket-buffer error during a concurrent test
run failed three of its checks in the full run (`docs/release-verification.md`, 0.07.000).

| Requirement | Result on the release |
|---|---|
| OP-01 | met: `test_objective_and_decisions` 1/1 |
| OP-02 | met: `test_poll_mesh_and_stopping` 1/1 |
| OP-03 | met: `test_progressive_barrier` 1/1 |
| OP-04 | met: `test_infeasible_reports_least_violating` 1/1 |
| OP-05 | met: `test_screen_accepts_only_inside_envelope` 1/1; `test_optimum_is_an_engine_result` 1/1 |
| OP-06 | met: `check_artifacts.py` passed in the bake; `test_record_fields` 1/1 |
| OP-07 | met: `check_artifacts.py` passed in the bake |
| OP-08 | met: `optimizer-parity.test.ts` 96/96 |
| OP-09 | met: `worker-optimize.test.ts` 2/2; `gate.mjs` optimizer control check: 12/12 |
| OP-10 | met: `test_weights_declared` 1/1; `contract.test.ts` 3/3 |
| OP-11 | met: `benchmark-claims.test.ts` 7/7; `methodology-claims.test.ts` 2/2; `implementation-claims.test.ts` 4/4 |
