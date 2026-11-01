# Learning job execution design

Public interface in `pipeline.methods.learning_jobs`:

```python
Job(id: str, payload: object)
run_jobs(jobs, worker, *, workers=1, checkpoint_dir=None,
         fingerprint=None, validate=None, progress=None)
# -> (list[dict], {"workers": int, "attempted": int,
#                  "resumed": int, "executed": int})
```

The caller supplies an importable top-level worker `worker(payload) -> dict`.
Results contain native JSON values only; the caller converts NumPy or tensor
values explicitly. The optional `validate(record)` raises on invalid scientific
records and must not mutate them. Worker and validator exceptions keep their original type and carry a
Python exception note naming the job and phase. Callback failures are also fatal.

All inputs and all existing cache records are checked before any worker starts.
One worker executes serially in the caller. More workers use a single
`ProcessPoolExecutor` with the explicit `spawn` context. Only the worker and
payload cross the process boundary. Validation, cache I/O and
`progress(job_id, completed, total, resumed)` run in the caller. The last argument
is a boolean for that completion; `completed` includes both resumed and fresh
records. Successful output order always matches the input job order.

The external cache layout is
`checkpoint_dir/<fingerprint>/<sha256(UTF8(job.id))>.json`. No raw job ID is used
in a path. `storage.external_path` rejects canonical repository destinations,
including junctions and symlinks resolving back there. Cache envelopes contain
exactly `schema`, `fingerprint`, `job_id`, `result_sha256`, and `result`; the schema
is `oreflow.learning-job/v1`. Result checksums hash sorted-key UTF8 JSON with
compact separators, `ensure_ascii=False` and `allow_nan=False`. Envelopes use the
same canonical encoding. A unique temporary file in that external namespace is
flushed and atomically replaced into the final destination. Existing invalid
files are never deleted, migrated or silently overwritten.

On a failure, queued work is cancelled and running work is allowed to finish;
shutdown waits for every worker process. Successful results from those running
jobs are validated and checkpointed before the original error is raised.
Additional failures are attached as notes, without masking the first error.
Thus failure propagation may wait for a running fit; the API never detaches it.
No success tuple or complete count is returned on failure. Progress can report
valid partial work, including work retained during shutdown.

The caller owns fingerprint construction. Hash a canonical identity containing
the engine/source revision, contract and input data hashes, case/fold/seed and
settings, method implementation, dependency versions, device/backend identity
and every payload-affecting option. The executor cannot infer those semantics.
Resume only on the same code and identity. A changed source, payload, dependency
or device needs a new fingerprint, even when job names are unchanged. This unit
does not decide scientific rejection policies or weaken observable-unit gates.
