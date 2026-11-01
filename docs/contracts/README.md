# Contracts

The operating input declaration is owned by `data-pipeline/pipeline/io/contract.py` and the learned lane by `data-pipeline/pipeline/methods/learning.py`. Their exported document boundaries are the canonical JSON Schemas in `schemas/oreflow-contract-v1.schema.json` and `schemas/oreflow-learning-v2.schema.json`.

The schemas constrain nested declarations, bilingual labels, resolved case inputs and nominal values, controls, model/target scores, training, folds, guard rates, design, summaries and final exports. Case IDs and split IDs remain dynamic; timing, case counts and measured score values are not snapshots in the schemas. Model-specific extensions remain allowed, with recursive rejection of non-finite numbers.

## Learning payload v2

`learning.json` declares `oreflow.learning/v2`; the active schema and generated TypeScript module are named `oreflow-learning-v2`. A v1 artifact fails this reader. No tag is rewritten and no cached scores are converted into new evidence.

| Score status | Ordinary metrics | Required evidence |
|---|---|---|
| `scored` | Numeric RMSE, MAE and R²; `valid_for_scoring: true` | Evaluation method, target, protocol, fold and seed, and a finite pooled observable diagnostic |
| `rejected-transfer` | Null RMSE, MAE and R²; `valid_for_scoring: false` | The same context and diagnostics, plus `rejection` with code `observable-range`, reason and positive affected-row count |

`observable_by_case` preserves per-case diagnostics when present. `oreflow.observable/v1` also permits `rejected-outside-range` as diagnostic evidence. Rejection may originate in the pooled forecast or an individual case. Scored finite constant forecasts remain explicit negative evidence. Gaussian-process coverage is numeric for scored folds and null for rejected folds; kernel, scale and training metadata remain typed and preserved. Interpolation and the persisted case-mean baseline require scored records.

Each model/target summary carries `loco_folds` and `transfer_folds` with planned `attempted`, `scored` and `rejected` counts. Mean, maximum and median metrics are conditional over scored folds and are null when none are scored. `mlp_seeds.scores` retains every split and target's complete score array in declared seed order, replacing detached observable checks; seed summaries retain null entries and per-seed counts. Optional executor provenance is typed for both the complete record and the seed jobs.

`common_cohorts.leave_one_case_out` and `.transfer` name the exact shared admissible fold IDs, every excluded fold, the attempted count, and each model's metrics on that same shared cohort. An empty cohort has null model metrics. Transfer includes grouped holdouts and singleton ore groups reusing their case holdouts, matching the producer's denominator. Conditional results alone do not establish a model ranking when their admissible sets differ.

The Python registry in `tests/contracts/contract_schemas.py` and the frontend readers in `frontend/src/contracts/boundaries.ts` validate these same schemas. Both reject non-finite numbers, including those hidden in extension objects. The frontend also checks count reconciliation against every planned fold, seed order, summary nullability, and matched/excluded IDs against actual admissible folds. JSON Schema alone cannot express cross-field arithmetic or cross-record fold identity. The artifact loaders validate before caching a successful record; an invalid record follows the existing load-error/retry behavior. A valid rejected fold is retained within the record. No missing nested fields are defaulted or coerced.

Shape checks complement the independent semantic and parity checks in `scripts/check_artifacts.py` and the pipeline/engine tests. Digest provenance, range relationships, score/diagnostic consistency, cross-record cardinality, physical invariants and model parity still require those checks.

## Generated consumer types

From `frontend/`, install the lockfile with `npm ci`, then run:

```sh
npm run contracts:generate
npm run contracts:check
npm run typecheck
npm test -- src/contracts/boundaries.test.ts src/contracts/learning-v2.test.tsx src/test/contract.test.ts
```

The equivalent freshness command from the repository root is `node scripts/generate_contract_types.mjs --check`. Main's smoke and CI should invoke that command after dependency installation.

Generation uses exactly pinned `json-schema-to-typescript` 16.0.0; runtime JSON Schema 2020-12 validation uses pinned Ajv 8.20.0. Generated files are committed source artifacts under `frontend/src/generated/`, directly re-exported by `frontend/src/engine/contract.ts` and `frontend/src/lib/artifacts.types.ts`. Validator verdicts and other domain types remain locally owned.

Generation resolves paths relative to its script, uses LF output and embeds the normalized schema SHA-256. Repeated generation leaves identical files untouched. `--check` compares complete bytes, fails on absent or stale output, and never rewrites it, including when only a schema constraint changed without altering the TypeScript shape. `--output-dir DIR` and `--schema-dir DIR` support isolated checks without changing canonical files.

From the repository root, run the bounded producer/freshness and catalog checks:

```sh
.venv/Scripts/python.exe -m pytest tests/contracts -q
.venv/Scripts/python.exe scripts/check_documents.py
.venv/Scripts/python.exe scripts/check_contract_versions.py --base HEAD
```

`tests/contracts/fixtures/learning-v2.json` is an authored contract fixture, never a source of production results. It exercises v2 independently of a fresh bake. The real-document checks still require the actual producer's v2 artifact; until it exists, the explicitly named real-v2 frontend test is pending, and the document gate correctly rejects the older production record. This is an integration boundary, not a validation waiver.

## Version policy

The catalog History records 2.0.0 for these two boundaries. The operating schema keeps `oreflow-contract-v1` / `oreflow.contract/v1`; its nested validation was tightened without changing valid serialized structures. The learned boundary consolidates the unreleased validation and payload changes under catalog 2.0.0 and explicitly changes its schema identifier to `oreflow-learning-v2` and payload tag to `oreflow.learning/v2`. The old learning schema and generated module are retired. The product version remains independent of contract versions.

After a deliberate catalog bump, refresh the real lock with `python scripts/check_contract_versions.py --update`, then check `--base HEAD`. The lock is `docs/contracts/versions.lock.json`; a separate `versions.json` or `History.md` is not used by the repository guard.
