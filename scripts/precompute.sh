#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv-gpu/Scripts/python.exe"; [ -x "$VP" ] || VP=".venv-gpu/bin/python"; [ -x "$VP" ] || VP=".venv/Scripts/python.exe"; [ -x "$VP" ] || VP=".venv/bin/python"
"$VP" data-pipeline/run.py "$@"
"$VP" data-pipeline/run_particles.py
