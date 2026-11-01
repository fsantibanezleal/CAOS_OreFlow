# Technical-report build requirements

The report's Markdown and template are the authored sources. A parameterized build must replace repeated manual
Pandoc/XeLaTeX commands while preserving the published files until the candidate build has passed its checks.

| ID | Requirement | Gate |
|---|---|---|
| RB-01 | THE builder SHALL validate a real reserved Zenodo DOI, ISO publication date, release version and an explicitly configured external scratch root before authoring a file. | `tests/test_build_technical_report.py::test_adversarial_invalid_identity_or_scratch` |
| RB-02 | THE builder SHALL pass executable arguments as a list, disable unsupported syntax-highlighting environments and complete two successful XeLaTeX passes. | `tests/test_build_technical_report.py::test_adversarial_failed_or_partial_compilation` |
| RB-03 | THE builder SHALL reject a final PDF with missing identity text or layout warnings and SHALL preserve canonical source/PDF files on every failed build. | `tests/test_build_technical_report.py::test_adversarial_invalid_pdf_preserves_canonical` |
| RB-04 | THE builder SHALL record source hashes, parameters, tool versions, final PDF hashes and page count, and SHALL copy a validated candidate to the canonical report only with an explicit write flag. | `tests/test_build_technical_report.py::test_adversarial_candidate_identity_and_write_boundary` |
