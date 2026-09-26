# app/, the OreFlow service

A small FastAPI service that serves the built site, the committed artifacts read-only, the operating
contract, and one live route: `POST /api/simulate`, which validates an operating point against Contract 1
and runs the Python engine on it. It is a thin layer over `data/derived/` and
`data-pipeline/pipeline/engine/`, never a second implementation of either, and it never trains or writes
an artifact.

| File | Role |
|---|---|
| `main.py` | `create_app()`: compression, CORS, the API router, `/health` and `/healthz`, the site from `frontend/dist` with `index.html` for document routes |
| `routers/content.py` | `/api/cases`, `/api/cases/{case_id}`, `/api/cases/{case_id}/manifest`, `/api/contract`, `/api/benchmark`, `POST /api/simulate` |
| `services/content.py` | reads the derived artifacts, refusing any path outside the derived folder |
| `models/schemas.py` | the request model: types and sizes only; the operating envelope is the contract's |
| `config.py` | settings from the environment: `APP_ENV`, `APP_HOST`, `APP_PORT`, `DEV_ORIGINS`, `PROD_ORIGINS`, `DATA_DIR` |

Run it locally from the repository root (build the site first if you want it served too):

```powershell
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8146
```

The routes, their answers and the deployment are in
[docs/architecture/05_release-and-deployment.md](../docs/architecture/05_release-and-deployment.md); the
request and response documents in [docs/data-contract/02_trace-and-live-api.md](../docs/data-contract/02_trace-and-live-api.md);
how the service uses FastAPI in [docs/frameworks/08_fastapi.md](../docs/frameworks/08_fastapi.md). The
tests are `tests/test_live_api.py` and `tests/test_spa_routes.py`.
