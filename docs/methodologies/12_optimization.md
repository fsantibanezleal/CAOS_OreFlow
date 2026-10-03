# 12 Constrained operating-point optimization

![One iteration: the poll one mesh step from the feasible incumbent, the screen's candidates one and two steps away, and the one it proposes to the engine.](../svg/12-optimization.svg)

*One iteration: the poll one mesh step from the feasible incumbent, the screen's candidates one and two steps away, and the one it proposes to the engine.*

The question a plant engineer asks of a circuit model is rarely "what happens at this point" and
more often "where should I run it". OreFlow answers that question for each baked variant with a
constrained optimization of the engine itself, and the workbench repeats it at any weight.

## Problem

Over the decisions an operator controls day to day, maximize a weighted objective of recovered metal against
specific energy:

$$\max_{u \in U}\ w\,\frac{M(u)}{M_0} - (1 - w)\,\frac{E(u)}{E_0}$$

$M$ is the recovered primary payable (t/h of the payable species, for example Cu or Au), $E$ the total specific
energy (kWh/t), $M_0$ and $E_0$ their values at the variant's own state, and $w$ the weight on metal (OP-01). The
bake's record uses $w = 1$, recovered metal alone, and keeps the optimum at $w$ = 0.75, 0.5 and 0.25 (OP-07); the
workbench runs any $w$ from 0 to 100% in steps of 5 (OP-09, OP-10).

| Circuit | Decisions |
|---|---|
| flotation circuits (`rougher`, `gravity_rougher`, `deslime_rougher`) | grind target P80, collector dose, rougher gas velocity |
| magnetite (`magnetic`) | grind target P80 |
| any circuit in the cut mode (page 03) | the classifier cut takes the grind target's place |

Each decision is bounded by the Contract 1 envelope of its case ([data contract page 01](../data-contract/01_operating-contract.md)).
Everything else (throughput, ore hardness and grade, circulating load, water per tonne, crusher
setting, cell count, bleed, desliming cut) stays at the variant's value. The constraints:

| Constraint | Condition | Why it binds |
|---|---|---|
| grade | final concentrate grade at or above the case specification | more collector and more air raise recovery and lower grade |
| power | required mill power at or below the installed power | a finer grind needs more energy; beyond installed power the target is not reachable, so it is not a decision the plant can take |
| water | process water per tonne at or below the plant's capacity | cleaner dilution and water carried to the froth grow with mass pull and gas velocity |

The water capacity of each case is authored 5% above its nominal requirement, a pumping and
thickener limit (`SOURCES["water"]` in the catalog, checked by
`tests/test_cases.py::test_water_capacity_is_five_percent_above_nominal`). The engine does not
model thickeners, so the water it reports is process water, not fresh make-up water.

## Method: a pattern search with a progressive barrier

The engine is not differentiable in closed form (root finders, recycles, a power-limited branch), so the method
needs no derivatives. Until 0.06 it was SciPy's COBYLA (Powell 1994, doi:10.1007/978-94-015-8330-5_4), which the
browser cannot run, so the objective was fixed at the bake. Since 0.07 it is a generalized pattern search (Torczon
1997, doi:10.1137/S1052623493250780) with a progressive barrier on the constraints (Audet and Dennis 2009,
doi:10.1137/070692662), written line for line in Python (`methods/pattern_search.py`, `methods/optimization.py`)
and TypeScript (`engine/pattern_search.ts`, `engine/optimize.ts`). Its steps are comparisons of engine results on a
power-of-two mesh, so the two languages take the same path, and the weight is a live control.

- **Scaling.** Decisions are scaled to the unit cube of their bounds; the cube's faces are unrelaxable (a trial
  point outside them is never evaluated, the extreme barrier).
- **Poll.** Each iteration evaluates $u \pm \Delta e_i$ for every decision $i$, in a fixed order, around the feasible
  incumbent and then the infeasible one, and stops at the first point that dominates an incumbent.
- **Mesh.** $\Delta$ starts at 1/4 of each range and doubles after a dominating iteration (capped at 1/4), stays
  after an improving one, and halves after an unsuccessful one. A start stops below $2^{-10}$ (0.2 um of a 225 um
  grind range) or at 200 engine evaluations, and the record says which (OP-02).
- **Constraints.** The grade, power and water constraints are relaxable: they enter through the aggregate
  violation of their relative slacks $s_c$,
  $$h(u) = \sum_c \max\left(0,\ -s_c - 10^{-6}\right)^2,$$
  and a point is feasible when $h = 0$. A state the contract rejects is an extreme-barrier point, never an
  incumbent (OP-03).
- **Incumbents and the barrier.** The definitions are those verified in Hallé-Hannan and Tribes (2026,
  arXiv:2609.19333, section 2.3, eqs. 12, 13 and 15): a feasible incumbent (best $f$ with $h = 0$), an infeasible
  one (best $f$ with $0 < h \le h_{max}$), dominance in $(h, f)$, and three outcomes (dominating, improving,
  unsuccessful). After every iteration $h_{max}$ is set to the infeasible incumbent's $h$: it never rises, as the
  progressive barrier requires. The full update rules of Audet and Hare (2017, chapter 12,
  doi:10.1007/978-3-319-68913-5), which the paper defers to, were not read; this rule is a declared simplification.
- **Round-off.** Every comparison asks for more than round-off: a point counts as better only by more than
  $10^{-9}$ relative (`optimization.decrease_tolerance`), and so does the screen's ranking and the choice of the
  best start. Where the objective is flat, the two engines' values agree only to round-off (the free-milling
  gold's recovery at its optimum differs by 5e-16), and a comparison of equal values would otherwise decide
  differently in the two languages.
- **Starts.** Six: the variant's own point and five declared interior points (the magnetite circuit uses the first
  coordinate of each). The best start that ends feasible is simulated again from scratch, and its values and
  slacks come from that fresh run; constraints within 1e-3 of their limit are reported as active. If no start ends
  feasible the status is `infeasible`, `optimum` is null and the least-violating end point is reported (OP-04).
- **Weight path.** After the optimum at $w = 1$, the search runs at 0.75, 0.5 and 0.25, each warm-started from the
  previous optimum.

## The surrogate screen

The search step is screened by the learned lane (page 14), in the surrogate management framework (Booker et al.
1999, doi:10.1007/BF01197708): the search may use any model, and the poll keeps the method's guarantees (OP-05).

1. The candidates are the points one and two mesh steps from each incumbent along every coordinate, inside the
   cube and not yet evaluated by the engine.
2. A candidate passes if the autoencoder guard accepts its features and the Gaussian process's 95% half-width on
   recovery is at most 5 points (`optimization.screen_half_width_pct`; the lane's mean held-out half-width was
   9.3 points in the 0.07.000 learning record):
   $$\sigma^2(x) = k(x, x) - \left\lVert L^{-1} k_* \right\rVert^2,\qquad 1.96\,\sigma(x) \le 5,$$
   with $L$ the Cholesky factor of the training covariance (Rasmussen and Williams 2006, algorithm 2.1).
3. The passing candidates are ranked by the surrogate's objective. The decisions change neither the throughput
   nor the head grade, so $M/M_0$ is predicted as $R/R_0$, the surrogate's recovery over the engine's at the base
   (the ratio $M/R$ is constant across the decisions to 2.2e-16). The engine evaluates the best one before the
   poll.

The poll and the reported optimum are always engine results, so the screen can reorder the engine's work but
never replace it. Both languages run the exported networks and a final Gaussian process on recovery in float64
(`methods/screen.py`, `learning/screen.ts`), from the weights and the Cholesky factor the learning stage exports and
checks (against ONNX Runtime within 1e-5, against scikit-learn within 1e-8). The browser's onnxruntime-web runs the
networks in float32, which can reorder two candidates on a fine mesh, so the screen does not use it. In the cut
mode the lane's features (the target and the design load) are results, so the search runs without the screen and
the record says why.

## The record

`status` (`optimal` or `infeasible`), `method` (`gps-progressive-barrier`), `weights`, `decisions`, `bounds`,
`constraints` (limits), `screened`, `base` (the variant's own point with its values, slacks and feasibility),
`optimum` (decisions, recovered t/h, recovery, grade, required power, water, energy, slacks, active constraints),
`gain_tph` and `gain_pct` against the base, and `starts`, each with its end point, feasibility, evaluations,
iterations, stop reason and screen record: the candidates screened, the rejections by reason (`guard`,
`interval`), and every proposal with the surrogate's and the engine's recovery and objective and whether it became
an incumbent (OP-06). Then `trace` (the best start's incumbent per iteration), `without_screen` (the same starts
and weight on a fresh cache, so the saving is a record), `path` (the optimum at each recorded weight) and
`least_violating` when infeasible.

## What the records show

Measured on the 0.07.000 records of 2026-09-30, with all the weight on recovered metal (the Benchmark page's
optimization tab gives every variant, and `frontend/src/test/benchmark-claims.test.ts` holds each number here to
the benchmark and case records):

- **Feasibility.** 94 of the 96 variants reach an optimum. The two that do not are the magnetite case's harder ore
  and higher throughput: the grind is the only decision, the mill is already at installed power, and no grind
  target meets every constraint. The least-violating point is reported for both.
- **Gains.** 28 of the 72 target-mode variants break a constraint as run; the 24 cut-mode variants break none.
  The gain in recovered metal runs from -0.8% (magnetite, coarser grind: a state that broke its grade
  specification, restored at the cost of metal) to +18.1% (oxide copper, coarser grind); at the nominal states
  from 0.3% (magnetite) to 7.6% (oxide copper), and in the cut mode from 0.3% (magnetite) to 5.1% (zinc).
- **Active constraints.** Installed power at 81 of the 94 optima, and at all 24 in the cut mode; the grade
  specification at 23; the water capacity at 10.
- **What the screen cost (OP-06, OP-11).** Over the 72 screened variants the search spent 23,535 engine
  evaluations, and the same starts and weight without the screen 21,692: 8.5% more with the screen. It took fewer
  evaluations in 9 variants, more in 54 and the same in 9. Of the 73,897 candidates screened, the guard rejected
  3,962 and the interval 44,511; the engine evaluated the best passing candidate 4,838 times, and 828 of those
  became an incumbent. Without the screen the search reaches the same optima: in 63 of the 72 variants it ends at
  the same decisions, and in the other nine within 0.02% of the recovered metal and at most five of the finest
  mesh steps in any decision. The measurement before the build (`docs/design/features/live-optimizer/design.md`,
  "Measured on 2026-09-30") gave 7.9% more over the 12 nominal states, and 1.9% more with one-step candidates
  only; the design was kept as validated, and the cost is its result.
- **The surrogate against the engine.** Where the screen proposed, the surrogate's recovery was on average 0.64
  points from the engine's (the mean of the variants' means; 1.56 at worst).
- **The weight path (OP-07).** With a quarter of the weight on metal, the nominal optima spend 31 to 46% less
  energy per tonne and recover 10 to 35% less metal than the metal-only optimum. The magnetite optimum does not
  move: its grade specification already binds at the metal-only optimum, and a coarser grind would break it. Along
  every path neither the energy nor the metal rises as the weight falls, beyond 3.2e-5 relative, the mesh's
  resolution.

## Verification

- `tests/test_optimization.py::test_objective_and_decisions` (OP-01): at the base both terms are 1, so the
  objective is $2w - 1$; each weight's optimum is at least as good as the other's in its own objective.
- `test_poll_mesh_and_stopping`, `test_progressive_barrier`, `test_infeasible_reports_least_violating` (OP-02 to
  OP-04), and `test_pattern_search_digests`: the pattern search on analytic problems, with the same evaluation
  digests in both languages.
- `test_screen_accepts_only_inside_envelope` and `test_optimum_is_an_engine_result` (OP-05), `test_record_fields`
  (OP-06), `test_constraints_respected`, `test_infeasible_specification_is_never_optimal`,
  `test_off_specification_base_is_restored` and `test_water_constraint_can_bind` (PE-27).
- `frontend/src/test/optimizer-parity.test.ts` (OP-08): the browser re-runs every variant with the bake's screen and
  takes the same steps; CI runs three variants, and `OF_PARITY=full` runs all 96 at release.
- `frontend/src/test/screen.test.ts`, `worker-optimize.test.ts` (OP-09) and `tests/test_contract.py::test_weights_declared`
  (OP-10).

## What it is not

A steady-state optimum of an authored plant model. It knows nothing about froth stability, reagent cost,
concentrate payability terms, or the value of energy beyond the declared weight; with all the weight on metal it
spends every kilowatt the mill has. A pattern search converges to a local optimum on its mesh; the six starts are
the safeguard against a poor one. It does not replace a plant trial: it shows which constraints shape the best
point and in which direction to move.
