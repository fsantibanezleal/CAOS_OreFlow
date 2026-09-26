# FastAPI: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../08_fastapi.md](../08_fastapi.md).

## The pins

`requirements-api.txt`:

```text
fastapi==0.116.1
uvicorn[standard]==0.35.0
pydantic==2.11.7
```

With `requirements.txt` (NumPy), that is everything the service and the engine behind it need; the VPS
installs exactly these two files. `uvicorn[standard]` adds the faster event loop and HTTP parser where
the platform supports them. `requirements-dev.txt` includes the API lane and adds pytest, ruff and
httpx, which FastAPI's `TestClient` uses.

## Running the service locally

From the repository root:

```powershell
cd frontend; npm run build; cd ..                     # optional: without a build the root answers a JSON notice
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8146
```

Then `http://127.0.0.1:8146/healthz` answers `{"status": "ok", "service": "oreflow", "version": "0.05.001"}`,
the API is under `/api/`, and the built site is at the root. FastAPI's generated documentation is at
`/docs` and the OpenAPI schema at `/openapi.json`.

## Settings

`app/config.py` reads the environment:

| Variable | Default | Meaning |
|---|---|---|
| `APP_ENV` | `dev` | `dev` allows the dev origins for CORS, anything else the production origins |
| `APP_HOST`, `APP_PORT` | `127.0.0.1`, `8146` | recorded for the deployment; uvicorn's own flags decide the bind |
| `DEV_ORIGINS` | `http://127.0.0.1:5914,http://localhost:5914` | the Vite dev server |
| `PROD_ORIGINS` | `https://oreflow.ml.fasl-work.com` | the public host |
| `DATA_DIR` | `data/derived` | where the committed artifacts are read from, relative to the repository |

The version the service reports is the root `VERSION` file (`app/__init__.py`), the same file the bake
stamps on every artifact and the site's footer shows.
