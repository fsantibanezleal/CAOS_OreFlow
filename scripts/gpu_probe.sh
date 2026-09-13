#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VP=".venv-gpu/Scripts/python.exe"; [ -x "$VP" ] || VP=".venv-gpu/bin/python"; [ -x "$VP" ] || VP=python
"$VP" -c "import platform, torch; print({'platform':platform.platform(),'torch':torch.__version__,'cuda_available':torch.cuda.is_available(),'cuda_version':torch.version.cuda,'device':torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu-fallback'})"
