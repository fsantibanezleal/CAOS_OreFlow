#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
curl -L --fail -o data/raw/SM1.Constructed_cases_data.xlsx 'https://rodare.hzdr.de/record/336/files/SM1.Constructed%20cases%20data.xlsx?download=1'
echo '1559E6C5FABD30988EA0DE60BBDF04A750F7895401FFC31DA974EA4477AA50B0  data/raw/SM1.Constructed_cases_data.xlsx' | sha256sum --check
for name in flotation.csv comminution.csv drillholes.csv; do
  curl -L --fail -o "data/raw/geomet-$name" "https://zenodo.org/api/records/7051975/files/$name/content"
done
echo 'f2e90da6bfa81de1261177ee85a91570  data/raw/geomet-flotation.csv' | md5sum --check
echo '1a33df8ba77f5d49c281ba3fff16b20b  data/raw/geomet-comminution.csv' | md5sum --check
echo 'bf48a6b1135113b6e6cf7b32f95315ad  data/raw/geomet-drillholes.csv' | md5sum --check
