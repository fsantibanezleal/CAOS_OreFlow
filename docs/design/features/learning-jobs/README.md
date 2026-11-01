# Checkpointed learning jobs

`pipeline.methods.learning_jobs` provides ordered serial/spawn execution for
caller-defined scientific evaluations. It leaves method, split, seed, scoring,
device and scientific rejection decisions to the caller. Read the
[requirements](requirements.md), [design](design.md) and
[validation evidence](validation.md) for its boundaries.

## Interface

```python
@dataclass(frozen=True)
class Job:
    id: str
    payload: object

def run_jobs(jobs, worker, *, workers=1, checkpoint_dir=None,
             fingerprint=None, validate=None, progress=None):
    # returns (ordered_result_dicts, metadata)
    ...
```

IDs must be unique nonempty strings. `jobs` may be an iterable; its input order
defines output order. `workers` is an integer in 1..4. One runs serially; more
use one explicit spawn process pool per call. Workers must be importable
top-level functions accepting one pickleable payload and returning one dict.
Only native JSON values are accepted, with string object keys, finite numbers
and lists for arrays. Convert NumPy/tensor values inside the worker. No implicit
conversion, seed adjustment or hidden default configuration occurs here.

`validate(result) -> None` runs in the parent for both cached and new records,
and must not mutate its input. `progress(job_id, completed, total, resumed)`
also runs in the parent. `resumed` is a boolean for that job. Completion includes
cached work, not failed work; callbacks can observe partial progress on a run
that ultimately raises. Cached records are all validated before workers start
or any progress callback runs.

The returned metadata has exactly four integer values:

| Key | Meaning |
| --- | --- |
| `workers` | Configured maximum, even if fewer jobs need execution |
| `attempted` | All planned jobs, including cache hits |
| `resumed` | Validated cache hits |
| `executed` | Fresh jobs executed successfully in this completed call |

For a successful call, `attempted == resumed + executed == len(results)`.
An empty job iterable returns empty results and zero job counts without creating
the cache directory. Failure raises instead of returning success metadata.

## External checkpoints and identity

With the external roots configured through `CAOS_DATA_ROOT` and
`CAOS_MODELS_ROOT`, a caller can select
`checkpoint_directory() / "learning-jobs"` under the external model root.
The executor accepts an explicit directory;
it does not read environment variables itself. No checkpoint directory means no
checkpoint I/O, while spawn still works.

Checkpointing requires a 64-hex SHA256 fingerprint. Hex input is normalized to
lowercase. Each record goes to
`<checkpoint_dir>/<fingerprint>/<sha256(job_id.encode('utf-8'))>.json`.
Resolving the directory, namespace and destination must remain outside the
canonical product, including through Windows junctions. Raw IDs never become
path components. Each envelope has the following fields:

```json
{
  "schema": "oreflow.learning-job/v1",
  "fingerprint": "the caller's 64-hex identity",
  "job_id": "fold/case/method/seed",
  "result_sha256": "SHA256 of canonical result bytes",
  "result": {"a scientific record": 1}
}
```

Canonical bytes use UTF8, sorted keys, compact JSON separators,
`ensure_ascii=False` and `allow_nan=False`. Identical records produce identical
checkpoint bytes; the executor adds no timestamps. A checksum proves integrity,
not scientific correctness or authorship. The optional validator supplies the
caller's scientific checks. Missing files execute normally. Malformed JSON,
duplicate keys, nonfinite values, changed identities/checksums and failed
validation are fatal; the executor never silently recomputes a corrupt record.

The caller must fingerprint the **complete identity**, including engine/code
revision, contract/data hashes, cases, fold design, methods, all settings and
seeds, dependencies, device/backend identity and every payload-affecting value.
The executor does not compare or hash payloads automatically. Changing a payload
under an unchanged fingerprint is a caller error. Only resume under the same
code and identity. Use a new namespace after code/configuration changes; do not
relabel old release learning as newly computed candidate work. No existing
checkpoint is migrated or deleted by this API.

## Calling pattern

This illustrative worker deliberately uses no real fitting code. Main owns
production workers, the full fingerprint and CLI integration. Place production
workers in an importable module, guard the application entrypoint for Windows
spawn, and set BLAS thread limits before starting numerical workers.

```python
import hashlib
import json

from pipeline.io.storage import checkpoint_directory
from pipeline.methods.learning_jobs import Job, run_jobs


def evaluate(payload):
    return {"case": payload["case"], "value": payload["value"] ** 2}


def validate_result(result):
    if result["value"] < 0:
        raise ValueError("Invalid squared value")


def run_evaluations(identity, payloads):
    # identity must include all source/data/config/dependency/device information.
    fingerprint = hashlib.sha256(json.dumps(
        identity, sort_keys=True, separators=(",", ":"),
        ensure_ascii=False, allow_nan=False,
    ).encode("utf-8")).hexdigest()
    return run_jobs(
        [Job(payload["job_id"], payload) for payload in payloads],
        evaluate,
        workers=2,
        checkpoint_dir=checkpoint_directory() / "learning-jobs",
        fingerprint=fingerprint,
        validate=validate_result,
        progress=lambda job_id, completed, total, resumed: print(
            job_id, completed, total, "resumed" if resumed else "executed"
        ),
    )


# Invoke run_evaluations from the application's guarded __main__ entrypoint.
```

## Failure and recovery

Errors preserve their original exception type and carry an exception note with
job ID and phase. This includes worker exceptions, serialization, validator,
checkpoint I/O and progress failures. On a pool failure, queued work is cancelled
and running work is allowed to finish. The call waits for pool cleanup, validates
and checkpoints successful concurrent results, then raises the original error.
Additional concurrent failures appear as notes on that error. No worker process
is intentionally left running after the call returns or raises. A slow or hung
worker can therefore delay failure propagation; callers must monitor long work.

Writes use a unique temporary file in the external namespace, flush it and use
`os.replace` for atomic publication. Ordinary write failure removes only this
call's unfinished temporary file. An abrupt host/process termination may leave
an unreferenced temporary file; it cannot be accepted as a completed checkpoint.
Previously published valid checkpoints survive interruptions and can resume on
the next same-identity call. In-memory results are not durable without a cache.

This is a local candidate-work cache, not an authenticated artifact store or a
multi-writer locking service. Give one run ownership of a fingerprint namespace;
publish scientific artifacts only through main's existing validation pipeline.
