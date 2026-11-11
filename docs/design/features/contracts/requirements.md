# Requirements: OreFlow data contracts

Contract behavior is specific to the OreFlow schemas and producer pipeline. Generic template examples do not define OreFlow's data model.

| ID | Requirement | Gate |
|---|---|---|
| CT-001 | THE pipeline, browser boundary and published artifacts SHALL validate each OreFlow contract against its versioned schema, reject invalid numeric and cross-field values, and retain provenance for derived records. | `tests/contracts/test_documents.py::test_catalogued_documents_validate`; `tests/contracts/test_documents.py::test_readiness_schema_rejects_wrong_product_identity`; `scripts/check_contracts.py` |
