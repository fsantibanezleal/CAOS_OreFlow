# 16 Schema validation and generated consumer types

OreFlow's Python producers and browser consumers share the same canonical JSON Schemas in
`docs/contracts/schemas/`. The two most deeply consumed boundaries are the operating contract
and the learned-model evaluation. A top-level object tag does not establish that nested case bounds,
rule messages, target scores or model exports exist. These boundaries therefore constrain the nested
objects and arrays that the application actually reads.

| Tool | Exact dependency | Role |
|---|---|---|
| Ajv | `ajv` 8.20.0, frontend dependency | Validate fetched JSON against the shared 2020-12 schemas before caching a successful result. |
| json-schema-to-typescript | `json-schema-to-typescript` 16.0.0, frontend development dependency | Generate TypeScript consumer declarations from those schemas. It is not part of the prediction engine. |
| jsonschema | `jsonschema` 4.26.0, development requirement | Validate committed producer documents against the same schema registry in local checks and CI. |

## Canonical source and generated output

`scripts/generate_contract_types.mjs` reads the operating-contract and learning schemas, normalizes
line endings, compiles their TypeScript declarations and embeds the schema content hash. Outputs
are committed under `frontend/src/generated/`. Application contract and artifact declarations
import those generated shapes; maintaining a separate handwritten description of these boundaries
would reintroduce the drift the generation step prevents.

From `frontend/`, run `npm ci`, `npm run contracts:generate`, then `npm run contracts:check`.
Generation is idempotent. The check compares complete expected bytes and exits unsuccessfully if
a declaration is missing or stale, including when a schema constraint changes without changing the
apparent TypeScript shape. CI and both local smoke commands run the check after dependency installation.

## Runtime boundary

`frontend/src/contracts/boundaries.ts` compiles the canonical schemas and validates incoming payloads.
The artifact readers invoke that boundary before caching. Missing required fields, incorrectly typed
nested objects and non-finite numeric values produce a load error; the validator does not silently
coerce values or fill missing scientific records. The Python document checks cover committed payloads,
and malformed-record tests exercise rejection on both sides.

The schema validation version in the catalog is distinct from the payload's schema identifier.
Tightening previously unconstrained nested fields is a breaking validation change even when every
currently valid serialized field keeps its name. The catalog history and version lock record that
change; `scripts/check_contract_versions.py` checks their consistency.

## Limits

TypeScript declarations disappear at runtime and cannot validate a response. JSON Schema checks
shape and local constraints; it cannot establish mineral or water conservation, recompute a model's
evaluation, verify a trained file's provenance or prove that two engines agree. The independent artifact
checks, scientific tests, score-observable diagnostics and Python/TypeScript parity checks retain those
responsibilities. A well-typed result can still be scientifically poor, and the reported negative
transfer and screening results remain part of the analysis.

References: [Ajv JSON Schema guide](https://ajv.js.org/json-schema.html),
[json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript),
[Python jsonschema](https://python-jsonschema.readthedocs.io/), and the product's
[contract guide](../contracts/README.md).

## Read in order

1. [Installation](16_contract-tools/01_installation.md): the pinned producer and browser tools.
2. [Usage](16_contract-tools/02_usage.md): generation, fetched-record rejection and an executable mutation example.
3. [Applying it](16_contract-tools/03_applying.md): evolving a boundary without a second handwritten contract.
