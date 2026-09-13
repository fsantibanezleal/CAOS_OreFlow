# Deployment

OreFlow has two public serving paths. GitHub Actions builds `frontend/dist` from the public repository and publishes the project site at `https://fsantibanezleal.github.io/CAOS_OreFlow/`. The authoritative service is `https://oreflow.ml.fasl-work.com/` on the ML VPS, using the repository's FastAPI app behind nginx and TLS on port 8146.

The VPS procedure is in `deploy/setup-vps.sh`, `deploy/oreflow.service` and `deploy/oreflow.nginx`. It clones the public repository, creates a runtime environment from `requirements-api.txt`, builds the SPA with Node 22, installs the systemd unit, configures nginx and requests a certificate. Deployment checks `/healthz`, `/api/cases`, `/api/benchmark`, the page title and a representative `/api/simulate` request.

The release boundary is deliberate: deployment copies or builds existing evidence and never trains, benchmarks or mutates the canonical artifact tree.
