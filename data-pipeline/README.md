# OreFlow pipeline

The offline precompute. From the repository root:

```text
python data-pipeline/run.py [--output DIR] [--models DIR] [--workers N]
```

or `scripts/precompute.ps1` (`.sh`), which runs the three measured lanes first and then this bake. Without
`--output` and `--models` the bake writes `data/derived/` and `models/`; with them, a sandbox. `--reuse-learning
FILE` (development bakes only, with a sandbox `--output`) takes the learning record from a file and marks it reused,
so it cannot be committed.

The bake runs eight stages in order: contract, learning, cases, benchmark, studies, real samples, manifests and
validation. Learning runs before the cases because the cases' optimizer screens its search with the networks the
learning stage exports. What each stage reads and writes, and why the stage names differ from ADR-0057's template
list, are in [docs/architecture/02_bake-pipeline.md](../docs/architecture/02_bake-pipeline.md) and
[docs/design/SDD.md](../docs/design/SDD.md), section 3.

- `pipeline/engine/`: the canonical process engine (size grid, ore and particle classes, crusher, grinding circuit,
  cyclones, flotation, separation, energy, balance, kinetics, trace).
- `pipeline/methods/`: the method records (optimization, uncertainty and Sobol, the learned lane and its screen,
  the ablations, the published-example oracles).
- `pipeline/cases/`: the case catalog and the real-sample cases; `pipeline/io/contract.py`: Contract 1.
- `pipeline/stages/`: the stage boundaries.
- `run_particles.py`, `run_geomet.py`, `run_iron_plant.py`: the three measured lanes, each with its pinned source.

The engine models liberation by particle class, the closed grinding circuit's circulating load, and residence in
the flotation banks; it is authored, not calibrated to a plant ([docs/methodologies.md](../docs/methodologies.md)).
