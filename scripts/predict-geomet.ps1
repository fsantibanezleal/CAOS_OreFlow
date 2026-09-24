param(
  [Parameter(Mandatory=$true)][string]$InputCsv,
  [Parameter(Mandatory=$true)][string]$OutputCsv
)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv" "Scripts\python.exe"
if (-not (Test-Path $vp)) { throw "Run scripts/setup.ps1 first" }
& $vp data-pipeline/run_geomet.py --predict $InputCsv --output $OutputCsv
if ($LASTEXITCODE -ne 0) { throw "GeoMet prediction failed: $LASTEXITCODE" }
