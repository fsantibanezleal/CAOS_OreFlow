param(
  [string]$DataRoot,
  [ValidateSet('all', 'hzdr', 'geomet', 'iron-plant')][string]$Dataset = 'all'
)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$vp = Join-Path '.venv' 'Scripts/python.exe'
if (-not (Test-Path $vp)) { $vp = Join-Path '.venv' 'bin/python' }
if (-not (Test-Path $vp)) { throw 'Run scripts/setup.ps1 first; source acquisition uses the local .venv.' }
$fetchOptions = @('--dataset', $Dataset)
if ($DataRoot) { $fetchOptions += @('--data-root', $DataRoot) }
$ErrorActionPreference = 'Continue'
& $vp data-pipeline/fetch.py @fetchOptions
$fetchExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($fetchExit -ne 0) { throw "Source acquisition failed: $fetchExit" }
