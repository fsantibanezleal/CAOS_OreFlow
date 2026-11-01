param(
  [Parameter(Mandatory=$true)][string]$InputCsv,
  [Parameter(Mandatory=$true)][string]$OutputCsv,
  [string]$Source,
  [string]$Checkpoint,
  [string]$DataRoot,
  [string]$ModelsRoot
)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$vp = Join-Path '.venv' 'Scripts/python.exe'
if (-not (Test-Path $vp)) { $vp = Join-Path '.venv' 'bin/python' }
if (-not (Test-Path $vp)) { throw 'Run scripts/setup.ps1 first' }
$predictOptions = @('--predict', $InputCsv, '--output', $OutputCsv)
foreach ($pair in @(@('--source', $Source), @('--checkpoint', $Checkpoint), @('--data-root', $DataRoot), @('--models-root', $ModelsRoot))) {
  if ($pair[1]) { $predictOptions += $pair }
}
$ErrorActionPreference = 'Continue'
& $vp data-pipeline/run_geomet.py @predictOptions
$predictExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($predictExit -ne 0) { throw "GeoMet prediction failed: $predictExit" }
