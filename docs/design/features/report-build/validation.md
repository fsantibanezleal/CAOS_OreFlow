# Technical-report build validation

| Requirement | Adversarial check | Gate |
|---|---|---|
| RB-01 | A placeholder DOI, invalid date, wrong metadata version or repository-resident scratch root cannot start authoring. | `tests/test_build_technical_report.py::test_adversarial_invalid_identity_or_scratch` |
| RB-02 | Spaces in paths remain one argument; a failed first/second pass or missing final output cannot be reported as a build. | `tests/test_build_technical_report.py::test_adversarial_failed_or_partial_compilation` |
| RB-03 | Missing version DOI/header text, layout warnings or partial output leave pre-existing canonical files byte-identical. | `tests/test_build_technical_report.py::test_adversarial_invalid_pdf_preserves_canonical` |
| RB-04 | Source changes during compilation or a missing write flag cannot replace canonical files; receipts bind successful candidates to actual input/output bytes. | `tests/test_build_technical_report.py::test_adversarial_candidate_identity_and_write_boundary` |

Main also builds the actual report using installed Pandoc/XeLaTeX/Poppler, reads every final rendered page and
checks all scientific claims against the completed release artifacts before publication. Fixture tests and a
clean compiler log do not replace that review.
