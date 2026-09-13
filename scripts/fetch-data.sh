#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw
curl -L --fail -o data/raw/SM1.Constructed_cases_data.xlsx 'https://rodare.hzdr.de/record/336/files/SM1.Constructed%20cases%20data.xlsx?download=1'
echo '1559E6C5FABD30988EA0DE60BBDF04A750F7895401FFC31DA974EA4477AA50B0  data/raw/SM1.Constructed_cases_data.xlsx' | sha256sum --check
