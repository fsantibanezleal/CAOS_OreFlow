#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-python}"
mkvenv(){ [ -d "$1" ] || "$PY" -m venv "$1"; }
venvpy(){ local p="$1/bin/python"; [ -x "$p" ] || p="$1/Scripts/python.exe"; echo "$p"; }
mkvenv .venv; VR="$(venvpy .venv)"; "$VR" -m pip install --upgrade pip -q; "$VR" -m pip install -q -r requirements-precompute.txt -r requirements-dev.txt
mkvenv .venv-gpu; VG="$(venvpy .venv-gpu)"; "$VG" -m pip install --upgrade pip -q; "$VG" -m pip install -q -r requirements-gpu.txt -r requirements-dev.txt
"$VG" -c "import torch; print('torch', torch.__version__, 'cuda_available', torch.cuda.is_available(), 'cuda', torch.version.cuda)"
