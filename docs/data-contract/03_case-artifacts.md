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
| `variants` | six variants, nominal first |

Each variant holds `id`, a bilingual `label`, `change` (the single input it multiplies and the
factor), the full `point`, the `trace` of [02 Trace and live API](02_trace-and-live-api.md), and
`methods`:

- `optimization`: the constrained optimization record ([methodology page 12](../methodologies/12_optimization.md));
- `uncertainty`: the seeded Monte Carlo record ([page 13](../methodologies/13_uncertainty-sensitivity.md));
- `sensitivity`: the Sobol record, on the nominal variant only.

Because the artifact embeds the definition and the point, the browser engine recomputes every
variant from the artifact alone; `frontend/src/test/parity.test.ts` does exactly that for all 72
variants (PE-31).

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
  browser reproduces, PE-39).
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
- coverage (12 cases, 72 variants, nominal first), byte counts and SHA-256 of every artifact, and
  the engine version and contract digest of every record;
- that `cases/` and `manifests/` hold no file the index does not list, since everything there is
  copied into the site (a full bake removes a case the catalog no longer has);
- the balance of every unit of every variant from the stored stream records along the stored
  topology: every mineral, every reported species (from grades and solids) and water, within 1e-9
  relative (PE-02), independently of the engine's own audit;
- the kinetic records (the five models, convergence on every baked variant, lumping error equal to
  projection minus the exact bank), the optimizer records (an optimum is feasible and never violates
  a constraint; an infeasible record has no optimum), the uncertainty records (sample count, quantile
  order, probabilities in [0, 1]), the Sobol record on the nominal variant only;
- the learning record (model classes, twelve leave-one-case-out folds, guard rates, GP coverage,
  ONNX files matching their recorded size and PyTorch parity), the benchmark oracle verdicts, the
  benchmark's variant metrics equal to the case artifacts' own, and the two measured lanes.
