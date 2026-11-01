# Use one boundary on both sides

The canonical inputs are `docs/contracts/schemas/oreflow-contract-v1.schema.json` and
`oreflow-learning-v2.schema.json`. Their local references describe nested input bounds, messages,
protocols and target scores. The generator writes the corresponding declarations under
`frontend/src/generated/`, including a source hash. Consumers import those declarations.

`frontend/src/contracts/boundaries.ts` compiles each schema once with `Ajv2020`. Strict mode catches
ambiguous schema constructs; `coerceTypes: false` and `useDefaults: false` preserve the submitted
payload. The readers also reject non-finite numbers before validation. An invalid response raises
a descriptive load error before the artifact cache treats it as successful.

The Python example reads the shipped documents, validates them and then mutates a required nested
number in each copy. It checks that each mutation is rejected without modifying the original data:

```powershell
.venv-gpu\Scripts\python.exe docs\frameworks\16_contract-tools\example.py
```

The example prints the accepted boundaries and rejected JSON paths. Run `npm run contracts:check`
in `frontend/` alongside it. Python validation proves the payload examples satisfy the schema;
generation freshness proves that browser type declarations were produced from those schema bytes.
The frontend boundary tests separately exercise browser rejection.

The learning schema separates scored forecasts from rejected transfers with null metrics and complete diagnostic
context. Its browser reader also recomputes fold counts, conditional statistics, seed order and common-cohort
membership. A schema-valid shape alone cannot establish those arithmetic relationships. Old v1 data is refused;
it is never silently upgraded to v2 or completed with default scores.

Continue with [applying the pattern](03_applying.md).
