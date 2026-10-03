# 03 Case artifacts (Contract 2)

The bake (`data-pipeline/run.py`, design section 11a) writes one artifact per case, a manifest per
case, an index, the learning record, the studies record, the real-sample record, the benchmark and a validation
record. Every engine record carries the engine version (the root `VERSION` file) and the digest of the operating
contract it was baked against. The three measured lanes write their own records before the bake, each with its own
schema: [04](04_particle-lane.md), [05](05_geomet-lane.md) and [06](06_iron-plant.md). The index and the benchmark are built from the records of the same run, never from files
already on disk, so a partial bake cannot ship as complete.

## Case artifact: `data/derived/cases/<case>.json`

Schema `oreflow.case/v2`.

| Key | Content |
|---|---|
| `engine_version`, `contract_digest` | the release and the Contract 1 document the case was baked against |
| `case_id`, `category`, `family` | identity, the teaching category, the circuit family |
| `title`, `description`, `question` | bilingual texts (`en`, `es`) |
| `provenance`, `notes`, `sources` | the authored-scenario statement and the source note of every parameter group |
| `kpi_ranges` | the literature plausibility range of each checked KPI |
| `definition` | `ore` and `plant`: every input the engine needs, as the dataclasses of `pipeline/engine/model.py` |
| `nominal` | the nominal operating point |
| `variants` | eight variants, nominal first: six of the target mode, then the two of the cut mode (`cut_nominal`, `cut_finer`) |

Each variant holds `id`, a bilingual `label`, `change` (the single input it multiplies and the
factor; the classifier cut's factor applies to the nominal state's solved cut, since its nominal is off), the full `point`, the `trace` of [02 Trace and live API](02_trace-and-live-api.md), and
`methods`:

- `optimization`: the constrained optimization record ([methodology page 12](../methodologies/12_optimization.md)):
  `method` (`gps-progressive-barrier`), `weights`, `screened` (with `unscreened_reason: cut_mode` for the cut-mode
  variants), `screen_bound_pct` and `proposal_columns`; per start the end, evaluations, iterations, `stop` and the
  screen's counts and proposals; `trace`, `without_screen` (the same starts on a fresh cache) and `path` (the
  optimum at 0.75, 0.5 and 0.25);
- `uncertainty`: the seeded Monte Carlo record ([page 13](../methodologies/13_uncertainty-sensitivity.md));
- `sensitivity`: the Sobol record, on the nominal variant only.

Because the artifact embeds the definition and the point, the browser engine recomputes every
variant from the artifact alone; `frontend/src/test/parity.test.ts` does exactly that for all 96
variants (PE-31), and `optimizer-parity.test.ts` re-runs the optimizer (three variants in CI, all 96 at release).

## Manifest: `data/derived/manifests/<case>.json`

Schema `oreflow.manifest/v2`: `case_id`, `category`, `family`, `title`, `engine_version`,
`contract_digest`, `artifact` (`path`, `bytes`, `sha256`, `schema`), `variants` (ids), `nominal` (the
headline metrics) and `kpis` (each checked KPI with its value, range and whether it lies inside).

## Index: `data/derived/manifests/index.json`

Schema `oreflow.index/v2`: `engine_version`, `contract_digest`, `n_cases`, `n_variants` and one
entry per case (`case_id`, `category`, `family`, `title`, `manifest_path`, `artifact_path`,
`variants`), in catalog order.

## Learning record, benchmark and validation

- `data/derived/learning.json` (`oreflow.learning/v1`): the learned lane of
  [methodology page 14](../methodologies/14_learned-lane.md), with the engine version and contract
  digest; the exported models live in `models/process_surrogate.onnx`, `models/process_guard.onnx`
  and `models/process_surrogate.json` (feature order, scalers, guard threshold, and a `reference`
  block with every case's nominal features, predictions and guard error from ONNX Runtime, which the
  browser reproduces, PE-39). The optimizer's screen is `models/process_screen.json` (the two networks' weights,
  the Gaussian process's training rows, hyperparameters, normalization and `alpha`, and a reference block of every
  case's nominal state) with `models/process_gp_cholesky.bin` (the lower Cholesky factor, float64 little-endian,
  packed by rows); the learning record's `final.exports.screen` holds the export checks.
- `data/derived/studies.json` and `data/derived/real_samples.json`: the two sections below.
- `data/derived/source/iron_plant_soft_sensor.json` (`oreflow.iron-plant-soft-sensor/v1`): the iron-plant soft
  sensor's record, [data contract 06](06_iron-plant.md).
- `data/derived/benchmark.json` (`oreflow.benchmark/v2`): per-case KPI checks and headline variant
  metrics (recovery, concentrate and head grade, recovered metal, specific energy, mill power, P80,
  process water per tonne, the power-limited state, flags and balance), the published-example oracles recomputed by the engine, kinetic lumping errors, optimizer
  outcomes, uncertainty quantiles with the dominant Sobol input, the learning summary, and `lanes`, the path and
  schema of the particle and GeoMet lanes' records (the iron-plant record is read on its own). Each variant's optimizer row holds its status, whether the base was feasible, the gain,
  the active constraints, the decisions, the engine evaluations, `screened`, the weight path (`weight`, `status`,
  `recovered_tph`, `energy_kwh_t` per step) and, for a screened search (OP-11), `evaluations_without_screen`,
  `screened_candidates`, `proposed`, `improved`, `surrogate_abs_error_pp` (the mean distance of the surrogate's
  recovery from the engine's where it proposed) and `same_optimum_without_screen`.
- `data/derived/validation.json` (`oreflow.validation/v2`): whether the in-process run of
  `scripts/check_artifacts.py` passed, its errors, the stages and the seconds each took.

## Studies: `data/derived/studies.json`

Schema `oreflow.studies/v1`, with `engine_version` and `contract_digest`: the mechanism ablations (AB-01 to AB-04)
and the uncertainty seed study of `docs/design/features/ablation-and-pages/`, at every case's nominal state.

| Key | Content |
|---|---|
| `switches` | the five counterfactuals in a fixed order (`entrainment`, `composite_classes`, `cleaner_recirculation`, `regrind`, `gravity_bleed`), each with a bilingual `removes`, what turning it off takes out of the model |
| `cases.<case>.ablations.<switch>` | `status`: `not_applicable` when the case has no such mechanism, and then nothing else; or `computed`, with `on` and `off` (recovery, concentrate grade, total specific energy, recovered primary metal), `delta` (off minus on), `detail` (rougher mass pull, cleaner recycle, cleaner residence and cleaner recovery, on and off), the `flags` of the off state and its `balance` |
| `cases.<case>.seed_study` | `seeds` (101 to 808 in steps of 101), `samples` (128 per seed), `design` (Latin hypercube), `generator` (SplitMix64), `per_seed` (each seed's recovery and concentrate-grade quantiles at 5, 50 and 95%, and the probability that every constraint holds) and `spread` (the range of each across the seeds) |

17 of the 60 case-switch pairs are not applicable.

## Real samples: `data/derived/real_samples.json`

Schema `oreflow.real_samples/v1`, with `engine_version` and `contract_digest`: the GeoMet locked-cycle tests in the
soft porphyry's circuit ([methodology page 15](../methodologies/15_real-samples.md); the input fields and refusals
are in [data contract 05](05_geomet-lane.md)).

| Key | Content |
|---|---|
| `case_id` | `copper_porphyry_soft`, the circuit every sample runs in |
| `source` | the record, DOIs, license, and both tables' file, MD5 and SHA-256 |
| `labels` | what is inferred (the Bond columns) or assumed (the allocation, the magnetite, the authored circuit, the comparison) |
| `floatability_ratios` | bornite to chalcopyrite and chalcocite to bornite |
| `plant` | the soft porphyry's plant once, as the engine reads it |
| `comminution[]` | per comminution sample: source row, hole, coordinates, screen, grindability, F80, P80 and the Bond work index |
| `excluded[]` | per excluded row: its table, source row and reason |
| `samples[]` | per locked-cycle test: `id`, `source_row`, `hole`, `xyz`, `assays_pct` (Cu, S, Fe), `measured_recovery_pct`, `allocation` (band, mineral fractions, copper shares, S to Cu molar ratio), `work_index` (value, `how`, source row and distance), `ore`, `point`, the engine's `metrics` and `flags`, `balance_error`, and `geomet_lane` (its fold and the four out-of-fold predictions of [data contract 05](05_geomet-lane.md)) |
| `sensitivity` | the measured spread, and the gap between the engine and the tests under each authored choice: the assumed product size, the throughput that meets the grind target, the host case, the floatability-ratio grid, the alternative allocation, no magnetite and the work-index assignment |
| `summary` | counts, the work-index range, the mineral bands, how the work index was assigned, the engine's and the lane's gaps to the measured recovery, and how many samples are power-limited |

## Validation

`scripts/check_artifacts.py` uses the standard library only, so CI runs it before any install
(ADR-0074). It recomputes instead of trusting:

- the contract digest from the contract file, and that the probe file belongs to it;
- coverage (12 cases, 96 variants, nominal first, the two cut-mode variants last), byte counts and SHA-256 of every artifact, and
  the engine version and contract digest of every record;
- that `cases/` and `manifests/` hold no file the index does not list, since everything there is
  copied into the site (a full bake removes a case the catalog no longer has);
- the balance of every unit of every variant from the stored stream records along the stored
  topology: every mineral, every reported species (from grades and solids) and water, within 1e-9
  relative (PE-02), independently of the engine's own audit;
- the kinetic records (the five models, convergence on every baked variant, lumping error equal to
  projection minus the exact bank), the optimizer records (an optimum is feasible and never violates
  a constraint; an infeasible record has no optimum; the method, the weights, every start's stop, the weight path,
  the screen's counts and proposals, and the evaluations with and without the screen adding up), the uncertainty
  records (sample count, quantile order, probabilities in [0, 1]), the Sobol record on the nominal variant only;
- the learning record (model classes, twelve leave-one-case-out folds, guard rates, GP coverage,
  ONNX files matching their recorded size and PyTorch parity, the screen's export and its Cholesky factor's size),
  the benchmark oracle verdicts, the benchmark's variant metrics and optimizer rows (status, evaluations, the
  screen's counts and the weight path) equal to the case artifacts' own, and its links to the particle and GeoMet
  lanes' records;
- the studies record (the five switches in order, a not-applicable switch with no values, a computed one balanced
  and with its deltas equal to off minus on, and the seed study's seeds, design and spread);
- the particle and GeoMet lanes' records (pins, populations, the model matrix, thresholds, calibration and the
  paired bootstrap);
- the real-sample record (the pins, the population, the Bond work index recomputed, the allocation, the balances
  and the lane join) and the iron-plant soft sensor (the pin, the population and exclusions, the features, the
  windows, the embargo and the model matrix).
