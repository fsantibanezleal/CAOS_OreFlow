# Evolve a scientific boundary

Start with the actual producer output and enumerate the fields the consumer reads, including
nested numeric arrays and records. State missing-data behavior in the schema and the catalog.
Use a tagged explicit absence when the domain permits it; never replace an unavailable score with
zero. Keep a small valid example and a malformed example that breaks a load-bearing nested field.

Edit the canonical schema, regenerate declarations and update the validation version and history
in `docs/contracts/catalog.md`. Tightening a formerly unconstrained nested field can break a
consumer even when the serialized payload tag retains its name. The versions lock must reflect
that change. Inspect the complete diff, then run the contract, document, generated-type and
frontend boundary checks through the local smoke workflow.

For a new fetched boundary, add its schema to `scripts/generate_contract_types.mjs` and compile the
same schema in the runtime reader. Export the generated type rather than adding a parallel
handwritten interface. Keep producer and browser fixtures aligned. Shape validation complements
domain checks: mass conservation, dimensional consistency, prediction scale and independent engine
parity still need their own evidence.

The tools do not establish that a model is accurate or useful. A finite, well-typed prediction with
poor held-out performance remains a poor prediction. Preserve that result and the evaluation design.

Return to the [framework overview](../16_contract-tools.md).
