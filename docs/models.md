# Process models

OreFlow's engine is a steady-state flowsheet simulator. Every stream is a mass flow in t/h by
particle size class and by mineral, plus water, and every unit model below is written against that
representation. The Python engine in `data-pipeline/pipeline/engine/` is canonical; the browser
engine is a line-by-line port checked against it on every baked variant.

Each page states the theory with its equations, how the engine implements it, the parameters with
units and sources, the tests that verify it, and what the model is not. Sources are primary papers,
standards or documented reference implementations located and checked on 2026-09-26.

| Page | Unit | Engine module |
|---|---|---|
| [01 Size grid, streams and ore](models/01_grid-streams-ore.md) | size classes, minerals, liberation, particle classes | `grid.py`, `streams.py`, `ore.py`, `species.py`, `chemistry.py` |
| [02 Crushing](models/02_crushing.md) | Whiten matrix crusher | `comminution.py` |
| [03 Grinding circuit](models/03_grinding-circuit.md) | energy-specific population balance, closed circuit | `comminution.py`, `grinding.py` |
| [04 Classification](models/04_classification.md) | hydrocyclone partition, Plitt sizing | `cyclone.py` |
| [05 Flotation](models/05_flotation.md) | banks, kinetics, entrainment, recycle, regrind | `flotation.py` |
| [06 Gravity gold](models/06_gravity-gold.md) | gravity bleed in the grinding loop | `grinding.py` |
| [07 Magnetic separation](models/07_magnetic-separation.md) | LIMS rougher and cleaner | `separation.py` |
| [08 Desliming](models/08_desliming.md) | desliming cyclone | `separation.py` |
| [09 Energy](models/09_energy.md) | Bond, operating work index, Rittinger, Kick | `energy.py` |
| [10 Conservation audit](models/10_conservation-audit.md) | independent balance check | `balance.py` |

What the whole engine is not: it is not calibrated to any plant, it is not dynamic, and its numbers
are consequences of authored parameters inside published ranges. Its tests establish that the
declared physics is implemented correctly and that it moves in the directions mineral processing
expects; they do not establish plant accuracy.
