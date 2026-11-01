$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../frontend')
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js (frontend/package.json engines) and npm, then rerun scripts/dev.ps1.' }
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) { $npmCommand = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $npmCommand) { throw 'npm is missing; install it with Node.js, then rerun scripts/dev.ps1.' }
if (-not (Test-Path -LiteralPath 'package-lock.json' -PathType Leaf)) { throw 'frontend/package-lock.json is required for a reproducible npm ci install.' }
$lockFingerprint = (Get-FileHash -LiteralPath 'package-lock.json' -Algorithm SHA256).Hash.ToLowerInvariant()
$lockStamp = 'node_modules/.oreflow-package-lock.sha256'
$installedFingerprint = if (Test-Path -LiteralPath $lockStamp -PathType Leaf) { [System.IO.File]::ReadAllText((Join-Path (Get-Location).Path $lockStamp)).Trim() } else { '' }
$vitePresent = (Test-Path 'node_modules/.bin/vite') -or (Test-Path 'node_modules/.bin/vite.cmd')
if (-not $vitePresent -or -not (Test-Path 'node_modules/.package-lock.json') -or $installedFingerprint -ne $lockFingerprint) {
  Write-Host 'Installing locked frontend dependencies with npm ci...'
  $ErrorActionPreference = 'Continue'
  & $npmCommand ci --no-audit --no-fund
  $installExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($installExit -ne 0) { throw "npm ci failed: $installExit" }
  Set-Content -LiteralPath $lockStamp -Value $lockFingerprint -Encoding ascii
}
# npm predev copies shipped artifacts; no Python, raw data, fitting or rebake.
$ErrorActionPreference = 'Continue'
& $npmCommand run dev -- @args
$devExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($devExit -ne 0) { throw "Vite failed: $devExit" }
