#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 2 ]; then echo "Usage: scripts/predict-geomet.sh INPUT.csv OUTPUT.csv" >&2; exit 2; fi
cd "$(dirname "$0")/.."
VP=".venv/bin/python"; [ -x "$VP" ] || VP=".venv/Scripts/python.exe"
"$VP" data-pipeline/run_geomet.py --predict "$1" --output "$2"
