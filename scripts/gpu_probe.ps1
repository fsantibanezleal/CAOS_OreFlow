$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-gpu" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv" "Scripts\python.exe" }
if (-not (Test-Path $vp)) { throw "No .venv-gpu or .venv environment: run scripts/setup.ps1 first (never a global interpreter)." }
& $vp -c "import platform, torch; print({'platform':platform.platform(),'torch':torch.__version__,'cuda_available':torch.cuda.is_available(),'cuda_version':torch.version.cuda,'device':torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu-fallback'})"
