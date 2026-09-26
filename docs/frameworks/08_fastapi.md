# 08 FastAPI

FastAPI is the web framework of OreFlow's service, the one process that runs on the VPS. It serves the
built site, the committed artifacts read-only, the operating contract, and a single live route that
validates an operating point against Contract 1 and runs the Python engine. uvicorn is the server that
runs it; pydantic checks the request's types; Starlette, underneath FastAPI, supplies the static files,
compression and CORS middleware. The workbench does not call the service (the browser runs its own
engine), so the site works identically on GitHub Pages, where there is no service at all.

## At a glance

| | |
|---|---|
| Packages | `fastapi`, `uvicorn[standard]`, `pydantic` (Starlette comes with FastAPI) |
| Versions | 0.116.1, 0.35.0, 2.11.7 (Starlette 0.47.3) |
| Licences | MIT, BSD-3-Clause, MIT (Starlette BSD-3-Clause) |
| Declared in | `requirements-api.txt` (with NumPy from `requirements.txt`, all the VPS installs) |
| Lane | The service (VPS) and the API tests |
| Code | `app/main.py`, `app/routers/content.py`, `app/services/content.py`, `app/models/schemas.py`, `app/config.py` |
| Runs as | `uvicorn app.main:app --host 127.0.0.1 --port 8146` under systemd, behind nginx ([architecture 05](../architecture/05_release-and-deployment.md)) |

## Read in order

1. [Installation](08_fastapi/01_installation.md): the pins, running the service locally, the settings.
2. [Usage in OreFlow](08_fastapi/02_usage.md): the app factory, the site fallback, the routes, the live
   simulation and its three answers.
3. [Applying it](08_fastapi/03_applying.md): calling the service from your own code, and serving your own
   engine behind the same kind of contract.
4. [`example.py`](08_fastapi/example.py): drives the service in process: health, catalog, contract,
   an accepted and a rejected simulation, and the live trace against the engine run directly.

Related: [data contract 02](../data-contract/02_trace-and-live-api.md), [01 NumPy](01_numpy.md) (the only
dependency the engine adds), [09 pytest](09_pytest.md) (the API tests).
