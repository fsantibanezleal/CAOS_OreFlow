# Classifier-cut mode tasks

- [x] T1 (CM-02, CM-03). Measure `e (1 + C(e, d50c))` over every case on a grid of cuts, and persist the result.
  Then implement the cut branch in `grinding.py` with its flags and tests.
- [x] T2 (CM-01). Contract: `grinding_mode`, `d50c_um` with the measured per-case bounds, and the cross-field
  rule, in Python and the browser.
- [x] T3 (CM-04, CM-05). The agreement test between the modes, and balance closure in the cut mode.
- [x] T4 (CM-06). Cut-mode variants in the catalog; the bake in a sandbox; the TypeScript branch; parity over all
  variants. Done in `259c242`; the parity over all 96 variants in `81aedea`.
- [x] T5 (CM-07). The rail's mode switch, the Grinding view's set and follow labels, and the gate check. Done in `259c242`; the gate check in `495dad3`.
- [x] T6 (CM-08). The Methodology comminution page and its claim test. The page in `495dad3`; its claim test, `methodology-claims.test.ts`, in `b490ee3`.
- [x] Convergence: every CM requirement with its gate's result. Below.

## Convergence verdict, 0.07.000 (2026-09-30)

ADR-0075 section 4: each requirement, the gate it names and that gate's result on the release (the committed
bake and its validation, the Python and frontend suites on the committed records, the full optimizer parity,
and the browser gate's records on the served build). A parametrized test counts each of its cases. The gate's
1280x800 dark English combination is its re-check alone, after a socket-buffer error during a concurrent test
run failed three of its checks in the full run (`docs/release-verification.md`, 0.07.000).

| Requirement | Result on the release |
|---|---|
| CM-01 | met: `test_cut_mode_declared` 1/1; `contract.test.ts` 3/3 |
| CM-02 | met: `test_cut_mode_meets_installed_power` 12/12 |
| CM-03 | met: `test_cut_mode_reports_and_flags` 12/12 |
| CM-04 | met: `test_modes_agree_at_the_same_state` 12/12 |
| CM-05 | met: `test_cut_mode_closure` 24/24; `check_artifacts.py` passed in the bake |
| CM-06 | met: `parity.test.ts` 96/96 |
| CM-07 | met: `gate.mjs` grinding-mode check: 12/12 |
| CM-08 | met: `methodology-claims.test.ts` 2/2 |
