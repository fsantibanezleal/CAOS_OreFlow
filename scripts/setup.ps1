# Reproducible local environments. .venv is the supported CPU and offline runtime (the bake without
# training, the tests, the service); .venv-gpu is the accelerator environment the learned lane trains in.
# -NoGpu skips .venv-gpu: its torch wheel is the CUDA 12.6 build, a large download that only Windows and
# Linux get. The workbench itself needs only Node (cd frontend; npm ci; npm run dev).
param([switch]$NoGpu)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$py = if ($env:PYTHON) { $env:PYTHON } else { "python" }
function Vpy($dir) { $p = Join-Path $dir "Scripts\python.exe"; if (-not (Test-Path $p)) { $p = Join-Path $dir "bin/python" }; return $p }
function Pip($vp, [string[]]$arguments) {
  & $vp -m pip @arguments
  if ($LASTEXITCODE -ne 0) { throw "[setup] pip $($arguments -join ' ') failed ($LASTEXITCODE)" }
}
$dirs = if ($NoGpu) { @(".venv") } else { @(".venv", ".venv-gpu") }
foreach ($dir in $dirs) {
  if (-not (Test-Path $dir)) { & $py -m venv $dir; if ($LASTEXITCODE -ne 0) { throw "[setup] venv $dir failed" } }
  $vp = Vpy $dir
  Pip $vp @("install", "--upgrade", "pip", "-q")
  if ($dir -eq ".venv") { Pip $vp @("install", "-q", "-r", "requirements-precompute.txt", "-r", "requirements-dev.txt") }
  else { Pip $vp @("install", "-q", "-r", "requirements-gpu.txt", "-r", "requirements-dev.txt") }
  Write-Host "[setup] $dir ready"
}
if ($NoGpu) { Write-Host "[setup] .venv-gpu skipped (-NoGpu)"; exit 0 }
Write-Host "[setup] probe:"
& (Vpy ".venv-gpu") -c "import torch; print('torch', torch.__version__, 'cuda_available', torch.cuda.is_available(), 'cuda', torch.version.cuda)"
