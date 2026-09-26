# OreFlow software design document

Version: 0.05.000 design, 2026-09-26. Supersedes the 0.04.000 document, which described a one-pass
engine. The evidence base for every equation and parameter range is the verified research dossier
of 2026-09-26 (transcribed into `docs/methodologies/`); the defects that motivated the rebuild are listed
in GitHub issue #35. Feature-level requirements with named gates live in
`docs/design/features/process-engine-v2/`.

## 1. Problem and non-goals

OreFlow answers, for twelve authored ore and plant scenarios, how a mineral-processing circuit
turns a crushed feed into concentrate, tailings, energy and water use, and why: how fine to grind
and what that costs, how classification and circulating load shape the product, how collector,
air and residence time trade grade against recovery, how dense gold circulates, how grind sets
magnetite grade, and how slimes are lost in desliming. Every stream is a steady-state mass balance
by particle size and mineral.

Non-goals, stated so they cannot be implied:

- It is not a calibrated plant simulator. Parameters are authored inside published ranges and each
  carries its source; no case is fitted to a plant.
- It is not an economic optimizer. The optimizer maximizes recovered metal subject to physical and
  quality constraints; there are no prices.
- It is not a dynamic simulator. There is no control-loop or start-up behaviour.
- It is not a substitute for metallurgical testwork, and no output is an operating recommendation.
- It does not model hydrometallurgy (leaching, pressure oxidation, smelting).

## 2. Contracts

- **Contract 1, the operating point.** `data-pipeline/pipeline/io/contract.py` declares every
  input once: name, unit, bounds, step, the families it applies to, and the cross-field rules. It is
  exported to `data/derived/contract/operating_contract.json`; the API validator, the browser
  controls and the browser engine all read that file. A state is either valid everywhere or
  rejected everywhere with the same reason.
- **Contract 2, the artifacts.** Per case, `data/derived/cases/<id>.json` holds six variants, each
  with its full operating point, named streams (solids, water, assays, size distribution for the
  key streams), unit curves (partition, recovery by size, bank profile, batch kinetics, energy
  laws), metrics with explicit units, method records and provenance. Manifests, the index, the
  method matrix and the benchmark follow. All artifacts carry the engine version, which is the
  release version.

## 3. Lanes

- **Offline (canonical).** The Python engine computes every variant, every method record, the
  uncertainty and sensitivity runs, the design matrix and every learned model. It is the only lane
  that writes artifacts.
- **Replay.** The website reads committed artifacts for first paint and for every value labelled
  precomputed.
- **Live.** A TypeScript port of the same engine recomputes the circuit when the user moves a
  control. It is admitted as a live lane only because a parity test reproduces every baked variant
  within 1e-6 relative. Sweeps (envelope, decision surface) run in a Web Worker on demand, never on
  every slider event.
- **API.** A bounded FastAPI endpoint runs the Python engine for a validated operating point; it
  never trains or writes artifacts.

## 4. Method ladder and acceptance

Each method is accepted only when it has an engine, a configuration with units, a result in every
applicable variant, tests, documentation and an honest lane label.

| Method | Accepted when |
|---|---|
| Bond energy and operating work index | The GMG worked example is reproduced; the record reports required energy, operating work index and efficiency ratio for the achieved reduction. |
| Rittinger and Kick | Calibrated to Bond at the declared reference reduction; they diverge away from it and are never summed. |
| Whiten matrix crusher | `p = (I - C)(I - BC)^-1 f` with a CSS-driven classification function; mass is conserved; a smaller CSS gives a finer product. |
| Energy-specific population balance (ball mill) | The closed circuit meets the target P80 and design circulating load; the Moly-Cop base case is reproduced within the declared tolerance. |
| Hydrocyclone partition | Plitt/Rosin-Rammler partition with water bypass from the water balance and density-corrected cuts per particle class. |
| Plitt cyclone sizing | Number of cyclones, pressure and Plitt cut for the required cut; the cut at the chosen count is within 10% of the required cut. |
| Gravity concentration (gold) | Gold circulating load exceeds ore circulating load; recovery rises with bleed with diminishing returns, as in the Laplante example. |
| Low-intensity magnetic separation | Liberated magnetite recovery above 90%; concentrate Fe grade rises with finer grind. |
| Flotation banks (rougher and cleaner) | Perfect mixers in series with k from bubble surface area flux, Savassi entrainment, cleaner recycle to the rougher; reduces to the tanks-in-series formula with no entrainment. |
| First-order, Kelsall, Klimpel and compressed/stretched exponential kinetics | Fitted by least squares to the engine's batch curve; each reports parameters, fit error and the plant-bank projection under the same residence distribution. |
| Circuit balance | Solids, each element and water close at every unit and for the circuit, computed from the output streams, not from the solver. |
| Constrained optimization | Maximizes recovered primary element subject to grade, power and water constraints; never returns an infeasible point. |
| Uncertainty and sensitivity | Seeded Monte Carlo quantiles, constraint probabilities and Sobol indices for nominal variants. |
| Ridge, random forest, histogram gradient boosting, Gaussian process, MLP | Evaluated on interpolation and leave-one-case-out splits on recovery, grade and energy; the GP reports interval coverage; the MLP stops on validation loss; ONNX parity for the MLP. |
| Autoencoder guard | A threshold from validation reconstruction error; false-alarm rate in distribution and false-accept rate on held-out cases are reported. |

## 5. Cases

Twelve authored cases in four categories. Each has six variants; each variant changes exactly one
declared input.

| Category | Cases | Why the category exists |
|---|---|---|
| Liberation | soft copper porphyry, hard copper porphyry, fine magnetite | How grind size buys liberation, recovery and grade at an energy cost; how hardness and installed power limit it. |
| Classification | free-milling gold (gravity in the grinding loop), phosphate with clay (desliming), nickel sulphide with serpentine slimes | How classification by size and density decides what reaches separation and what is lost as slimes. |
| Flotation | copper-molybdenum, oxide copper, zinc sulphide | How floatability, collector dose, aeration and residence trade grade against recovery for different minerals. |
| Integration | mixed ore with clay, low-grade copper, refractory gold | Plant-wide constraints: entrainment, throughput against power, low head grade, sulphide concentrates for downstream oxidation. |

## 6. Oracles

- Conservation: solids, element and water closure computed independently of the solver.
- Published examples, each labelled as such and never as plant data: the Moly-Cop BallSim_Direct
  base case (grinding), the GMG Bond-efficiency worked example (energy), the Laplante gravity
  simulator example (gold), and the Zandrivierspoort magnetite grind-grade results.
- Limits: the flotation bank reduces to `1 - (N/(N + k tau))^N` without entrainment; the Savassi
  curve returns 0.2 at its entrainment parameter.
- Directions: every physical claim the product makes (collector, hardness, throughput, grind, cut,
  bleed, desliming cut, aeration) is a test.
- Parity: Python and TypeScript agree within 1e-6 on every variant.

These oracles establish that the engine implements its declared physics correctly. They do not
establish plant accuracy.

## 7. Deploy driver

Unchanged from 0.04.000 and re-measured at release: the repository is public and ships a static SPA
with a live browser engine, so GitHub Pages serves the companion site; the bounded Python API and
artifacts need a Python runtime, which stays on the ML VPS (`oreflow.ml.fasl-work.com`, CPU only).
The driver is the API: if the API is retired, the VPS target is retired with it.

## 8. Risks and kill criteria

- A balance that closes by construction instead of by computation is a release blocker.
- A direction test that fails is a model defect, not a threshold to relax.
- A browser value that differs from the Python value beyond parity tolerance blocks release.
- A case value outside its cited range, or without a source, blocks release.
- A published-example oracle that fails beyond its declared tolerance is investigated before
  release; the tolerance is not widened to pass.
- Any wording that presents authored scenarios as plant results is a release blocker.

## 9. Operating-envelope lane

The Investigate view samples a finite grid of settings around the current operating point, applies
explicit limits (minimum recovery, minimum grade, maximum specific energy, maximum water, maximum
collector) and a declared stress (harder ore, lower floatability), classifies feasible and
non-dominated points and lets the user apply one point or export the full audit record. It runs in a
Web Worker on request. It is a finite conditional sample, not a continuous optimum and not a
confidence statement.

## 10. Measured-data lanes

Unchanged in purpose and kept separate from the simulator: the GeoMet locked-cycle recovery lane
(`data-pipeline/run_geomet.py`, 52 tests from 29 holes, hole and spatial-zone holdouts) and the HZDR
particle lane (`data-pipeline/pipeline/stages/particle_experiment.py`). The GeoMet lane adds paired
bootstrap intervals over holes for each model's error difference from the training mean, because no
model clearly beats that baseline on 52 tests and a ranking without intervals would overstate it.
