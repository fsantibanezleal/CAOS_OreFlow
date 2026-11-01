# Learning job execution requirements

This unit schedules caller-defined scientific work. It does not fit models, change
seeds, interpret observable ranges, or certify a complete learning bake.

| ID | EARS requirement | Verification |
| --- | --- | --- |
| LJ-01 | WHEN jobs are submitted, the executor SHALL reject duplicate or empty IDs and worker counts outside integer 1..4 before starting work. | `tests/test_learning_jobs.py::test_adversarial_invalid_ids_fail_before_cache_creation`, `tests/test_learning_jobs.py::test_worker_count_rejected_before_execution` |
| LJ-02 | WHEN workers exceeds one, the executor SHALL use one spawn process pool and return records in input order regardless of completion order. | `tests/test_learning_jobs.py::test_adversarial_order_progress_and_honest_counts_without_cache` |
| LJ-03 | WHERE checkpoints are enabled, the executor SHALL require a SHA256 configuration fingerprint and resolve every cache destination outside the canonical product before creating files. | `tests/test_learning_jobs.py::test_adversarial_symlink_back_to_repository_rejected`, `tests/test_learning_jobs.py::test_cache_requires_valid_fingerprint` |
| LJ-04 | WHEN a cache record exists, the executor SHALL verify its schema, fingerprint, job ID, canonical result checksum, finite JSON content and caller validation before launching any worker. | `tests/test_learning_jobs.py::test_adversarial_invalid_cache_preflight_never_launches_any_job` |
| LJ-05 | WHEN a cache record is absent, the executor SHALL execute that job and atomically store a validated canonical JSON envelope using a unique temporary file in the external namespace. | `tests/test_learning_jobs.py::test_adversarial_atomic_replace_failure_keeps_no_final_or_temporary_file` |
| LJ-06 | WHEN work fails, the executor SHALL preserve the original exception with job identity, cancel queued jobs, wait for process cleanup and retain valid completed checkpoints. | `tests/test_learning_jobs.py::test_adversarial_spawn_failure_retains_completed_and_running_success_and_cleans_children` |
| LJ-07 | WHEN work completes or resumes, the executor SHALL notify progress in the caller and report planned, resumed and executed counts without claiming unsuccessful work complete. | `tests/test_learning_jobs.py::test_adversarial_new_validator_and_progress_run_in_parent_and_callback_failure_is_fatal` |
| LJ-08 | WHERE checkpoints are disabled, the executor SHALL perform no checkpoint filesystem I/O and SHALL still support serial and spawn execution. | `tests/test_learning_jobs.py::test_adversarial_without_checkpoint_directory_never_uses_checkpoint_io` |

An existing invalid cache is an error, never permission to recompute silently.
Fingerprint identity includes code and scientific configuration; changing payloads
requires a new caller-supplied fingerprint. Old release results are not candidates
for relabelling as newly evaluated work.
