# FastAPI: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The app factory (`app/main.py`)

```python
def create_app() -> FastAPI:
    settings = Settings()
    app = FastAPI(title="OreFlow process intelligence", version=__version__)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(CORSMiddleware, allow_origins=origins(settings) or ["*"], allow_methods=["GET", "POST"], allow_headers=["*"])
    app.include_router(content.router)
    ...
    app.mount("/", SpaStaticFiles(directory=dist, html=True), name="oreflow-spa")
```

- **Compression** matters here: a case artifact is about 400 KB of JSON, and GZip shrinks every
  response over 1 KB.
- **CORS** allows the dev server's origins in development and the public host in production.
- **The site is mounted last**, so every API route and `/health`, `/healthz`, `/docs` match first.
- **`SpaStaticFiles`** is the one subclass OreFlow adds: when the static files answer 404 for a `GET`
  that is neither under `/api/` nor a path with a file extension, it returns `index.html` with status
  200, so a deep link such as `/methodology` or `/focus/copper_porphyry_soft` opens the app. A missing
  asset (`/assets/missing.js`) and a wrong API path still answer 404 instead of a page
  (`tests/test_spa_routes.py`).

## The routes (`app/routers/content.py`)

The read-only routes return the committed documents through `app/services/content.py`, which resolves
every path inside the derived folder and refuses anything outside it; an unknown case answers 404.
`/api/contract` returns the exported Contract 1, the same file the browser validates against, read once
and cached (`lru_cache`).

## The live simulation

```python
@router.post("/simulate")
def simulate(request: SimulationRequest) -> Any:
    document = operating_contract()
    result = validate(document, request.case_id, request.point)
    if not result["accepted"]:
        return JSONResponse(status_code=422, content={"schema": "oreflow.rejection/v1", ...})
    ...
    circuit = run_circuit(case.ore, case.plant, point)
    return {"schema": "oreflow.live/v2", "lane": "live-api", "contract_digest": document["digest"],
            "case_id": request.case_id, "trace": trace(circuit, point, case.plant.family)}
```

Three layers decide what a request gets:

1. **pydantic checks the shape.** `SimulationRequest` has a `case_id` of 1 to 80 characters and a `point`
   that is an object of at most 64 entries. A malformed body (a list for `point`, a missing `case_id`)
   gets FastAPI's own 422 with its validation detail.
2. **The contract checks the values.** `pipeline.io.contract.validate` interprets the exported contract
   exactly as the browser does: a missing input takes the case's nominal value, and every other problem
   is rejected with its code: `unknown_case`, `unknown_input`, `not_applicable` (an input the case's
   family does not use), `not_a_number`, `not_finite`, `not_integer`, `out_of_range`, or a cross-field
   rule such as `deslime_cut_above_half_target`. The answer is `oreflow.rejection/v1` (422) with every
   error, its input and its message. Nothing is coerced: `"720"` is not a number.
3. **The engine solves an accepted state.** The answer is `oreflow.live/v2`: the lane, the contract
   digest, the case and the full trace of that evaluation (metrics with units, topology, streams,
   curves, balances, the kinetic record, flags). If an accepted state fails to solve, the answer is
   `oreflow.engine-error/v1` (500) with the point and the exception, never a silently partial trace.

The engine modules are imported inside the route, so the process starts without importing them and
pays that cost once, at the first simulation.

## Tests (`tests/test_live_api.py`)

- every one of the contract's 719 probe states goes through the API and gets the verdict the probe
  records, with the same codes and a message for each;
- for every case the live trace equals, value for value, the trace of the engine run directly;
- `/api/contract` serves the exported file unchanged;
- malformed bodies are rejected by type;
- an engine failure is reported as `oreflow.engine-error/v1`, not hidden.
