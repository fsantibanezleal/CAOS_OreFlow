# The local release gate. CI runs only the cheap checks (ADR-0074), so the suites run here before a pull
# request: every guard CI runs, ruff, the Python suite, and the frontend typecheck, tests and build.
# -Bake adds a sandbox bake into build/smoke, validated by the bake's own last stage; the committed
# data/derived and models/ are never written. It takes as long as a real bake (about forty minutes).
param([switch]$Bake)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$vp = Join-Path ".venv-gpu" "Scripts\python.exe"
if (-not (Test-Path $vp)) { $vp = Join-Path ".venv" "Scripts\python.exe" }
if (-not (Test-Path $vp)) { throw "No .venv-gpu or .venv environment: run scripts/setup.ps1 first (never a global interpreter)." }

function Step([string]$Name, [string]$Exe, [string[]]$Arguments) {
  Write-Host "[smoke] $Name"
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "[smoke] $Name failed ($LASTEXITCODE)" }
}

foreach ($guard in @("check_template_residue", "check_content_standards", "check_ci_budget", "check_units",
                     "check_ui_formulas", "check_arch_i18n", "check_sdd", "check_artifacts")) {
  Step $guard $vp @("scripts/$guard.py")
}
Step "use-case pages" "node" @("--experimental-strip-types", "scripts/render_use_cases.mjs", "--check")
Step "ruff" $vp @("-m", "ruff", "check", "data-pipeline", "tests")
Step "pytest" $vp @("-m", "pytest", "-q")
Push-Location frontend
try {
  Step "typecheck" "npm" @("run", "typecheck")
  Step "vitest" "npm" @("run", "test")
  Step "build" "npm" @("run", "build")
} finally { Pop-Location }

if ($Bake) {
  $sandbox = Join-Path "build" "smoke"
  $derived = Join-Path $sandbox "derived"
  $models = Join-Path $sandbox "models"
  if (Test-Path $sandbox) { Remove-Item -Recurse -Force $sandbox }
  New-Item -ItemType Directory -Force (Join-Path $derived "source") | Out-Null
  New-Item -ItemType Directory -Force $models | Out-Null
  # the measured lanes come from their own pipelines (fetch-data, run_particles, run_geomet); the bake
  # summarizes and validates them, so the sandbox starts from the committed ones
  Copy-Item "data/derived/source/*.json" (Join-Path $derived "source")
  Copy-Item "models/particle_mlp.onnx" $models
  Step "sandbox bake" $vp @("data-pipeline/run.py", "--output", $derived, "--models", $models)
}
Write-Host "[smoke] passed"
