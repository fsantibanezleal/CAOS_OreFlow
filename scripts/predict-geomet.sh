#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -lt 2 ]; then echo 'Usage: scripts/predict-geomet.sh INPUT.csv OUTPUT.csv [--source CSV] [--checkpoint FILE] [--data-root ROOT] [--models-root ROOT]' >&2; exit 2; fi
cd "$(dirname "$0")/.."
VP=".venv/bin/python"; [ -x "$VP" ] || VP=".venv/Scripts/python.exe"
[ -x "$VP" ] || { echo 'Run scripts/setup.sh first' >&2; exit 1; }
input_csv="$1"
output_csv="$2"
shift 2
"$VP" data-pipeline/run_geomet.py --predict "$input_csv" --output "$output_csv" "$@"
