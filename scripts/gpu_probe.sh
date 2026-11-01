#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VP=""
for candidate in .venv-gpu/Scripts/python.exe .venv-gpu/bin/python .venv/Scripts/python.exe .venv/bin/python; do
  if [ -x "$candidate" ]; then VP="$candidate"; break; fi
done
[ -n "$VP" ] || { echo "No .venv-gpu or .venv environment: run scripts/setup.sh first (never a global interpreter)." >&2; exit 1; }
"$VP" -c "import platform, torch; print({'platform':platform.platform(),'torch':torch.__version__,'cuda_available':torch.cuda.is_available(),'cuda_version':torch.version.cuda,'device':torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu-fallback'})"
