$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = if (Test-Path ".venv-gpu/Scripts/python.exe") { ".venv-gpu/Scripts/python.exe" } else { "python" }
& $vp -c "import platform, torch; print({'platform':platform.platform(),'torch':torch.__version__,'cuda_available':torch.cuda.is_available(),'cuda_version':torch.version.cuda,'device':torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu-fallback'})"
