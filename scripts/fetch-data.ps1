$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$raw = Join-Path (Get-Location) "data\raw"
New-Item -ItemType Directory -Force $raw | Out-Null
$url = "https://rodare.hzdr.de/record/336/files/SM1.Constructed%20cases%20data.xlsx?download=1"
$target = Join-Path $raw "SM1.Constructed_cases_data.xlsx"
Invoke-WebRequest -Uri $url -OutFile $target
$hash = (Get-FileHash $target -Algorithm SHA256).Hash
if ($hash -ne "1559E6C5FABD30988EA0DE60BBDF04A750F7895401FFC31DA974EA4477AA50B0") { throw "Unexpected HZDR workbook SHA256: $hash" }
Write-Host "HZDR workbook verified: $hash"
