# Install the contract tools

The browser runtime uses `ajv` 8.20.0. Its `Ajv2020` constructor supports the JSON Schema 2020-12
dialect declared by OreFlow's schemas. The generator uses `json-schema-to-typescript` 16.0.0 as a
development dependency. Both exact pins and their integrity hashes are in the frontend lockfile.
From `frontend/`, run `npm ci`; the installed dependency tree must match that lockfile.

Python's `jsonschema` 4.26.0 is pinned in `requirements-dev.txt`. Install it through the repository
setup workflow into the ignored development environment. It is a validation dependency, not a
runtime requirement of the numerical process engine or the minimal VPS service.

Run `npm run contracts:check` in `frontend/` to compare generated output with its schema source.
This command checks existing files; `npm run contracts:generate` writes the two declarations.
After generation, inspect the schema and declaration diffs together. A successful install alone
does not establish that a scientific record satisfies its contract.

Sources: [Ajv dialects](https://ajv.js.org/json-schema.html),
[generator installation and API](https://github.com/bcherny/json-schema-to-typescript),
[Python validator API](https://python-jsonschema.readthedocs.io/en/stable/validate/).

Continue with [usage](02_usage.md).
