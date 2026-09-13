$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-gpu" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv" "Scripts\python.exe" }
if (-not (Test-Path $vp)) { $vp = "python" }
& $vp data-pipeline/run.py @args
