# 05 Release and deployment

OreFlow is served from two places built from the same `main` commit: the VPS service, which runs the
Python engine behind the API as well as the site, and a GitHub Pages mirror, which serves the static
site only. Neither ever trains, bakes or rewrites an artifact: a deployment builds and serves the
committed evidence.

| Host | URL | What it serves |
|---|---|---|
| The ML VPS | https://oreflow.ml.fasl-work.com/ | The site, the read-only artifact routes and `POST /api/simulate` |
| GitHub Pages | https://fsantibanezleal.github.io/CAOS_OreFlow/ | The site; the workbench and the content pages need nothing else, since the browser runs its own engine |

## Versions

The root `VERSION` file (format `X.XX.XXX`) is the release version. The bake stamps it on every
artifact, the service reports it at `/healthz`, and the interface reads the same file at build time
for its footer and for the cache key of every artifact request. `CHANGELOG.md` records each release,
and each release is tagged `vX.XX.XXX` on `main`.

## Branches and the local gate

Work goes `task/<slug>` to `develop` to `main` through pull requests; nothing is pushed to `main`
directly. Task branches run no CI (ADR-0074), so the checks run locally before a pull request:
`scripts/smoke.ps1` (or `smoke.sh`) runs every guard CI runs, ruff, the Python suite, and the frontend
typecheck, tests and build. The browser gate (`frontend/gate.mjs`, see [04](04_web-app.md)) runs
against a served build, with `OF_MATRIX=full` before a release, and its screenshots are read. When the
engine or the catalog changed, the bake runs before any of this and its artifacts are committed with
the code that produced them.

## CI

`.github/workflows/ci.yml` runs on a push to `develop` or `main` and on a manual dispatch. One run per
branch is kept (a newer push cancels the older run), and every job stops after 30 minutes.

| Job | What it runs |
|---|---|
| `scientific` | Python 3.12 with `requirements-dev.txt` (pytest, ruff, httpx and the API lane); ruff over `data-pipeline` and `tests`; `check_ci_budget.py` |
| `contracts` | Python 3.12 with nothing installed: the standard-library guards (template residue, content standards, units, interface formulas, diagram languages and colours, the design document, the artifacts) |
| `frontend` | Node 22: `npm ci`, the typecheck, the Vitest suites (the parity of the 72 variants, the contract probes, the trace curves, the worker, the flowsheet, the locale, the surrogate and the claims tests) and the production build |

What CI never does is enforced by `scripts/check_ci_budget.py`: it rejects a workflow that triggers on
pull requests, on a schedule or off the trunks, lacks a concurrency group or a job timeout, installs the
training stack, runs a bake, training or benchmark entry point, or runs the Python suite.

## GitHub Pages

`.github/workflows/deploy-pages.yml` runs on a push to `main` and on a manual dispatch. It builds the
site with `VITE_BASE_PATH=/CAOS_OreFlow/`, checks that `404.html` and the per-route copies of
`index.html` exist (Pages answers a deep link with the app only where a file exists), and publishes
`frontend/dist` with the Pages actions. The router takes the `/CAOS_OreFlow` base on this host only.

## The VPS service

| Item | Value |
|---|---|
| Checkout | `/opt/fasl-apps/CAOS_OreFlow`, branch `main` |
| Process | `oreflow.service` (systemd): `uvicorn app.main:app` on `127.0.0.1:8146` as the system user `fasl`, with `NoNewPrivileges` and `PrivateTmp`, restarted on failure |
| Environment | `APP_ENV=prod`; `PROD_ORIGINS=https://oreflow.ml.fasl-work.com` for CORS; `DATA_DIR` defaults to `data/derived` |
| Front | nginx: port 80 redirects to HTTPS; port 443 terminates TLS for `oreflow.ml.fasl-work.com` with a Let's Encrypt certificate and proxies to the service |
| Runtime | Python with NumPy, FastAPI, uvicorn and pydantic only (`requirements.txt`, `requirements-api.txt`); the engine needs nothing else. Node 22 builds the site on the host |

The service (`app/main.py`) compresses responses, serves the built site with `index.html` for document
routes while keeping real 404 answers for missing assets and API paths, and reports its version at
`/health` and `/healthz`. The API (`app/routers/content.py`):

| Route | Answer |
|---|---|
| `GET /api/cases` | The index (`oreflow.index/v2`) |
| `GET /api/cases/{case_id}` | The case artifact (`oreflow.case/v2`); 404 for an unknown case |
| `GET /api/cases/{case_id}/manifest` | Its manifest (`oreflow.manifest/v2`) |
| `GET /api/contract` | The operating contract, the same file the browser reads |
| `GET /api/benchmark` | The benchmark (`oreflow.benchmark/v2`) |
| `POST /api/simulate` | Body `{case_id, point}`. The point is validated against the contract first: a rejected state answers 422 with `oreflow.rejection/v1`, the contract's codes and messages. An accepted state is solved by the Python engine and answered as `oreflow.live/v2` with lane `live-api`, the contract digest and the full trace. An accepted state that fails to solve answers 500 with `oreflow.engine-error/v1` instead of being hidden |

Artifact reads go through a guard that refuses any path outside the derived folder. The request model
checks only types and sizes; the operating envelope is the contract's, so the API, the Python
validator and the browser reject the same states with the same codes (`tests/test_live_api.py` replays
the contract probes through the API, `frontend/src/test/contract.test.ts` through the browser's
validator).

### Setting up and updating the host

`deploy/setup-vps.sh`, run as root on the host, is idempotent. It installs git, nginx, certbot and the
other packages it needs (the package manager also upgrades any that has a newer version), and Node 22
when the host has an older one; creates the `fasl` user; clones the repository or fast-forwards `main`; creates
the virtual environment and installs the runtime; builds the site; installs the systemd unit and the
HTTP virtual host and enables the service; requests a certificate if none exists; then installs the
explicit TLS virtual host (`deploy/oreflow.nginx.tls`), so on a host serving many sites the request for
this name gets this certificate; and ends by checking `/healthz` and `/api/cases` on the local port.
The script sets a host up; it does not restart a service that is already running, and it may upgrade
packages the host's other sites share. An update therefore takes the script's own steps and no more:
fast-forward `main`, install the runtime requirements, build the site, return the checkout to `fasl`,
restart `oreflow.service`, and check `/healthz` and `/api/cases` on the local port (the releases from
0.04.000 on were deployed so).

## Verifying a release from outside

A release is checked from outside the machine that built it, on the public names, after both hosts
have deployed the same commit:

1. `/healthz` on the VPS reports the new `VERSION`.
2. `/api/cases` lists 12 cases and 72 variants, and `/api/benchmark` answers the benchmark of the same
   version.
3. A representative `POST /api/simulate` answers `oreflow.live/v2` with a trace whose balance closes;
   a state outside the contract answers 422 with its code.
4. On both hosts, the root and a direct request for `/methodology` and `/benchmark`, with and without
   the trailing slash, answer the app with status 200 (Pages first redirects the form without the
   slash, so both forms are probed).
5. The browser gate runs against each public host (`OF_BASE=https://oreflow.ml.fasl-work.com` and
   `OF_BASE=https://fsantibanezleal.github.io/CAOS_OreFlow`), and its screenshots are read.
6. HTTPS is verified with the public host name, not with localhost or the server's default site.

The commit, the workflow runs and the outcome of each check are recorded per release in
[`docs/release-verification.md`](../release-verification.md).

## Rolling back

Restore the previous reviewed `main` commit through a pull request, let Pages redeploy from the push,
take the update steps above on the host, and repeat the checks above.
