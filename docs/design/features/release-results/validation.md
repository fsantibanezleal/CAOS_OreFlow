# Release result validation

| Requirement | Adversarial check | Gate |
| --- | --- | --- |
| RR-01 | Plant a stale engine version or foreign contract digest in each input layer and require refusal. | `tests/test_collect_results.py::test_adversarial_mixed_identity_refused` |
| RR-02 | Duplicate or omit a case, forge byte counts/hashes, add unlisted files and inject a foreign path; require refusal. | `tests/test_collect_results.py::test_adversarial_catalog_corruption_refused` |
| RR-03 | Plant zero in a rejected metric, forge score identity/status or change persisted denominators/summary; require refusal. | `tests/test_collect_results.py::test_adversarial_dishonest_scores_and_cohorts_refused` |
| RR-04 | Reject every case score and refute a non-null matched summary or an omitted hard fold. | `tests/test_collect_results.py::test_adversarial_empty_admissible_set_stays_null_and_keeps_hard_folds` |
| RR-05 | Forge GP coverage, guard rates, seed evaluation identity or seed denominators; require refusal. | `tests/test_collect_results.py::test_adversarial_uncertainty_evidence_refused` |
| RR-06 | Mark an infeasible endpoint optimal or forge exact-call start totals on either side of a pair; require refusal. | `tests/test_collect_results.py::test_adversarial_optimizer_dishonesty_refused` |
| RR-07 | Refute null-to-zero conversion, omitted rejected rows, absent source hashes or an unqualified unmatched ranking. | `tests/test_collect_results.py::test_adversarial_output_cannot_drop_null_rows_or_input_hashes` |
| RR-08 | Direct output into the repository or back into an input file and require refusal with unchanged inputs. | `tests/test_collect_results.py::test_adversarial_cli_refuses_unsafe_output_without_modifying_input` |

Before implementation, author adversarial tests and observe the missing collector
fail. Build tiny v2 examples from the canonical authored schema fixture, with
coherent case manifests, hashes and optimizer records. Expected numerical results
come from explicit small examples, not historical manuscript scores.

Exercise rejected/null preservation, empty cohorts, conditional versus matched
denominators, seed rejection, forged metrics/identities/counts, missing/duplicate/
foreign artifacts, path escapes, nonfinite JSON, infeasible endpoints, measured
positive and negative exact-call differences, deterministic complete Markdown,
input immutability and external/stdout CLI boundaries. Run the actual current v1
learning record through the CLI and require explicit refusal.

```powershell
.venv/Scripts/python.exe -m pytest tests/test_collect_results.py -q
.venv/Scripts/python.exe -m ruff check scripts/collect_results.py tests/test_collect_results.py
.venv/Scripts/python.exe scripts/collect_results.py --derived data/derived
.venv/Scripts/python.exe scripts/check_sdd.py .
```

Use an external pytest temporary root and the existing environment. No fits,
network access or active pipeline edits are needed. Record exact validation
outcomes; the artifact owner independently rechecks and invokes collection on the completed
fresh bake. Tests do not turn fixture output into release results.

## Executed evidence

The red run failed collection with exit 2 because the collector module did not
exist. The final focused run passed **55 tests in 3.11 seconds**, exit 0, with no
skips. Scoped Ruff passed, exit 0. The SDD gate passed, exit 0, with 147 live
requirements and real gates, including all eight requirements in this feature.

The actual canonical v1 CLI check exited 1 and explicitly reported:
`learning.json: requires oreflow.learning/v2; found 'oreflow.learning/v1'; historical scores are not upgraded`.
The v2 CLI fixture export also ran with Python `-S`, proving operation without
site packages. Fixtures covered two-case rejection/empty cohorts and a three-case
grouped-plus-singleton transfer design; no release scores were manufactured.

Validation used the existing environment and an external pytest temporary base,
with cache writing disabled. Final production invocation belongs to the artifact
owner after safe adoption; no live bake inputs or pipeline source were changed.
