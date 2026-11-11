# Requirements: methods and evidence coverage

The ladder identifiers are internal keys that bind implemented methods to bilingual teaching material and manuscript sections. They do not appear in reader-facing titles or prose.

| ID | Requirement | Gate |
|---|---|---|
| MT-001 | THE SDD SHALL map each implemented method to an acceptance criterion, bilingual notebook coverage and a manuscript section; every proposed method SHALL be tested against the declared comparison and report negative results without overstating novelty. | `scripts/check_notebook_depth.py`; `scripts/check_manuscript_depth.py` |
