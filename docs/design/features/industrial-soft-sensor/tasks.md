# Industrial soft-sensor tasks

- [x] T1 (IS-01). The publisher's metadata, licence, archive checksum and CSV schema verified; the archive pinned by
  SHA-256 (branch `task/oreflow-industrial-soft-sensor`).
- [x] T2 (IS-02 to IS-04). The hourly integrity checks, the exact next-hour pairs, the forward windows with the
  embargo and the model matrix (`data-pipeline/run_iron_plant.py`), regenerated on 0.07.
- [x] T3 (IS-01 to IS-04, IS-06). Tests and artifact checks. Done in `81aedea`.
- [x] T4 (IS-05, IS-06). The Benchmark tab and its claim tests; the real-sample source's iron-plant hours (RS-07). Done in `81aedea`.
- [x] Convergence: every IS requirement with its gate's result. Below.

## Convergence verdict, 0.08.000 (2026-10-04)

ADR-0075 section 4: each live requirement, the gate it names and that gate's result on the 0.08.000 release: the
release bake and its validation, the Python and frontend suites on the final tree,
the full optimizer parity (`OF_PARITY=full`, six processes) and the browser gate's records on the served release
build, every capture read (`docs/release-verification.md`, 0.08.000). A parametrized test passes when every one
of its cases does.

| Requirement | Result on the 0.08.000 release |
|---|---|
| IS-01 | met: `test_source_pinned_and_population` passed; `check_artifacts.py` passed on the adopted records (the bake's validation stage, and again after adoption) |
| IS-02 | met: `test_interpolated_hours_excluded` passed |
| IS-03 | met: `test_features_and_pairs` passed |
| IS-04 | met: `test_forward_windows_and_embargo` passed |
| IS-05 | met: `iron-plant-claims.test.ts` passed (4 tests); `gate.mjs` on the served release build (`index-CnSiM6Dh.js`): 1,332 of 1,332 checks, the full matrix in all 16 combinations, the review pass and the phone and tablet pass, every capture read |
| IS-06 | met: `test_no_set_point_advice` passed; `iron-plant-claims.test.ts` passed (4 tests) |

6 of 6 met.

## Convergence verdict, 0.07.000 (2026-09-30)

ADR-0075 section 4: each requirement, the gate it names and that gate's result on the release (the committed
bake and its validation, the Python and frontend suites on the committed records, the full optimizer parity,
and the browser gate's records on the served build). A parametrized test counts each of its cases. The gate's
1280x800 dark English combination is its re-check alone, after a socket-buffer error during a concurrent test
run failed three of its checks in the full run (`docs/release-verification.md`, 0.07.000).

| Requirement | Result on the release |
|---|---|
| IS-01 | met: `test_source_pinned_and_population` 1/1; `check_artifacts.py` passed in the bake |
| IS-02 | met: `test_interpolated_hours_excluded` 1/1 |
| IS-03 | met: `test_features_and_pairs` 1/1 |
| IS-04 | met: `test_forward_windows_and_embargo` 1/1 |
| IS-05 | met: `iron-plant-claims.test.ts` 3/3; `gate.mjs` tab census: 48/48 |
| IS-06 | met: `test_no_set_point_advice` 1/1; `iron-plant-claims.test.ts` 3/3 |
