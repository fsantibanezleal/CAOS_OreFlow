#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv/Scripts/python.exe"; [ -x "$VP" ] || VP=".venv/bin/python"; [ -x "$VP" ] || VP=python
"$VP" data-pipeline/run.py all --output build/smoke
"$VP" scripts/check_artifacts.py
"$VP" scripts/check_template_residue.py
"$VP" scripts/check_content_standards.py
