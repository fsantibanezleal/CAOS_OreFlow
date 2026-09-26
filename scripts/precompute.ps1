$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-gpu" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv" "Scripts\python.exe" }
if (-not (Test-Path $vp)) { throw "No .venv-gpu or .venv environment: run scripts/setup.ps1 first (never a global interpreter)." }
& $vp data-pipeline/run.py @args
if ($LASTEXITCODE -ne 0) { throw "Process pipeline failed: $LASTEXITCODE" }
& $vp data-pipeline/run_particles.py
if ($LASTEXITCODE -ne 0) { throw "Particle pipeline failed: $LASTEXITCODE" }
& $vp data-pipeline/run_geomet.py --fit-checkpoint
if ($LASTEXITCODE -ne 0) { throw "GeoMet LCT pipeline failed: $LASTEXITCODE" }
