# Methodologies

OreFlow's engine is a steady-state flowsheet simulator. Every stream is a mass flow in t/h by
particle size class and by mineral, plus water, and every unit model below is written against that
representation. The Python engine in `data-pipeline/pipeline/engine/` is canonical; requirement
PE-31 binds the browser engine to reproduce every baked variant from it within 1e-6 relative.

Pages 01 to 10 are the unit process models. Each states the theory with its equations, how the
engine implements it, the parameters with units and sources, the tests that verify it, and what the
model is not. Sources are primary papers, standards or documented reference implementations located
and checked on 2026-09-26.

| Page | Unit | Engine module |
|---|---|---|
| [01 Size grid, streams and ore](methodologies/01_grid-streams-ore.md) | size classes, minerals, liberation, particle classes | `grid.py`, `streams.py`, `ore.py`, `species.py`, `chemistry.py` |
| [02 Crushing](methodologies/02_crushing.md) | Whiten matrix crusher | `comminution.py` |
| [03 Grinding circuit](methodologies/03_grinding-circuit.md) | energy-specific population balance, closed circuit | `comminution.py`, `grinding.py` |
| [04 Classification](methodologies/04_classification.md) | hydrocyclone partition, Plitt sizing | `cyclone.py` |
| [05 Flotation](methodologies/05_flotation.md) | banks, kinetics, entrainment, recycle, regrind | `flotation.py` |
| [06 Gravity gold](methodologies/06_gravity-gold.md) | gravity bleed in the grinding loop | `grinding.py` |
| [07 Magnetic separation](methodologies/07_magnetic-separation.md) | LIMS rougher and cleaner | `separation.py` |
| [08 Desliming](methodologies/08_desliming.md) | desliming cyclone | `separation.py` |
| [09 Energy](methodologies/09_energy.md) | Bond, operating work index, Rittinger, Kick | `energy.py` |
| [10 Conservation audit](methodologies/10_conservation-audit.md) | independent balance check | `balance.py` |

Pages 11 onward are the methods that read the engine: they fit, optimize or learn from its
results, and each measures its own error against the engine it approximates.

| Page | Method | Module |
|---|---|---|
| [11 Kinetic fits and bank projection](methodologies/11_kinetic-fits.md) | five lumped batch models, Levenberg-Marquardt, tanks-in-series projection, lumping error | `kinetics.py` |
| [12 Constrained optimization](methodologies/12_optimization.md) | recovered metal under grade, power and water constraints, COBYLA from six starts | `methods/optimization.py` |
| [13 Uncertainty and sensitivity](methodologies/13_uncertainty-sensitivity.md) | seeded Latin-hypercube Monte Carlo, constraint probabilities, Saltelli-Sobol first and total indices | `methods/uncertainty.py` |

What the whole engine is not: it is not calibrated to any plant, it is not dynamic, and its numbers
are consequences of authored parameters inside published ranges. Its tests establish that the
declared physics is implemented correctly and that it moves in the directions mineral processing
expects; they do not establish plant accuracy.
