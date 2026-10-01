# Live uncertainty tasks

- [x] T1 (UQ-01, UQ-02, UQ-03). SplitMix64, uniforms and the Latin hypercube in
  `data-pipeline/pipeline/methods/sampling.py` and `frontend/src/engine/sampling.ts`, with the vector and strata
  tests.
- [x] T2 (UQ-04). The uncertainty record built from the new design; checks in `scripts/check_artifacts.py`; the
  bake re-run in a sandbox; page and manuscript numbers re-transcribed and their claim tests updated. Done in `5558c3b`; the page and manuscript numbers in `b490ee3` and `e6a378e`, on the release records.
- [x] T3 (UQ-05). The browser uncertainty over the 12 nominal states, with the parity test.
- [x] T4 (UQ-06, UQ-07). Contract controls; the worker request; the Methods view controls; the gate check.
- [x] T5 (UQ-08). Methodology and Benchmark texts.
- [x] Convergence: every UQ requirement with its gate's result. Below.

## Convergence verdict, 0.07.000 (2026-09-30)

ADR-0075 section 4: each requirement, the gate it names and that gate's result on the release (the committed
bake and its validation, the Python and frontend suites on the committed records, the full optimizer parity,
and the browser gate's records on the served build). A parametrized test counts each of its cases. The gate's
1280x800 dark English combination is its re-check alone, after a socket-buffer error during a concurrent test
run failed three of its checks in the full run (`docs/release-verification.md`, 0.07.000).

| Requirement | Result on the release |
|---|---|
| UQ-01 | met: `test_splitmix64_vector` 1/1; `splitmix64.test.ts` 3/3 |
| UQ-02 | met: `test_uniform_bits` 1/1; `splitmix64.test.ts` 3/3 |
| UQ-03 | met: `test_lhs_strata` 1/1; `lhs.test.ts` 2/2 |
| UQ-04 | met: `check_artifacts.py` passed in the bake |
| UQ-05 | met: `uncertainty-parity.test.ts` 12/12 |
| UQ-06 | met: `worker-uncertainty.test.ts` 2/2; `gate.mjs` uncertainty control check: 12/12 |
| UQ-07 | met: `test_uncertainty_controls_declared` 1/1; `contract.test.ts` 3/3 |
| UQ-08 | met: `benchmark-claims.test.ts` 7/7 |
