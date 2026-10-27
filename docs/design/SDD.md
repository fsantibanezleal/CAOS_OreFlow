# OreFlow software design document

Version: 0.10.003, 2026-10-26. This document retains the scientific model and feature history from 0.08.000 while adopting the current product-template design record.

## Problem and non-goals

OreFlow answers, for twelve authored ore and plant scenarios, how a mineral-processing circuit
turns a crushed feed into concentrate, tailings, energy and water use, and why: how fine to grind
and what that costs, how classification and circulating load shape the product, how collector,
air and residence time trade grade against recovery, how dense gold circulates, how grind sets
magnetite grade, and how slimes are lost in desliming. Every stream is a steady-state mass balance
by particle size and mineral.

Non-goals, stated so they cannot be implied:

- It is not a calibrated plant simulator. Parameters are authored, each with its source or the label
  authored; no case is fitted to a plant.
- It is not an economic optimizer. The optimizer maximizes recovered metal subject to physical and
  quality constraints; there are no prices.
- It is not a dynamic simulator. There is no control-loop or start-up behaviour.
- It is not a substitute for metallurgical testwork, and no output is an operating recommendation.
- It does not model hydrometallurgy (leaching, pressure oxidation, smelting).

### Executive brief

The executive view is the decision context and evidence inventory for the research system. Its bilingual source data is maintained separately so the shell can render the same claims and citations in either language.

Data file: content/executive.json

## Executive brief

The executive view frames the decision context and the evidence needed to interpret the research system. Its bilingual copy, cited figures and three illustrations are maintained as structured content for the shared shell.

Data file: content/executive.json


## Research basis

- Herbst and Fuerstenau (1980), energy-specific breakage for ball-mill scale-up, *International Journal of Mineral Processing* 7(1), 1-31. https://doi.org/10.1016/0301-7516(80)90034-4. The model informs the population-balance grinding implementation; OreFlow records its declared simplifications in `docs/methodologies/03_grinding-circuit.md`.
- Kelsall (1961), flotation kinetics and perfect mixing, *Journal of the South African Institute of Mining and Metallurgy*. https://doi.org/10.1016/0301-7516(81)90019-3. OreFlow compares first-order and distributed-rate models; its rates are not calibrated plant constants.
- Breiman (2001), random forests, *Machine Learning* 45, 5-32. https://doi.org/10.1023/A:1010933404324. The learned lane includes this estimator, alongside linear, boosting, Gaussian-process and neural models.
- Friedman (2001), greedy function approximation, *Annals of Statistics* 29(5), 1189-1232. https://doi.org/10.1214/aos/1013203451. The learned lane's histogram-gradient model is compared under interpolation, leave-one-case-out and grouped ore transfer.
- Polat and Chander (2000), rate distributions in flotation kinetics, *International Journal of Mineral Processing*. https://doi.org/10.1016/S0301-7516(99)00069-1. The kinetic comparison includes distributed-rate fits.
- Bu et al. (2017), flotation kinetic model comparison, *Physicochemical Problems of Mineral Processing*. https://doi.org/10.5277/ppmp170128. The kinetic comparison evaluates the published model families on one generated record.
- Vinnett and Waters (2025), flotation kinetics, *Minerals Engineering*. https://doi.org/10.1016/j.mineng.2025.109246. This recent work informs the documented limitations of rate-distributed fits.
- Kingma and Ba (2015), Adam optimization. https://doi.org/10.48550/arXiv.1412.6980. The learned-lane MLP uses Adam; the notebook compares established estimators and makes no algorithm novelty claim.
- Rasmussen and Williams (2006), *Gaussian Processes for Machine Learning*. https://doi.org/10.1017/CBO9780511790423. The learned lane reports empirical interval coverage for its Gaussian-process model.
- Global Mining Guidelines Group (2021), *Determining the Bond Efficiency of Industrial Grinding Circuits*, GMG01-MP-2021. https://www.globalminingguidelines.org/guidelines/bond-efficiency/. OreFlow documents its Bond-method applicability and fineness caveats.
- Torczon (1997), pattern search methods for nonlinear optimization. https://doi.org/10.1137/S1052623493250780. OreFlow uses a generalized pattern search over the declared operating bounds.
- Audet and Dennis (2009), mesh adaptive direct search algorithms for constrained optimization. https://doi.org/10.1137/070692662. OreFlow uses a declared progressive-barrier simplification and records its limits in `docs/methodologies/12_optimization.md`.
- Booker et al. (1999), managing the evaluation of engineering design problems with surrogate models. https://doi.org/10.1007/BF01197708. OreFlow's optimizer uses a guarded surrogate to order search proposals while the process engine remains the objective evaluator.
- Saltelli et al. (2010), variance-based sensitivity analysis of model output. https://doi.org/10.1016/j.cpc.2009.09.018. OreFlow estimates first-order and total Sobol indices and documents sampling limitations in `docs/methodologies/13_uncertainty-sensitivity.md`.
- Herman and Usher (2017), SALib: an open-source Python library for sensitivity analysis. https://doi.org/10.21105/joss.00097. OreFlow uses SALib for its scrambled Sobol design and index estimation.
- McKay, Beckman and Conover (1979), comparison of three methods for selecting values of input variables in the analysis of output from a computer code. https://doi.org/10.1080/00401706.1979.10489755. OreFlow uses a seeded Latin-hypercube design for uncertainty propagation.

UNVERIFIED: authored circuit parameter ranges are scenario assumptions, not plant measurements or calibration. The iron-plant dataset's measurements are kept in a separate predictive lane and do not validate the simulator.
- OreFlow source and derived records: https://github.com/fsantibanezleal/CAOS_OreFlow/tree/develop/data/derived. Authored scenarios and measured-data lanes are distinguished in every artifact.


- OreFlow derived record index: https://github.com/fsantibanezleal/CAOS_OreFlow/tree/develop/data/derived.

## Sizing and contracts

OreFlow currently contains six public routes, twelve authored cases and eight controlled variants per case. These figures describe the authored simulation suite; they do not represent plant coverage. The Python operating contract is the canonical declaration for units, bounds and case applicability. Each committed JSON document is catalogued with a schema, producer and consumer check.

### Operating contract

- **Contract 1, the operating point.** `data-pipeline/pipeline/io/contract.py` declares every
  input once (thirteen: name, unit, bounds per case, step, the families it applies to, and the cross-field
  rule for the desliming cut) and the three method controls (the uncertainty seed and sample count, the
  optimizer's weight on metal). It is exported to `data/derived/contract/operating_contract.json`; the API
  validator, the browser controls and the browser engine all read that file. A state is either valid
  everywhere or rejected everywhere with the same error code, and every state it accepts is solved by the
  engine with closed balances. The GeoMet samples are validated apart from it: their assays lie outside
  the synthetic envelope, and their head grade and work index are fixed by the sample.
- **Contract 2, the artifacts.** Per case, `data/derived/cases/<id>.json` holds eight variants, each
  with its full operating point, named streams (solids, water, assays, size distribution for the
  key streams), unit curves (partition, recovery by size, bank profile, batch kinetics, energy
  laws), metrics with explicit units, method records and provenance. Manifests, the index, the
  learning record with the exported networks and the optimizer's screen, the benchmark, the studies, the
  real-sample record and the validation record follow. Every engine record carries the engine version, which
  is the release version, and the contract digest. The exported networks carry neither and are bound to the
  learning record by their byte counts. The three measured lanes' records (`data/derived/source/`) carry
  their own schemas and source pins. The schemas are in `docs/data-contract/`.

## Technology and versions

Pinned versions are read from the committed requirement files and npm lock. Shell 0.19.2 is the published package release.

| component | package | version | use | alternative considered |
|---|---|---|---|---|
| web | @fasl-work/caos-app-shell | 0.19.2 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | @types/node | 24.13.4 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | @types/react | 19.3.0 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | @types/react-dom | 19.3.0 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | @vitejs/plugin-react | 6.1.1 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| development | fastapi | 0.116.1 | Directly pinned in `requirements-api.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| development | httpx | 0.28.1 | Directly pinned in `requirements-dev.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| notebooks | ipykernel | 7.4.0 | Directly pinned in `notebooks/requirements.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | joblib | 1.4.2 | Directly pinned in `requirements-precompute.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| development | jsonschema | 4.26.0 | Directly pinned in `requirements-dev.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | katex | 0.19.1 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | lucide-react | 1.43.0 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| notebooks | matplotlib | 3.11.2 | Directly pinned in `notebooks/requirements.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| notebooks | nbclient | 0.11.0 | Directly pinned in `notebooks/requirements.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| notebooks | nbformat | 5.11.1 | Directly pinned in `notebooks/requirements.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | numpy | 2.2.6 | Directly pinned in `requirements.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | onnx | 1.20.0 | Directly pinned in `requirements-gpu.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | onnxruntime | 1.24.2 | Directly pinned in `requirements-gpu.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | onnxruntime-web | 1.29.0 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | openpyxl | 3.1.5 | Directly pinned in `requirements-precompute.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | pandas | 2.2.3 | Directly pinned in `requirements-precompute.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | playwright | 1.61.0 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| development | pydantic | 2.11.7 | Directly pinned in `requirements-api.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| development | pytest | 9.1.1 | Directly pinned in `requirements-dev.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | react | 19.3.0 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | react-dom | 19.3.0 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | react-router | 8.3.1 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| development | ruff | 0.15.18 | Directly pinned in `requirements-dev.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | salib | 1.6.0 | Directly pinned in `requirements-precompute.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | scikit-learn | 1.5.2 | Directly pinned in `requirements-precompute.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | scipy | 1.17.1 | Directly pinned in `requirements-precompute.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| research | torch | 2.12.0+cu126 | Directly pinned in `requirements-gpu.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | typescript | 7.0.2 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | uplot | 1.6.32 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| development | uvicorn | 0.35.0 | Directly pinned in `requirements-api.txt`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | vite | 8.3.5 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | vitest | 5.0.0 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |
| web | zustand | 5.0.15 | Directly pinned in `frontend/package-lock.json`; see the corresponding build or research lane. | The exact pin is retained for reproducibility and checked against its manifest. |

## Resources

| stage | memory | disk | time | where it runs |
|---|---|---|---|---|
| bake | measured at release from the pipeline process | committed outputs under `data/derived/`; exact size recorded by the release manifest | recorded by the bake manifest and release log | workstation; never CI |
| training | bounded by the selected CPU/GPU lane; device recorded in artifact | model artifacts under `models/` and `data/derived/` | recorded in `data/derived/learning.json` | workstation with declared device |
| tests | bounded process memory; recorded by the release gate | temporary test fixtures only | measured by `pytest` release log | workstation; cheap static tests in CI |
| build | bounded by Node/Vite; recorded by the build log | `frontend/dist/` | recorded by the build log | workstation and CI |
| deploy | bounded by release payload; recorded in deployment record | versioned VPS release payload | recorded by deployment workflow | ML VPS |


## Lanes

- **Offline (canonical).** The Python engine computes every variant, every method record, the
  uncertainty and sensitivity runs, the design matrix and every learned model. It is the only lane
  that writes artifacts. `scripts/precompute.ps1` runs the three measured lanes first, each from its own
  script, then the eight stages of `data-pipeline/run.py`: contract, learning, cases, benchmark, studies,
  real samples, manifests, validation. Learning runs before the cases because the cases' optimizer screens
  its search with the networks the learning stage exports.
- **Replay.** The website reads committed artifacts for first paint and for every value labelled
  precomputed.
- **Live.** A TypeScript port of the same engine recomputes the circuit when the user moves a
  control. It is admitted as a live lane only because a parity test reproduces every baked variant
  within 1e-6 relative. Sweeps (envelope, decision surface) run in a Web Worker on demand, never on
  every slider event. Since 0.07.000 the optimizer re-runs at any weight in its own worker and the
  uncertainty design at any seed and sample count, both on request; their measured basis is the browser
  parity of every recorded run (OP-08, UQ-05). The optimizer's screen runs the exported networks' weights
  in float64. A GeoMet sample runs live on its own ore and point (RS-06, within 1e-6 of its record); an
  iron-plant hour is shown, never simulated, because its circuit is not an engine family.
- **API.** A bounded FastAPI endpoint runs the Python engine for a validated operating point; it
  never trains or writes artifacts.

**The stages against ADR-0057.** ADR-0057 item 4 names a template's stages (ingest, preprocess, dataset and split,
feature extraction, train, infer, evaluate, export, validate). OreFlow is a simulator, not a model trained on an
ingested dataset: its engine reads no dataset, and its learned lane trains on the engine's own states. Its
orchestrator (`data-pipeline/pipeline/pipeline.py`) therefore runs the eight stages above, each with typed inputs and
outputs and none a no-op (ADR-0069). The measured lanes, which do ingest datasets, keep their own scripts with
their pinned sources, preprocessing, splits and evaluation (`docs/data-contract/04_particle-lane.md` to `06`). This deviation is
deliberate and recorded here.

### Response lane

The 0.04.000 Investigate view is superseded (`docs/design/features/operating-envelope/`). The Response
view sweeps one contract input, or two as a decision surface with the grade-specification and
installed-power boundaries drawn, with the engine in a Web Worker and only on an explicit request
(PE-38); every cell is validated first and a rejected cell is recorded with its code. The constrained
optimizer (PE-27) answers the question the envelope approximated: the best point within every
constraint, from six starts, simulated again before it is reported. Both are conditional on the
authored plant and are not confidence statements.

### Measured-data lanes

Three lanes on measured data, none of which calibrates the simulator: the GeoMet locked-cycle recovery lane
(`data-pipeline/run_geomet.py`, 52 tests from 29 holes, hole and spatial-zone holdouts), the HZDR particle lane
(`data-pipeline/run_particles.py`, `pipeline/stages/particle_experiment.py`) and, since 0.07.000, the iron-plant
soft sensor (`data-pipeline/run_iron_plant.py`, one plant's next-hour silica on forward windows). The GeoMet
samples also run through the engine as inputs (the real-samples stage), as a comparison. The GeoMet lane adds paired
bootstrap intervals over holes for the error difference of every pair of models, because on 52 tests
the point estimates do not rank the models: on the five fixed hole folds ridge beats the training mean by 0.42 points of RMSE (95% interval 0.02 to 0.82), but that partition sits at the 98.5th percentile of 200 random hole partitions; averaged over them the gain is 0.17 points (-0.39 to 0.71) and under leave one hole out 0.22 (-0.36 to 0.79), each interval widened for the six model pairs, and under spatial-zone folds no difference excludes zero either. No model separates from the training mean.

## Method ladder

Each method is accepted only when it has an engine, a configuration with units, a result in every
applicable variant, tests, documentation and an honest lane label.

| Method | Accepted when |
|---|---|
| Bond energy and operating work index | The GMG worked example is reproduced; the record reports required energy, operating work index and efficiency ratio for the achieved reduction. |
| Rittinger and Kick | Calibrated to Bond at the declared reference reduction; they diverge away from it and are never summed. |
| Whiten matrix crusher | `p = (I - C)(I - BC)^-1 f` with a CSS-driven classification function; mass is conserved; a smaller CSS gives a finer product. |
| Energy-specific population balance (ball mill) | The closed circuit meets the target P80 and design circulating load; the Moly-Cop base case is reproduced within the declared tolerance. |
| Hydrocyclone partition | Plitt/Rosin-Rammler partition with water bypass from the water balance and density-corrected cuts per particle class. |
| Plitt cyclone sizing | Number of cyclones, pressure and Plitt cut for the required cut, sized again for every state. The equations are uncalibrated, and at Moly-Cop's published classifier states the sizing misses; the count and pressure are an estimate, never a result or a flag (0.08.000). |
| Gravity concentration (gold) | The gravity-recoverable gold classifies at a density-corrected cut (exponent fitted to measured partitions) and the unit recovers it by size on its bleed; its circulating load exceeds the ore's, and recovery rises with the bleed with diminishing returns. The like-for-like Laplante example is run with its published inputs, and its miss is recorded, not tuned away (0.08.000). |
| Low-intensity magnetic separation | Liberated magnetite recovery above 90%; concentrate Fe grade rises with finer grind. |
| Flotation banks (rougher and cleaner) | Perfect mixers in series with k from bubble surface area flux, Savassi entrainment, cleaner recycle to the rougher; reduces to the tanks-in-series formula with no entrainment. |
| First-order, Kelsall, Klimpel, gamma and compressed/stretched exponential kinetics | Fitted by least squares to the engine's batch curve; each reports parameters, fit error and the plant-bank projection under the same residence distribution. |
| Circuit balance | Solids, each element and water close at every unit and for the circuit, computed from the output streams, not from the solver. |
| Constrained optimization | Maximizes recovered primary element subject to grade, power and water constraints; never returns an infeasible point. |
| Uncertainty and sensitivity | Seeded Monte Carlo quantiles, constraint probabilities and Sobol indices for nominal variants. |
| Ridge, random forest, histogram gradient boosting, Gaussian process, MLP | Evaluated on interpolation (pooled and within each case), leave-one-case-out and leave-one-ore-group-out splits on recovery, grade and energy; the GP reports interval coverage; the MLP stops on validation loss; ONNX parity for the MLP. |
| Autoencoder guard | A threshold from validation reconstruction error; false-alarm rate in distribution and false-accept rate on held-out cases are reported. |
| Pattern search with a progressive barrier and a surrogate-screened search step (0.07.000) | The same evaluation sequence and optimum in Python and the browser within 1e-6 at every recorded weight; every reported optimum is an engine result; the saving in engine evaluations and the surrogate's disagreement are records (`features/live-optimizer/`). |
| SplitMix64 Latin hypercube (0.07.000) | The published SplitMix64 vector in both languages; bit-identical factors in the browser; one sample per stratum per input (`features/live-uncertainty/`). |
| Classifier-cut mode (0.07.000) | At a given cut the mill draws the installed power; the two modes agree at the same state within 0.5%; balances close within 1e-9 (`features/cut-mode/`). |
| Real-sample runs (0.07.000) | Pinned sources with a row ledger; the Bond work index reproduced from the BWI columns (15.2 to 26.1 kWh/t); the engine's recovery beside the measured locked-cycle one, labelled a comparison and not a calibration (`features/real-samples/`). |
| Mechanism ablations (0.07.000) | Each switch, declared in the study (`methods/ablations.py`), inert when on; balances close with each switch off; a case without the mechanism is not applicable, never zero (`features/ablation-and-pages/`). |
| Iron-plant soft sensor (0.07.000) | Pinned archive; interpolated hours dropped and held laboratory values scored apart (0.08.000); forward windows with an embargo; persistence and the fitted last assay as the comparators (`features/industrial-soft-sensor/`). |

| Class | OreFlow method | Acceptance evidence |
|---|---|---|
| Classical | Rittinger, Kick, Bond, Whiten, population balance, partition curves, first-order and distributed flotation kinetics | independent balances, limiting cases, direction tests and published example comparisons in the engine suite |
| Statistical | constrained finite-grid search, uncertainty propagation and Sobol sensitivity | contract-valid states, deterministic seed records and explicitly labelled scenario uncertainty |
| Learned | ridge, random forest, histogram gradient boosting, Gaussian process and multilayer perceptron | interpolation, leave-one-case-out, held-out ore groups, calibration/coverage and seed dispersion in `data/derived/learning.json` |
| Frontier | none claimed | OreFlow makes no claim of superiority to the state of the art; its contribution is an integrated, inspectable research implementation with explicit validation limits |

## Cases

Twelve authored cases in four categories. Each has eight variants; each variant changes exactly one
declared input, and the last two run the grinding circuit in the cut mode (since 0.07.000).

| Category | Cases | Why the category exists |
|---|---|---|
| Liberation | soft copper porphyry, hard copper porphyry, fine magnetite | How grind size buys liberation, recovery and grade at an energy cost; how hardness and installed power limit it. |
| Classification | free-milling gold (gravity in the grinding loop), phosphate with clay (desliming), nickel sulphide with serpentine slimes | How classification by size and density decides what reaches separation and what is lost as slimes. |
| Flotation | copper-molybdenum, oxide copper, zinc sulphide | How floatability, collector dose, aeration and residence trade grade against recovery for different minerals. |
| Integration | mixed ore with clay, low-grade copper, refractory gold | Plant-wide constraints: entrainment, throughput against power, low head grade, sulphide concentrates for downstream oxidation. |

The coverage matrix: which mechanism each case exercises, from its nominal circuit, its payables and its variants
(`docs/use-cases.md` renders the same matrix from the records; `tests/test_docs_counts.py` holds this one to them).
Every case runs the cut mode, and every harder-ore and higher-throughput variant is power-limited.

| Case | Gravity bleed | Desliming | LIMS drums | Flotation | Regrind | Recleaner | Second payable | Levers of its own |
|---|---|---|---|---|---|---|---|---|
| copper_porphyry_soft |  |  |  | yes | yes | yes |  |  |
| copper_porphyry_hard |  |  |  | yes | yes | yes |  |  |
| iron_magnetite_fine |  |  | yes |  |  |  |  | finer_grind, finer_crusher |
| gold_free_milling | yes |  |  | yes |  |  |  | larger_bleed |
| phosphate_clay |  | yes |  | yes |  | yes |  | coarser_deslime |
| nickel_sulphide |  | yes |  | yes | yes | yes |  | coarser_deslime |
| copper_molybdenum |  |  |  | yes | yes | yes | yes |  |
| copper_oxide |  |  |  | yes |  |  |  |  |
| zinc_sulfide |  |  |  | yes |  | yes |  |  |
| mixed_ore_high_clay |  | yes |  | yes | yes | yes |  | coarser_deslime |
| low_grade_copper |  |  |  | yes | yes | yes |  |  |
| refractory_gold |  |  |  | yes |  |  |  |  |

## Oracles

- Conservation: solids, element and water closure computed independently of the solver.
- Published examples, each labelled as such and never as plant data: the Moly-Cop BallSim_Direct
  base case re-solved with every input it publishes, net energy against net energy (grinding); the GMG
  Bond-efficiency worked examples (the formula on the published inputs, no circuit); the Laplante gravity
  example run with its published inputs on a GRG ore, whose miss is recorded; and the Zandrivierspoort
  magnetite grind-grade results, a trend oracle on another ore whose gap is shown. Since 0.08.000 each
  oracle records what it published, what the engine gives and the miss, and a tolerance set before the run.
- Limits: the flotation bank reduces to `1 - (N/(N + k tau))^N` without entrainment; the Savassi
  curve returns 0.2 at its entrainment parameter.
- Directions: every physical claim the product makes (collector, hardness, throughput, grind, cut,
  bleed, desliming cut, aeration) is a test.
- Parity: Python and TypeScript agree within 1e-6 on every variant.

These oracles establish that the engine implements its declared physics correctly. They do not
establish plant accuracy.

## Deploy driver

The plan's decision, re-measured at release: OreFlow is deployed in one place, the ML VPS
(`oreflow.ml.fasl-work.com`, CPU only, deploy class `vps-service`), because the repository carries Python
dependencies, model checkpoints and records, and the bounded Python API needs a Python runtime. The site
is built and served there with the API. A second publish path breaks the rule that a repository carries
only the deploy path it declares: the template's GitHub Pages workflow, which published a copy from
0.02.001 to 0.07.000, is removed in 0.08.000 and named by the template-residue guard.

## Risks and kill criteria

- A balance that closes by construction instead of by computation is a release blocker.
- A direction test that fails is a model defect, not a threshold to relax.
- A browser value that differs from the Python value beyond parity tolerance blocks release.
- A case value outside its cited range, or without a source, blocks release.
- A published-example oracle that fails beyond its declared tolerance is investigated before
  release; the tolerance is not widened to pass.
- Any wording that presents authored scenarios as plant results is a release blocker.

## ADR fit

| ADR | Decision in OreFlow | Evidence |
|---|---|---|
| ADR-0057 | named offline scientific stages with non-no-op transformations | `data-pipeline/pipeline/pipeline.py` and stage modules |
| ADR-0058 | shared shell, six direct routes and architecture view | `frontend/src/main.tsx`, `frontend/src/architecture/` |
| ADR-0069 | each method has an explicit acceptance criterion and validation lane | Method ladder and `tests/` |
| ADR-0070 | interactive workbench provides Focus mode for its process cases | `frontend/src/workbench/FocusWorkbench.tsx` |
| ADR-0074 | training and bake stay out of CI; static and browser gates run there | `.github/workflows/ci.yml` |
| ADR-0075 | feature requirements name implemented validation gates | `docs/design/features/*/requirements.md` and `validation.md` |
| ADR-0078 | exact published shared-shell pin | `frontend/package.json` and lockfile |

### Feature designs and status

Each feature has its requirements (EARS, each naming its gate), its design and its tasks with the convergence
verdict (ADR-0075). `scripts/check_sdd.py` checks that every live requirement names a gate that exists.

| Feature | Status | Requirements | Files |
|---|---|---|---|
| Process engine v2 | live since 0.05.000; requirements amended in 0.06.000 (PE-07b) and 0.08.000 (PE-08, PE-18) | PE-01 to PE-40 | [requirements](features/process-engine-v2/requirements.md), [design](features/process-engine-v2/design.md), [tasks and verdicts](features/process-engine-v2/tasks.md) |
| GeoMet locked-cycle lane | live since 0.04.000; its verdict is in the process engine's tasks | GM-01 to GM-07 | [requirements](features/geomet-lct/requirements.md), [design](features/geomet-lct/design.md), [tasks](features/geomet-lct/tasks.md) |
| Classifier-cut mode | live since 0.07.000; CM-09 added in 0.08.000 | CM-01 to CM-09 | [requirements](features/cut-mode/requirements.md), [design](features/cut-mode/design.md), [tasks and verdict](features/cut-mode/tasks.md) |
| Live optimizer | live since 0.07.000 | OP-01 to OP-11 | [requirements](features/live-optimizer/requirements.md), [design](features/live-optimizer/design.md), [tasks and verdict](features/live-optimizer/tasks.md) |
| Live uncertainty | live since 0.07.000 | UQ-01 to UQ-08 | [requirements](features/live-uncertainty/requirements.md), [design](features/live-uncertainty/design.md), [tasks and verdict](features/live-uncertainty/tasks.md) |
| Real samples | live since 0.07.000 | RS-01 to RS-10 | [requirements](features/real-samples/requirements.md), [design](features/real-samples/design.md), [tasks and verdict](features/real-samples/tasks.md) |
| Iron-plant soft sensor | live since 0.07.000 | IS-01 to IS-06 | [requirements](features/industrial-soft-sensor/requirements.md), [design](features/industrial-soft-sensor/design.md), [tasks and verdict](features/industrial-soft-sensor/tasks.md) |
| Ablations and page tabs | live since 0.07.000 | AB-01 to AB-04, PG-01 to PG-04 | [requirements](features/ablation-and-pages/requirements.md), [design](features/ablation-and-pages/design.md), [tasks and verdict](features/ablation-and-pages/tasks.md) |
| Workbench shell and focus route | live since 0.10.000; topology walkthrough in 0.10.003 | WB-014 to WB-016 | [requirements](features/web/requirements.md), [design](features/web/design.md), [validation](features/web/validation.md) |
| Operating envelope | superseded in 0.05.000 by the Response view and the optimizer | OE-01 to OE-07 | [requirements](features/operating-envelope/requirements.md), [design](features/operating-envelope/design.md), [tasks](features/operating-envelope/tasks.md) |
| Visual rebuild | superseded in 0.05.000 by process engine v2, section 12 | VR-01 to VR-11 | [requirements](features/visual-rebuild/requirements.md), [design](features/visual-rebuild/design.md), [tasks](features/visual-rebuild/tasks.md) |

## Beyond the state of the art

None claimed. The product combines established models and does not claim a new algorithm or plant-validated improvement over published work.
