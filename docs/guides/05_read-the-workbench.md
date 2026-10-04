# 05 Read the workbench

The workbench (`https://oreflow.ml.fasl-work.com/`) opens on a case. Everything it shows
comes from one of four places, and knowing which one tells you how far a number can be trusted.

| Where a number comes from | What it is | How it is held to the engine |
|---|---|---|
| **Live**: the readout, Circuit, Grinding, Separation and the Response sweeps | the engine, re-run in your browser on the current state | the browser port reproduces every baked variant within 1e-6 of the Python engine |
| **Live on request**: the optimizer and the uncertainty record in Methods | re-run in a worker on the current state when you press run (the optimizer at any weight on metal, the uncertainty design at any seed and sample count) | the browser reproduces every recorded run within 1e-6 of the Python engine |
| **Baked**: the Sobol indices, the records as first shown, and the Case comparison | computed by the Python engine in the bake, for the variant's state | the committed records, re-checked by `scripts/check_artifacts.py`; when you change a control, a baked panel says it belongs to the variant state |
| **Learned**: the Methods view's learned lane | a neural surrogate of the engine, with a guard | its scores against the engine on held-out states and on held-out cases, printed beside it |

None of it is a measurement of a plant: the cases are authored, each parameter and plausibility range cited or labelled authored.

## The rail

- **The source**: a synthetic case (the default), a GeoMet ore sample or an iron-plant hour. A sample runs the
  soft porphyry's circuit on its own assays and work index; its head grade and work index are fixed, with the
  reason shown, and the operating controls stay live. An hour comes from an iron-ore plant whose circuit is not an
  engine family: the Case view shows its sensors, its assays and the soft sensor's recorded forecasts, and every
  other view says it is not simulated.
- **Case** and **variant**: the twelve cases are listed by a short code (L1 to L3, C1 to C3, F1 to F3,
  I1 to I3, for liberation, classification, flotation and integration) and their names; the variant is the
  nominal design, one of its five single-factor changes, or one of the two cut-mode variants.
- **The question** the case asks.
- **The controls**, in three sections shown one at a time: *Feed and grind* (throughput, work index, head
  grade, crusher setting), *Classification* (the classifier cut, grind target, circulating load, water) and
  *Separation*
  (collector, gas velocity, rougher cells, gravity bleed, desliming cut). A case shows only the inputs its
  circuit uses. A value outside the case's envelope is refused with the contract's message, and the engine
  is not run on it.
- **The classifier cut** switches the grinding circuit to the cut mode: the cut is set, the mill draws its
  installed power, and the grind target and the circulating load become results, which the Grinding view labels.
- **Open the focus view**: one instrument on the whole screen, with the headline numbers on top and the
  controls beside it.

## The readout

One row over every view: recovery of the primary payable, concentrate grade, total specific energy, product
P80 and mill power, then the engine's flags (or "No engine flags"), then the reading of
whichever chart has your cursor.

## The views

| View | Read it for |
|---|---|
| **Circuit** | the flowsheet with every stream's tonnage and grade; the dashed lines are recycles (cyclone underflow to the mill, cleaner tails to the rougher). Click a unit to see its inputs, outputs and closure error |
| **Grinding** | the size distributions of the circuit streams, the cyclone partition with its cut and water bypass, the liberation of each valuable mineral by size, and where the target and the liberation sizes sit |
| **Separation** | for flotation, recovery by size in the rougher, the grade-recovery curve down the bank, and the kinetic record (the virtual batch test, five fitted models, their projections to the bank); for magnetite, the drums' capture by particle class; for phosphate, the desliming partition |
| **Response** | press run to sweep one input, or two as a decision surface with the grade-specification and installed-power boundaries drawn; rejected states are hatched, the current state and the baked optimum marked |
| **Methods** | the optimizer's record and its run at another weight, the uncertainty record (quantiles, the probability of meeting each constraint) and its re-run at another seed or sample count, the Sobol indices, and the learned lane beside the engine |
| **Case** | the case's context (problem, variables, formalization, scope, what each variant shows, how to read it) and the eight variants side by side, with all twelve cases on one map of recovery against energy |

Charts share one set of gestures: hover for a reading, click a legend entry to hide a series, drag to zoom,
Escape or the reset button to restore, and the arrow keys to step through samples.

## The flags

| Flag | Meaning |
|---|---|
| `power_limited` | the mill runs at its installed power; the product is coarser than the target |
| `power_limit_not_converged` | the energy at installed power did not settle; the last pass is reported |
| `target_unreachable` | the target P80 cannot be reached within the energy search range |
| `circulating_load_unreachable` | the design circulating load cannot be held at this energy |
| `circulating_load_out_of_range` | in the cut mode, the cut sets a circulating load outside the range the target mode accepts |
| `cut_mode_load_not_converged` | in the cut mode, the circulating load did not settle; the last pass is reported |
| `mill_water_negative`, `sump_water_negative` | the declared densities leave no room for water at the mill or the sump |
| `recycle_not_converged` | the flotation recycle did not converge |
| `composite_scale_not_converged` | the host-limited composites did not converge |
| `negative_mass` | a class mass is negative beyond round-off |
| `non_finite_output` | a non-finite number was replaced by null |

The first five describe an operating state (a real plant can be power-limited); the rest would describe a
numerical failure, and the gates fail any baked variant that carries `negative_mass` or `non_finite_output`. A
cut-mode state with no steady state is not flagged but refused, with the contract's message: the mill cannot draw
its installed power at that cut (`power_unreachable_at_cut`), or the cut would return more than 600% to the mill
(`circulating_load_above_bound`).

## Sharing what you see

The URL carries the case, the variant, the view and every control you changed; copy it to send the exact
state. The focus view uses the same URL, so leaving it returns you to the same state.

## How far to trust it

- The **directions** (a finer grind costs energy and frees more mineral; more collector trades grade for
  recovery; a harder ore at installed power coarsens the grind) are the engine's physics, tested on every
  case they apply to.
- The **sizes** of the effects depend on the authored parameters. The engine is checked against published
  examples (the Benchmark page), not against a plant.
- The **learned lane** is scored twice: inside the cases it trained on, and on a case it never saw. Only
  the second tells you how it would do on a new ore; the Benchmark page's Learned lane tab has both.
