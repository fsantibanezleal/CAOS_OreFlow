#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../frontend"
command -v node >/dev/null 2>&1 || { echo 'Install Node.js (frontend/package.json engines) and npm, then rerun scripts/dev.sh.' >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo 'npm is missing; install it with Node.js, then rerun scripts/dev.sh.' >&2; exit 1; }
[ -f package-lock.json ] || { echo 'frontend/package-lock.json is required for a reproducible npm ci install.' >&2; exit 1; }
lock_fingerprint="$(node --input-type=commonjs -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync("package-lock.json")).digest("hex"))')"
lock_stamp='node_modules/.oreflow-package-lock.sha256'
installed_fingerprint=''
if [ -f "$lock_stamp" ]; then installed_fingerprint="$(tr -d '\r\n' < "$lock_stamp")"; fi
if { [ ! -f node_modules/.bin/vite ] && [ ! -f node_modules/.bin/vite.cmd ]; } || [ ! -f node_modules/.package-lock.json ] || [ "$installed_fingerprint" != "$lock_fingerprint" ]; then
  echo 'Installing locked frontend dependencies with npm ci...'
  npm ci --no-audit --no-fund
  printf '%s\n' "$lock_fingerprint" > "$lock_stamp"
fi
# npm predev copies shipped artifacts; no Python, raw data, fitting or rebake.
exec npm run dev -- "$@"
