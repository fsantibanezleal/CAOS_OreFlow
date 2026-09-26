#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv-gpu/Scripts/python.exe"; [ -x "$VP" ] || VP=".venv-gpu/bin/python"; [ -x "$VP" ] || VP=".venv/Scripts/python.exe"; [ -x "$VP" ] || VP=".venv/bin/python"
[ -x "$VP" ] || { echo "No .venv-gpu or .venv environment: run scripts/setup.sh first (never a global interpreter)." >&2; exit 1; }
"$VP" data-pipeline/run.py "$@"
"$VP" data-pipeline/run_particles.py
"$VP" data-pipeline/run_geomet.py --fit-checkpoint
