#!/usr/bin/env bash
# The local release gate. CI runs only the cheap checks (ADR-0074), so the suites run here before a pull
# request: every guard CI runs, ruff, the Python suite, every framework example (docs/frameworks/*/example.py,
# which fit models and so stay out of CI), and the frontend typecheck, tests and build.
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
# W-02 (review of 2026-10-02): the examples say they check what they print, and one had asserted 72 variants for a
# release after the catalog grew to 96; the PyTorch and ONNX examples need the accelerator environment
case "$VP" in .venv-gpu/*) gpu=1 ;; *) gpu=0 ;; esac
for example in docs/frameworks/*/example.py; do
  node="$(basename "$(dirname "$example")")"
  if [ "$node" = "09_pytest" ]; then step "example $node" "$VP" -m pytest -q -p no:cacheprovider "$example"; continue; fi
  if [ "$gpu" = 0 ] && { [ "$node" = 05_pytorch ] || [ "$node" = 06_onnx ]; }; then echo "[smoke] example $node skipped: no .venv-gpu"; continue; fi
  step "example $node" "$VP" "$example"
done
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
