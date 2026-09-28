# Live optimizer design

## Why a pattern search

SciPy's COBYLA (0.05 and 0.06) cannot run in the browser, so the objective was fixed at the bake. A generalized
pattern search is a sequence of engine evaluations on a mesh, with comparisons and halvings of a power-of-two mesh
size. Implemented line by line in Python and TypeScript, it takes the same path in both languages: the engines
already agree within 1e-6, and the only decisions are comparisons of those results.

## Algorithm (one run)

- **State:** the incumbent `x` in the unit cube of the decision bounds, the mesh size `delta` (initial
  `optimization.mesh_initial`, a power of two), the feasible incumbent `x_F`, the infeasible incumbent `x_I` and
  the barrier `h_max` (initially `+inf`).
- **Search step (optional, the screen).**
  1. The surrogate predicts the objective at the `2n` mesh neighbours of both incumbents and at `2n` points two
     mesh steps away.
  2. A candidate passes if the guard accepts its features and the Gaussian process's 95% half-width on
     recovery is at most `optimization.screen_half_width_pct`.
  3. The passing candidates are ranked by the surrogate's objective. The engine evaluates the best one; if it
     improves the incumbent, the iteration succeeds without a poll.
- **Poll step.** The engine evaluates `x +- delta e_i` for each decision `i`, in a fixed order, around `x_F` and,
  when it exists, around `x_I`, stopping at the first improvement (opportunistic poll).
- **Improvement.** The definitions below are verified in Hallé-Hannan and Tribes (2026, arXiv:2609.19333,
  section 2.3, eqs. 12, 13 and 15):
  - `h(x) = sum_j max(0, g_j(x))^2` with `g_j = -s_j` the relative constraint slacks;
  - a feasible point improves `x_F` if its objective is higher;
  - an infeasible point with `0 < h <= h_max` is accepted as `x_I` if it dominates `x_I` in `(h, -f)`: no worse
    in both, better in one;
  - a *dominating* iteration dominates either incumbent. An *improving* one dominates neither, but finds an
    infeasible point with a lower `h` than `x_I` (that point becomes `x_I`). Anything else is *unsuccessful*.
- **Barrier.** After every iteration, `h_max` is set to `h(x_I)`. It never rises, because `x_I` changes only to a
  point with `h <= h_max`, and it tightens whenever the infeasible incumbent improves. The full update rules of
  Audet and Hare (2017, chapter 12), which the paper defers to, were not read. This rule is a declared
  simplification: it is non-increasing, as the progressive barrier requires, and it is tested on the analytic
  problems of T1.
- **Mesh:** doubles after a successful iteration (capped at the initial size) and halves after a failed poll.
- **Stop:** `delta < optimization.mesh_minimum` or `optimization.max_evaluations` engine evaluations.
- **Starts:** the variant's own point and the declared interior starts; the best feasible end is re-simulated
  from scratch and reported, as in 0.06.

## Surrogate and Gaussian process in both languages

- The bake scores the screen with `onnxruntime` on the exported `process_surrogate.onnx` and `process_guard.onnx`,
  not with torch, so the bake and the browser run the same graph. Where a screen decision's margin to a threshold
  is below `1e-5`, the record keeps the margin and parity accepts either verdict; everywhere else the verdicts
  must be equal.
- The Gaussian process is exported as `models/process_gp.json`: the standardized training rows (500 x 22), the
  length scales, the amplitude, the noise level, `alpha = K^-1 y` and the lower Cholesky factor `L` of `K`.
  The variance at a state is `k(x,x) - |L^-1 k_*|^2`, one triangular solve of 500 rows. A Python test compares the
  export with scikit-learn's `predict(return_std=True)` within 1e-8, and a TypeScript test compares the browser
  with the Python reference within 1e-6.

## Records

`benchmark.optimization[case][variant]` keeps the 0.06 fields and adds:
- `method: "gps-progressive-barrier"`;
- `weights`;
- `evaluations` (engine) and `evaluations_without_screen`;
- `screen`: every candidate with `features`, `surrogate`, `guard_error`, `gp_half_width`, `accepted`, `reason`
  and `engine` (for the accepted ones);
- `path`: the optimum at each recorded weight;
- `trace`: the incumbent, `delta` and `h_max` per iteration.

## Browser

The worker gains an `optimize` request, streamed per iteration like `sweep`, which is cancelled or superseded
between engine evaluations. The Methods view's optimizer record adds:
- a weights control (`w_r`, step 0.05);
- a run button;
- the iteration trace;
- the screen table.

Nothing runs without the button, per the no-autoplay rule.

## Parity

`frontend/src/test/optimizer-parity.test.ts` re-runs the optimizer for every variant at every recorded weight
from the bake's inputs, and compares the evaluation count, each incumbent and the optimum with the record within
1e-6 relative. The screen's verdicts are compared as in the section above.
