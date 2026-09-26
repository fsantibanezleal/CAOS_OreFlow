# FastAPI: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
The runnable companion is [`example.py`](example.py).

## Calling the service from your own code

The public service is `https://oreflow.ml.fasl-work.com`. A simulation is one POST with the case and
only the inputs you change; the rest take the case's nominal values:

```python
import httpx

reply = httpx.post("https://oreflow.ml.fasl-work.com/api/simulate",
                   json={"case_id": "copper_porphyry_soft", "point": {"target_p80_um": 120, "collector_gpt": 30}},
                   timeout=30)
body = reply.json()
if reply.status_code == 200:
    metrics = body["trace"]["metrics"]
    print(metrics["recovery_pct"], body["trace"]["metric_units"]["recovery_pct"])
elif reply.status_code == 422 and body.get("schema") == "oreflow.rejection/v1":
    for error in body["errors"]:
        print(error["code"], error["input"], error["message"])
```

Three things to rely on:

- **Read the schema before the fields.** `oreflow.live/v2`, `oreflow.rejection/v1` and
  `oreflow.engine-error/v1` are the three answers of the route; a 422 without one of those schemas is
  FastAPI's own shape error (your body was not an object with `case_id` and `point`).
- **Units travel with the numbers.** Every metric has its unit in `metric_units`; do not assume a grade
  is a percentage (gold is in g/t).
- **The contract digest identifies the envelope.** A client that caches the contract
  (`GET /api/contract`) can compare its `digest` with the `contract_digest` of each answer and refetch
  when they differ.

To explore rather than integrate, the workbench is faster: it runs the same engine in the browser on
every control change.

## Serving your own engine behind a contract

The pattern is small and carries over to any deterministic model:

1. **Declare the envelope once**, as data: every input's unit, bounds, step and the cross-field rules,
   exported to one file with a digest. Validate against that file on the server and in any client.
2. **Keep the request model to types and sizes.** pydantic checks that the body is an object of at most
   64 entries; the values are the contract's business, so the rejection carries domain codes a user can
   act on (`out_of_range` on `throughput_tph`, reported with both of the case's limits), not a generic
   type error.
3. **Answer with a schema name on every path**, the error paths included.
4. **Never hide a failure of an accepted state.** If the contract accepted it, the model must solve
   it; a 500 with the point is a bug report, and a test (`test_engine_failure_is_reported`) keeps it
   visible.
5. **Serve files by a guarded path**: resolve inside the data folder and refuse anything outside it.
6. **Mount the static site last**, with a fallback to `index.html` only for document paths, so a
   missing asset or a wrong API path is still a 404.

## Traps

- **JSON and non-finite numbers.** Python's `json` accepts `NaN` and `Infinity`, and a client may send
  them; the contract rejects them with `not_finite`. Do not let a model see a NaN because the parser
  was permissive.
- **Heavy imports at module level** slow every worker's start; import the engine inside the route, or
  at startup on purpose.
- **CORS is not access control.** It tells browsers which pages may read the answers; anyone can still
  call the API. The service holds nothing private.
