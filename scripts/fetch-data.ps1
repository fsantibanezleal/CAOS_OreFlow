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
$files = @{
  "flotation.csv" = "F2E90DA6BFA81DE1261177EE85A91570"
  "comminution.csv" = "1A33DF8BA77F5D49C281BA3FFF16B20B"
  "drillholes.csv" = "BF48A6B1135113B6E6CF7B32F95315AD"
}
foreach ($name in $files.Keys) {
  $destination = Join-Path $raw "geomet-$name"
  Invoke-WebRequest -Uri "https://zenodo.org/api/records/7051975/files/$name/content" -OutFile $destination
  $actual = (Get-FileHash $destination -Algorithm MD5).Hash
  if ($actual -ne $files[$name]) { throw "Unexpected GeoMet checksum for ${name}: $actual" }
  Write-Host "GeoMet $name verified: $actual"
}
