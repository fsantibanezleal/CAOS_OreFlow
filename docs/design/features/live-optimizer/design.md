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
- **Search step (the screen).**
  1. The candidates are the points one and two mesh steps from each incumbent along every coordinate, in a fixed
     order (feasible incumbent first, one step before two, coordinate by coordinate, `+` before `-`), inside the
     cube and not yet evaluated by the engine.
  2. A candidate passes if the guard accepts its features and the Gaussian process's 95% half-width on
     recovery is at most `optimization.screen_half_width_pct` (5 points; the lane's mean held-out half-width was
     9.3 points in the 0.06.000 learning record).
  3. The passing candidates are ranked by the surrogate's objective, the first of equals kept. The decisions change
     neither the throughput nor the head grade, so `M/M0` is predicted as `R/R0` with `R` the surrogate's recovery
     and `R0` the engine's at the base (the ratio `M/R` is constant across the decisions to 2.2e-16). The engine
     evaluates the best; if it dominates an incumbent, the iteration succeeds without a poll.
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

- **Changed during T2: float64 on both sides, not ONNX Runtime.** The browser's onnxruntime-web runs the networks
  in float32, and the learned-lane test holds it to the bake's ONNX Runtime only within 1e-4. That is enough to
  reorder two candidates on a fine mesh and send the two searches along different paths. The screen instead reads
  the exported ONNX weights (a Gemm and SiLU network, a Gemm and tanh autoencoder) and runs them in float64 in both
  languages (`methods/screen.py`, `frontend/src/learning/screen.ts`). The export checks them against ONNX Runtime
  within the lane's ONNX tolerance (measured 1.5e-6 and 2.0e-6, the float32 difference). The learned-lane view keeps
  onnxruntime-web.
- The Gaussian process is a final fit on 500 rows drawn from all 3,072 design states, on recovery, with the lane's
  kernel and settings. Its export is `models/process_screen.json` (the networks' weights, the standardized training
  rows, the length scales, the amplitude, the noise level, the target normalization and `alpha = K^-1 y`) and
  `models/process_gp_cholesky.bin` (the lower Cholesky factor `L` of `K`, packed by rows, float64 little-endian,
  125,250 values). The variance at a state is `k(x,x) - |L^-1 k_*|^2`, one forward substitution of 500 rows.
- Checks: the export against scikit-learn's `predict(return_std=True)` within 1e-8 (measured 5.1e-10), and the
  browser against the export's reference block (every case's nominal state) within 1e-9 relative
  (`frontend/src/test/screen.test.ts`).
- **Changed during T2: the learning stage runs before the cases.** The screened optimizer in the cases stage reads
  the models this bake exports. The learned lane depends only on the contract and the catalog, so the order is
  free; a development bake with `--reuse-learning` reads the models directory it is given.

## Records

`variants[].methods.optimization` keeps the 0.06 fields and adds:
- `method: "gps-progressive-barrier"`, `weights`, `screened`, `screen_bound_pct` and `proposal_columns`;
- per start: `iterations`, `stop` (`mesh` or `budget`) and `screen`, which holds the iteration count, the
  candidates screened, the rejections by reason (`guard`, `interval`), and every proposal. A proposal row carries
  the iteration, the surrogate's and the engine's recovery, the surrogate's and the engine's objective, the margin
  to the runner-up and whether the proposal became an incumbent;
- `trace`: the best start's incumbent per iteration (outcome, mesh size, barrier, feasible objective, engine
  evaluations so far);
- `without_screen`: the same starts and weight on a fresh cache, with its evaluations per start, status and
  optimum, so the saving is a record;
- `path`: the optimum at each weight of `optimization.weight_path`, warm-started from the previous one, with each
  step's evaluations, stop and screen counts.

**Changed during T3:** the record keeps the rejections as counts per start, not every rejected candidate with its
features. The full table is about 4,800 candidates per variant, some 35 MB per bake across the 72 variants. The counts
and every proposal are what the saving and the surrogate's disagreement are computed from.

## Browser

- **Changed during T5: the optimizer has a worker of its own** (`frontend/src/engine/optimizer-worker.ts`). The run
  is one synchronous computation, so no message can reach it: a cancel or a newer run makes the client terminate
  that worker, which stops the run at once, and the next run starts a new one. A worker whose run finished is kept,
  with its screen loaded. Progress is posted after every start, every start without the screen and every path step.
- **Changed during T5: the weight control is an integer percentage** (`optimizer_weight_pct`, 0 to 100 in steps of
  5), because the one validator checks steps in integers. The optimizer divides it by 100, which is exact at the
  recorded weights.
- The Methods view's optimizer record adds the weight control and a run button, and a chart selector: where each
  start ended, the incumbent over the evaluations, the optimum as the weight moves, and the surrogate against the
  engine at the proposals. It also adds the screen table (evaluations per start with and without the screen,
  proposals, improvements).

Nothing runs without the button, per the no-autoplay rule.

## Parity

`frontend/src/test/optimizer-parity.test.ts` re-runs the optimizer with the bake's screen for every variant from
the bake's inputs. Each start must stop for the same reason after the same iterations and evaluations, and the
screen must give the same counts and proposals. The run without the screen must spend the same evaluations. The
optimum, every start's end, every proposal's values and every step of the weight path must agree within 1e-6
relative. The other weights are exercised by the weight path (0.75, 0.5, 0.25) and, cold-started, by
`frontend/src/test/worker-optimize.test.ts` at 0.5.

Each variant is a full optimization, about a minute of engine runs, so CI (ADR-0074, cheap checks) runs the
nominal variants of three cases that cover one decision, a binding water constraint and a screen that rarely
passes; `OF_PARITY=full` runs all 72 variants locally at every release, and `docs/release-verification.md`
records the run.

## Measured on 2026-09-30: the screen does not pay on this engine

`measurements/screen_variants.py` and its JSON ran the 12 nominal states at weight 1 (six starts, no weight path),
with the screen exported from the committed learning record:

| Search | Engine evaluations | Against no screen |
| --- | --- | --- |
| no screen | 3,683 | |
| the screen as designed (one and two mesh steps) | 3,974 | 7.9% more |
| the screen limited to one mesh step | 3,753 | 1.9% more |

All three reach the same optimum in every case, to the sixth decimal of recovered metal. Over the 72 variants of the
first screened development bake (with the weight path) the designed screen spent 8.3% more (23,597 against 21,794).
Of its 4,812 proposals, 831 (17%) became an incumbent. The surrogate's error on recovery at the proposals had a
median of 0.59 points. So the surrogate is accurate where it is trusted, but the mesh neighbours differ by less
than its error, and a failed two-step proposal is an evaluation the poll would not have made.

The design is kept as validated. The screen runs in the bake and the browser, and its cost is the reported
result (OP-11). The one-step variant, measured and cheaper, is not adopted: it still does not save evaluations, and
changing the candidates after seeing the numbers would tune the method to the result.
