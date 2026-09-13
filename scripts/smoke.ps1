$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = if (Test-Path ".venv/Scripts/python.exe") { ".venv/Scripts/python.exe" } else { "python" }
& $vp data-pipeline/run.py all --output build/smoke
& $vp scripts/check_artifacts.py
& $vp scripts/check_template_residue.py
& $vp scripts/check_content_standards.py
