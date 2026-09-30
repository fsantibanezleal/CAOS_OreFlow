# 03 Case artifacts (Contract 2)

The bake (`data-pipeline/run.py`, design section 11a) writes one artifact per case, a manifest per
case, an index, the learning record, the benchmark and a validation record. Every file carries the
engine version (the root `VERSION` file) and the digest of the operating contract it was baked
against. The index and the benchmark are built from the records of the same run, never from files
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
- `data/derived/studies.json`: the mechanism ablations and the uncertainty seed study of every case.
- `data/derived/real_samples.json` (`oreflow.real_samples/v1`, [methodology page 15](../methodologies/15_real-samples.md)):
  the pinned tables' checksums, the labels of what is inferred or assumed, the 60 comminution samples' Bond work
  index, the exclusions, and per locked-cycle sample its assays, allocation, work-index assignment, ore, point,
  engine metrics and flags, measured recovery and the GeoMet lane's out-of-fold predictions; the soft porphyry's
  plant once, and a summary.
- `data/derived/source/iron_plant_soft_sensor.json` (`oreflow.iron-plant-soft-sensor/v1`,
  [methodology page 16](../methodologies/16_industrial-soft-sensor.md)): the archive's pin, the hour quality counts,
  the protocol, the pooled scores, and per forward window its boundaries, scores and a down-sampled trace whose hours
  carry their sensor medians and assays.
- `data/derived/benchmark.json` (`oreflow.benchmark/v2`): per-case KPI checks and headline variant
  metrics (recovery, concentrate and head grade, recovered metal, specific energy, mill power, P80,
  process water per tonne, the power-limited state, flags and balance), the published-example oracles recomputed by the engine, kinetic lumping errors, optimizer
  outcomes, uncertainty quantiles with the dominant Sobol input, the learning summary, and pointers
  to the two measured lanes.
- `data/derived/validation.json` (`oreflow.validation/v2`): whether the in-process run of
  `scripts/check_artifacts.py` passed, its errors, the stages and the seconds each took.

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
  the benchmark oracle verdicts, the benchmark's variant metrics equal to the case artifacts' own, and the two
  measured lanes;
- the real-sample record (the pins, the population, the Bond work index recomputed, the allocation, the balances
  and the lane join) and the iron-plant soft sensor (the pin, the population and exclusions, the features, the
  windows, the embargo and the model matrix).
