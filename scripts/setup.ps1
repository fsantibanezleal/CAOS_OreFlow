# Reproducible local environments. .venv is the supported CPU/offline runtime;
# .venv-gpu is the optional accelerator environment requested for model baking.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$py = if ($env:PYTHON) { $env:PYTHON } else { "python" }
function Vpy($dir) { $p = Join-Path $dir "Scripts\python.exe"; if (-not (Test-Path $p)) { $p = Join-Path $dir "bin/python" }; return $p }
foreach ($dir in @(".venv", ".venv-gpu")) {
  if (-not (Test-Path $dir)) { & $py -m venv $dir }
  $vp = Vpy $dir
  & $vp -m pip install --upgrade pip -q
  if ($dir -eq ".venv") { & $vp -m pip install -q -r requirements-precompute.txt -r requirements-dev.txt }
  else { & $vp -m pip install -q -r requirements-gpu.txt -r requirements-dev.txt }
  Write-Host "[setup] $dir ready"
}
Write-Host "[setup] probe:"
& (Vpy ".venv-gpu") -c "import torch; print('torch', torch.__version__, 'cuda_available', torch.cuda.is_available(), 'cuda', torch.version.cuda)"
