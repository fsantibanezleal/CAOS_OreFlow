#!/usr/bin/env bash
# Reproducible local environments. .venv is the supported CPU and offline runtime (the bake without training, the
# tests, the service); .venv-gpu is the accelerator environment the learned lane trains in. --no-gpu skips .venv-gpu:
# its torch wheel is the CUDA 12.6 build, a large download published for Linux and Windows only, so macOS skips it
# too. The workbench itself needs only Node (cd frontend && npm ci && npm run dev).
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python}"
mkvenv(){ [ -d "$1" ] || "$PY" -m venv "$1"; }
venvpy(){ local p="$1/bin/python"; [ -x "$p" ] || p="$1/Scripts/python.exe"; echo "$p"; }
mkvenv .venv; VR="$(venvpy .venv)"; "$VR" -m pip install --upgrade pip -q; "$VR" -m pip install -q -r requirements-precompute.txt -r requirements-dev.txt
echo "[setup] .venv ready"
if [ "${1:-}" = "--no-gpu" ]; then echo "[setup] .venv-gpu skipped (--no-gpu)"; exit 0; fi
if [ "$(uname -s)" = "Darwin" ]; then echo "[setup] .venv-gpu skipped: no CUDA torch wheel for macOS"; exit 0; fi
mkvenv .venv-gpu; VG="$(venvpy .venv-gpu)"; "$VG" -m pip install --upgrade pip -q; "$VG" -m pip install -q -r requirements-gpu.txt -r requirements-dev.txt
echo "[setup] .venv-gpu ready"
"$VG" -c "import torch; print('torch', torch.__version__, 'cuda_available', torch.cuda.is_available(), 'cuda', torch.version.cuda)"
