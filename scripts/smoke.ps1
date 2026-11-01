# The local release gate. CI runs only the cheap checks (ADR-0074), so the suites run here before a pull
# request: every guard CI runs, ruff, the Python suite, every framework example (docs/frameworks/*/example.py,
# which fit models and so stay out of CI), and the frontend typecheck, tests and build.
# -Bake adds an external sandbox bake under CAOS_TEMP_ROOT, validated by the bake's own last stage; the committed
# data/derived and models/ are never written. It takes as long as a real bake (about an hour and a half on an idle machine since 0.09.000).
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
                     "check_ui_formulas", "check_arch_i18n", "check_sdd", "check_artifacts",
                     "check_notebooks", "check_internal_names", "check_readme_areas", "check_manuscripts",
                     "check_version_coherence", "check_svg_animation", "check_deploy_place", "check_tech_matrix",
                     "check_executive_assets", "check_readiness", "check_documents", "check_base_integrity",
                     "check_doc_paths", "check_web_baseline")) {
  Step $guard $vp @("scripts/$guard.py")
}
Step "contracts" $vp @("scripts/check_contracts.py", "docs/contracts/catalog.md", "--repo-root", ".")
Step "contract versions" $vp @("scripts/check_contract_versions.py", "--base", "origin/develop")
Step "walking skeleton" $vp @("scripts/check_skeleton.py", "docs/contracts/catalog.md")
Step "use-case pages" "node" @("--experimental-strip-types", "scripts/render_use_cases.mjs", "--check")
Step "ruff" $vp @("-m", "ruff", "check", "data-pipeline", "tests", "scripts", "app")
Step "pytest" $vp @("-m", "pytest", "-q")
# W-02 (review of 2026-10-02): the examples say they check what they print, and one had asserted 72 variants for a
# release after the catalog grew to 96; the PyTorch and ONNX examples need the accelerator environment
$gpu = Test-Path (Join-Path ".venv-gpu" "Scripts\python.exe")
foreach ($example in Get-ChildItem "docs/frameworks/*/example.py" | Sort-Object FullName) {
  $node = $example.Directory.Name
  if ($node -eq "09_pytest") { Step "example $node" $vp @("-m", "pytest", "-q", "-p", "no:cacheprovider", $example.FullName); continue }
  if (-not $gpu -and $node -in @("05_pytorch", "06_onnx")) { Write-Host "[smoke] example $node skipped: no .venv-gpu"; continue }
  Step "example $node" $vp @($example.FullName)
}
Push-Location frontend
try {
  Step "contract types" "npm" @("run", "contracts:check")
  Step "typecheck" "npm" @("run", "typecheck")
  Step "vitest" "npm" @("run", "test")
  Step "build" "npm" @("run", "build")
} finally { Pop-Location }

if ($Bake) {
  if (-not $env:CAOS_TEMP_ROOT -or -not [IO.Path]::IsPathRooted($env:CAOS_TEMP_ROOT)) {
    throw "Set CAOS_TEMP_ROOT to an absolute external temporary-data directory before -Bake."
  }
  $sandbox = [IO.Path]::GetFullPath((Join-Path $env:CAOS_TEMP_ROOT "oreflow/smoke"))
  $repoRoot = [IO.Path]::GetFullPath((Get-Location).Path).TrimEnd([IO.Path]::DirectorySeparatorChar)
  if ($sandbox.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "The sandbox must be outside the repository."
  }
  $derived = Join-Path $sandbox "derived"
  $models = Join-Path $sandbox "models"
  New-Item -ItemType Directory -Force (Join-Path $derived "source") | Out-Null
  New-Item -ItemType Directory -Force $models | Out-Null
  # the measured lanes come from their own pipelines (fetch-data, run_particles, run_geomet); the bake
  # summarizes and validates them, so the sandbox starts from the committed ones
  Copy-Item "data/derived/source/*.json" (Join-Path $derived "source")
  Copy-Item "models/particle_mlp.onnx" $models
  Step "sandbox bake" $vp @("data-pipeline/run.py", "--output", $derived, "--models", $models)
}
Write-Host "[smoke] passed"
