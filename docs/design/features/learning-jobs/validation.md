# Learning job validation plan

Use tiny deterministic importable workers, without model fitting, network access
or numerical dependencies. Run from the canonical product with its existing
`.venv`; put pytest temporary files outside the repository, under the configured
external temporary root. Main owns real fit worker
integration, CPU/CUDA equivalence and the full bake.

The regression matrix covers input and fingerprint boundaries; deterministic
ordered serial/spawn results; true spawn identity and process cleanup; no worker
execution on cache hits; complete cache preflight; checksum, schema, identity,
malformed JSON and nonfinite corruption; both cached and new validator failures;
unsafe repository and symlink destinations; atomic write failure; progress and
honest metadata. A delayed two-worker failure preserves completed records while
raising the original failure with job identity.

Required gates:

```powershell
.venv/Scripts/python.exe -m pytest -q tests/test_learning_jobs.py
.venv/Scripts/python.exe -m ruff check data-pipeline/pipeline/methods/learning_jobs.py tests/test_learning_jobs.py
```

Record the actual red/green outcomes and report checker result in the delegated
private report. Passing this matrix proves the execution API, not a scientific
learning result or release readiness.

## Executed evidence (2026-10-31)

| Requirement | Adversarial check | Gate |
|---|---|---|
| LJ-01 | Duplicate and empty job IDs fail before creating a cache. | `tests/test_learning_jobs.py::test_adversarial_invalid_ids_fail_before_cache_creation` |
| LJ-02 | Jobs completing out of order still produce ordered results and honest counts. | `tests/test_learning_jobs.py::test_adversarial_order_progress_and_honest_counts_without_cache` |
| LJ-03 | A real symlink or Windows junction cannot route checkpoints back into the repository. | `tests/test_learning_jobs.py::test_adversarial_symlink_back_to_repository_rejected` |
| LJ-04 | Corrupt or foreign caches fail preflight before any new worker is launched. | `tests/test_learning_jobs.py::test_adversarial_invalid_cache_preflight_never_launches_any_job` |
| LJ-05 | A failed atomic replace leaves neither a partial checkpoint nor a temporary file. | `tests/test_learning_jobs.py::test_adversarial_atomic_replace_failure_keeps_no_final_or_temporary_file` |
| LJ-06 | Spawn failure preserves completed work while cleaning up all worker children. | `tests/test_learning_jobs.py::test_adversarial_spawn_failure_retains_completed_and_running_success_and_cleans_children` |
| LJ-07 | A failing parent callback propagates and cannot become a successful result count. | `tests/test_learning_jobs.py::test_adversarial_new_validator_and_progress_run_in_parent_and_callback_failure_is_fatal` |
| LJ-08 | Disabled checkpointing performs no cache I/O even if those operations would throw. | `tests/test_learning_jobs.py::test_adversarial_without_checkpoint_directory_never_uses_checkpoint_io` |

- Before implementation: the focused pytest command exited 2 during collection
  because `pipeline.methods.learning_jobs` did not exist.
- After implementation: 57 tests passed in 2.38 seconds, exit 0, with no skips.
  Actual two-process spawn, delayed out-of-order completion, failure retention
  and child process cleanup were exercised. The Windows symlink privilege was
  unavailable, so the destination test created a real directory junction and
  verified rejection of its repository target.
- Scoped Ruff over the module and test file passed, exit 0.
- Private report checker passed, exit 0: 3/3 deliverables DONE, zero problems and
  open items.
- The first attempted green run had 40 temporary-directory fixture errors because
  its external base parent did not yet exist; creating that parent resolved
  those setup errors. The subsequent initial suite passed 45 with one symlink
  skip, then the strengthened suite passed all 57 including the junction case.

The final run used the product's existing `.venv`, BLAS thread limits set to 1,
pytest cache disabled, and the unique external base
external temporary root's `learning-jobs/green-3` directory. There was no actual
model training, CLI integration, CPU/CUDA equivalence check or full bake in this
unit. Those are main-owned integration gates.
