$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-gpu" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv" "Scripts\python.exe" }
if (-not (Test-Path $vp)) { $vp = "python" }
& $vp data-pipeline/run.py @args
if ($LASTEXITCODE -ne 0) { throw "Process pipeline failed: $LASTEXITCODE" }
& $vp data-pipeline/run_particles.py
if ($LASTEXITCODE -ne 0) { throw "Particle pipeline failed: $LASTEXITCODE" }
