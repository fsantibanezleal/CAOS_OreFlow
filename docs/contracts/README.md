# Contracts

The operating input declaration is owned by `data-pipeline/pipeline/io/contract.py` and the learned lane by `data-pipeline/pipeline/methods/learning.py`. Their exported document boundaries are the canonical JSON Schemas in `schemas/oreflow-contract-v1.schema.json` and `schemas/oreflow-learning-v1.schema.json`.

The schemas constrain nested declarations, bilingual labels, resolved case inputs and nominal values, controls, model/target scores, training, folds, guard rates, design, summaries and final exports. Case IDs and split IDs remain dynamic; timing, case counts and measured score values are not snapshots in the schemas. Model-specific extensions remain allowed. Optional `observable`, `observable_by_case` and `mlp_seeds.observable_checks` diagnostics have explicit shapes when present, including two-element finite ranges and declared status values. The optional diagnostics do not change numerical scores or make a negative transfer result invalid.

The Python registry in `tests/contracts/contract_schemas.py` and the frontend readers in `frontend/src/contracts/boundaries.ts` validate these same schemas. Both reject non-finite numbers, including those hidden in extension objects. The artifact loaders validate before caching a successful record; a rejection follows the existing load-error/retry behavior. No missing nested fields are defaulted or coerced.

Shape checks complement the independent semantic and parity checks in `scripts/check_artifacts.py` and the pipeline/engine tests. Digest provenance, range relationships, score/diagnostic consistency, cross-record cardinality, physical invariants and model parity still require those checks.

## Generated consumer types

From `frontend/`, install the lockfile with `npm ci`, then run:

```sh
npm run contracts:generate
npm run contracts:check
npm run typecheck
npm test -- src/contracts/boundaries.test.ts src/test/contract.test.ts
```

The equivalent freshness command from the repository root is `node scripts/generate_contract_types.mjs --check`. Main's smoke and CI should invoke that command after dependency installation.

Generation uses exactly pinned `json-schema-to-typescript` 16.0.0 (queried via `npm view json-schema-to-typescript version` on 2026-10-31); runtime JSON Schema 2020-12 validation uses pinned Ajv 8.20.0. Generated files are committed source artifacts under `frontend/src/generated/`, directly re-exported by `frontend/src/engine/contract.ts` and `frontend/src/lib/artifacts.types.ts`. Validator verdicts and other domain types remain locally owned.

Generation resolves paths relative to its script, uses LF output and embeds the normalized schema SHA-256. Repeated generation leaves identical files untouched. `--check` compares complete bytes, fails on absent or stale output, and never rewrites it, including when only a schema constraint changed without altering the TypeScript shape. `--output-dir DIR` and `--schema-dir DIR` support isolated checks without changing canonical files.

From the repository root, run the bounded producer/freshness and catalog checks:

```sh
.venv/Scripts/python.exe -m pytest tests/contracts -q
.venv/Scripts/python.exe scripts/check_documents.py
.venv/Scripts/python.exe scripts/check_contract_versions.py --base HEAD
```

## Version policy

The catalog History records 2.0.0 for these two schemas because tightening nested requirements is a breaking validation change under `check_contract_versions.py`. Public schema identifiers and payload tags remain `oreflow-contract-v1` / `oreflow.contract/v1` and `oreflow-learning-v1` / `oreflow.learning/v1`: valid serialized structures have not changed. The product version remains independent of schema validation versions.

After a deliberate catalog bump, refresh the real lock with `python scripts/check_contract_versions.py --update`, then check `--base HEAD`. The lock is `docs/contracts/versions.lock.json`; a separate `versions.json` or `History.md` is not used by the repository guard.
