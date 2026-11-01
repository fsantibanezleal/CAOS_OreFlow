#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv/bin/python"
[ -x "$VP" ] || VP=".venv/Scripts/python.exe"
[ -x "$VP" ] || { echo 'Run scripts/setup.sh first; source acquisition uses the local .venv.' >&2; exit 1; }
"$VP" data-pipeline/fetch.py "$@"
