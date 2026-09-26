# 01 The system

![OreFlow: what it computes and how it was built](../../frontend/public/svg/tech/01-the-app.svg)

## What OreFlow is

OreFlow computes how a grinding and separation circuit trades recovery, concentrate grade, energy
and water, for twelve authored ore and plant scenarios. Each case is an ore, a plant and an operating
point of twelve contract inputs. The ore lists its minerals (fraction, relative grindability,
liberation size, composite content, flotation parameters), its payables with their head grades and
carrier minerals, and its Bond ball-mill and crushing work indices; densities and compositions come
from one shared mineral table. The plant declares its family (rougher, gravity, magnetic or
desliming), the crusher, the mill with its installed power, the cyclone geometry, the flotation banks
or the separators, the grade specification and the water limit. The engine carries every stream as
the mass flow of every mineral in each of 63 size classes plus a water flow, solves the closed
circuits, and closes the balance of every unit within 1e-9 relative.

It is for three readers: a process metallurgist checking the direction and size of a trade-off, a
student of mineral processing learning why recovery, grade and energy move together, and a data
scientist asking how far a learned surrogate of a process can be trusted when the ore changes.

## What it is not

The non-goals are those of the [software design document](../design/SDD.md):

- It is not a calibrated plant simulator. Parameters are authored inside published ranges and each
  carries its source; no case is fitted to a plant.
- It is not an economic optimizer: the optimizer maximizes recovered metal under grade, power and
  water constraints, and there are no prices.
- It is not a dynamic simulator: every stream is a steady-state balance, with no control-loop or
  start-up behaviour.
- It is not a substitute for metallurgical testwork, and no output is an operating recommendation.
- It does not model hydrometallurgy (leaching, pressure oxidation, smelting).

The engine is checked against published examples (the Moly-Cop BallSim base case, the GMG Bond
worked examples, the Laplante gravity example, the Zandrivierspoort magnetite tests), labelled as
examples and never as plant data. Two lanes use measured data and stay separate from the engine: the
HZDR particle dataset and the GeoMet locked-cycle tests. Neither calibrates the engine's controls.

## Where the engine runs

| Place | What runs | Written by |
|---|---|---|
| The bake (a workstation) | The Python engine over every variant of every case, the method records (kinetic fits, optimizer, uncertainty, Sobol), the learned lane (CUDA when present) and the benchmark | `data-pipeline/run.py`; see [02 The bake](02_bake-pipeline.md) |
| The committed artifacts | Contract 1, twelve case artifacts, manifests and the index, the learning record with its ONNX networks, the benchmark, the validation record, the two measured lanes | `data/derived/`, `models/` |
| The browser | The contract validator, the TypeScript engine in a Web Worker on every control change, sweeps on request, the ONNX surrogate and guard with onnxruntime-web, the views | `frontend/src/`; see [03](03_browser-engine.md) and [04](04_web-app.md) |
| The service (the VPS) | The Python engine behind the same contract (`POST /api/simulate`), read-only routes for the index, each case and its manifest, the contract and the benchmark, and the built site | `app/`; see [05](05_release-and-deployment.md) |

The Python engine is canonical. The TypeScript port reproduces every baked variant within 1e-6
relative, which is the only reason it is admitted as a live lane. The bake is the only thing that
writes artifacts; CI and deployment never train and never rewrite an artifact (ADR-0074).

## The documents every hand-off goes through

| Document | Schema | Defined in |
|---|---|---|
| The operating contract: every input's unit, bounds per case, step, families, the cross-field rule, bilingual messages, the size grid, the quadrature table and a SHA-256 digest | `oreflow.contract/v1` | [data contract 01](../data-contract/01_operating-contract.md) |
| The trace of one evaluation: point, metrics with units, topology, streams, curves, balances, the kinetic record and flags | `oreflow.trace/v2` | [data contract 02](../data-contract/02_trace-and-live-api.md) |
| The case artifact (definitions and six variants with traces and method records), its manifest and the index | `oreflow.case/v2`, `oreflow.manifest/v2`, `oreflow.index/v2` | [data contract 03](../data-contract/03_case-artifacts.md) |
| The learning record and the exported networks with their scalers and reference block | `oreflow.learning/v1` | [data contract 03](../data-contract/03_case-artifacts.md), [methodology 14](../methodologies/14_learned-lane.md) |
| The benchmark and the validation record | `oreflow.benchmark/v2`, `oreflow.validation/v2` | [data contract 03](../data-contract/03_case-artifacts.md) |
| The measured lanes | `oreflow.particle-benchmark/v1`, `oreflow.geomet-lct/v1` | [data contract 04](../data-contract/04_particle-lane.md), [05](../data-contract/05_geomet-lane.md) |

Every engine artifact (the case artifacts, the manifests and the index, the learning record, the
benchmark and the validation record) carries the engine version, which is the root `VERSION`, and
the contract digest. `scripts/check_artifacts.py` recomputes the digest from the contract file,
checks that the probes were built from the same contract, and rejects an index, a case artifact, a
learning record or a benchmark from another release or another contract instead of reading it. The
two measured lanes are not engine outputs; they carry their own schema and their source record.

## Nothing is computed twice in different ways

- The port imports the Python engine's own constant, atomic-weight and mineral files at build time
  (`frontend/src/engine/constants.ts`).
- The kinetic bank projection uses one Gauss-Laguerre table: the Python engine computes it with numpy
  at the order in the constants file, the contract exports it, and the port reads that export instead
  of computing its own.
- The browser's validator interprets the exported contract file, as the service does, and
  `contract.test.ts` replays every probe verdict the Python validator recorded (more than 500).
- The interface draws what the trace holds: `scripts/check_ui_formulas.py` rejects engine arithmetic
  and solver imports in interface files, and `trace-curves.test.ts` checks that every value the
  grinding and separation charts plot is a trace number, shown as stored or in a display unit.

## Repository map

| Folder | Role |
|---|---|
| `data-pipeline/pipeline/engine/` | The canonical engine: grid, ore, crusher, grinding, cyclone, flotation, separation, energy, balance, kinetics, trace |
| `data-pipeline/pipeline/methods/` | Optimization, uncertainty and Sobol, the learned lane, the published-example oracles |
| `data-pipeline/pipeline/io/contract.py` | Contract 1 and its validator |
| `data-pipeline/pipeline/cases/` | The authored case catalog |
| `data-pipeline/run.py`, `run_geomet.py`, `run_particles.py` | The bake and the two measured lanes |
| `data/derived/`, `models/` | The committed artifacts |
| `frontend/src/engine/` | The TypeScript port and the worker |
| `frontend/src/workbench/`, `frontend/src/content/`, `frontend/src/pages/` | The workbench, the content modules and the pages |
| `app/` | The FastAPI service |
| `tests/`, `frontend/src/test/`, `frontend/gate.mjs`, `scripts/check_*.py` | The gates |
