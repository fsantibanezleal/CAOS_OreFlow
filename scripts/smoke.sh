#!/usr/bin/env bash
# The local release gate. CI runs only the cheap checks (ADR-0074), so the suites run here before a pull
# request: every guard CI runs, ruff, the Python suite, and the frontend typecheck, tests and build.
# --bake adds a sandbox bake into build/smoke, validated by the bake's own last stage; the committed
# data/derived and models/ are never written. It takes as long as a real bake (about forty minutes).
set -euo pipefail
cd "$(dirname "$0")/.."
VP=""
for candidate in .venv-gpu/Scripts/python.exe .venv-gpu/bin/python .venv/Scripts/python.exe .venv/bin/python; do
  if [ -x "$candidate" ]; then VP="$candidate"; break; fi
done
[ -n "$VP" ] || { echo "No .venv-gpu or .venv environment: run scripts/setup.sh first (never a global interpreter)." >&2; exit 1; }

step() { echo "[smoke] $1"; shift; "$@"; }

for guard in check_template_residue check_content_standards check_ci_budget check_units \
             check_ui_formulas check_arch_i18n check_sdd check_artifacts; do
  step "$guard" "$VP" "scripts/$guard.py"
done
step "use-case pages" node --experimental-strip-types scripts/render_use_cases.mjs --check
step ruff "$VP" -m ruff check data-pipeline tests
step pytest "$VP" -m pytest -q
(cd frontend && step typecheck npm run typecheck && step vitest npm run test && step build npm run build)

if [ "${1:-}" = "--bake" ]; then
  sandbox=build/smoke
  rm -rf "$sandbox"
  mkdir -p "$sandbox/derived/source" "$sandbox/models"
  # the measured lanes come from their own pipelines (fetch-data, run_particles, run_geomet); the bake
  # summarizes and validates them, so the sandbox starts from the committed ones
  cp data/derived/source/*.json "$sandbox/derived/source/"
  cp models/particle_mlp.onnx "$sandbox/models/"
  step "sandbox bake" "$VP" data-pipeline/run.py --output "$sandbox/derived" --models "$sandbox/models"
fi
echo "[smoke] passed"
