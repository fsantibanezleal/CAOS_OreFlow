# 12 Constrained operating-point optimization

The question a plant engineer asks of a circuit model is rarely "what happens at this point" and
more often "where should I run it". OreFlow answers that question for each baked variant with a
constrained optimization of the engine itself.

## Problem

Maximize the recovered primary payable, in t/h of the payable species (for example t/h of Cu or of
Au), over the decisions an operator controls day to day:

| Circuit | Decisions |
|---|---|
| flotation circuits (`rougher`, `gravity_rougher`, `deslime_rougher`) | grind target P80, collector dose, rougher gas velocity |
| magnetite (`magnetic`) | grind target P80 |

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

## Method

COBYLA, Powell's derivative-free method that models the objective and each constraint by linear
interpolation inside a trust region (Powell 1994, doi:10.1007/978-94-015-8330-5_4), in SciPy's
implementation from PRIMA (Zhang 2023, doi:10.5281/zenodo.8052654). The engine is not
differentiable in closed form (root finders, recycles, a power-limited branch), so a method that
needs no derivatives and handles inequality constraints directly fits the problem.

- Decisions are scaled to the unit cube of their bounds. The trust region starts at 0.25 of each
  range and ends at 1e-4; each start may use up to 200 circuit evaluations.
- Six starts: the variant's own point and five declared interior points (the magnetite circuit uses
  the first coordinate of each, so it has fewer distinct starts).
- Constraints are relative slacks, `(value - limit) / limit` with the sign that makes a feasible
  point non-negative; a point is feasible when every slack is at least -1e-6.
- Every evaluated point is also checked against Contract 1; an invalid point counts as a violation.
- The best start that ends feasible is simulated again from scratch, and its values and slacks are
  reported from that fresh run, not from the optimizer's cache. Constraints within 1e-3 of their
  limit are reported as active.
- If no start ends feasible the status is `infeasible`, `optimum` is null and the least-violating end
  point is reported with its slacks. An infeasible point is never labelled optimal.

## The record

`status` (`optimal` or `infeasible`), `decisions`, `bounds`, `constraints` (limits), `base` (the
variant's own point with its values, slacks and feasibility), `optimum` (decisions, recovered t/h,
recovery, grade, required power, water, slacks, active constraints), `gain_tph` and `gain_pct`
against the base, `starts` (each start and end point with its feasibility and evaluation count),
`evaluations`, and `least_violating` when infeasible.

## What the nominal cases show

Measured on 2026-09-26; the baked numbers for every variant are on the Experiments page.

- All six starts reach the same optimum in every case, so the answer does not depend on where the
  search begins.
- Four copper cases (hard porphyry, copper-molybdenum, clay and low grade) end with both the grade
  and the power constraints active: more collector and air until the concentrate is at the
  specification, and the finest grind the mill can deliver. The soft porphyry, with a wider grade
  margin, is limited by power alone.
- Two nominal points are off their own specification, the hard porphyry (23.7% Cu against 24%) and
  the zinc case (47.3% Zn against 50%). For both, the optimizer finds a point that meets the
  specification and also recovers more, through a finer grind, less collector and more air.
- The gas velocity ends at its upper bound in almost every case. That is a property of the model: a
  higher gas velocity raises the bubble surface area flux, and the engine has no froth-stability
  penalty, so the bound of 2.5 cm/s is what stops it. In the nickel case the water constraint binds
  first.
- In the phosphate case no constraint is active at the grind: a finer grind loses more apatite to
  slimes, so the grind has an interior optimum.

## Verification

- `tests/test_optimization.py::test_constraints_respected` (PE-27): on four cases covering every
  constraint type, including the one-decision magnetite circuit, the optimum is re-simulated
  independently and satisfies every constraint; the reported slacks equal the recomputed ones; the
  optimum is at least as good as every feasible start and as a feasible base; active constraints are
  within tolerance of their limits.
- `test_infeasible_specification_is_never_optimal`: with an impossible 40% Cu specification the
  status is `infeasible`, there is no optimum, and the least-violating point shows the grade deficit.
- `test_off_specification_base_is_restored` and `test_water_constraint_can_bind`.

## What it is not

A steady-state optimum of an authored plant model. It knows nothing about froth stability,
reagent cost, concentrate payability terms or the value of energy; the objective is recovered metal
alone, which is why it spends every kilowatt the mill has. It does not replace a plant trial: it
shows which constraints shape the best point and in which direction to move.
