# Derived artifacts

This directory contains the committed, reproducible evidence used by the public workbench. The canonical bake writes case traces, manifests, the feature matrix, the benchmark summary and the validation certificate here.

The HZDR workbook is intentionally not committed because it is a large raw input. `data/derived/source/hzdr_summary.json` records its DOI, license, SHA256 and processed row counts. Recreate the raw input with `scripts/fetch-data.ps1`, then run `scripts/precompute.ps1`.

Every artifact is derived from the declared simulator and seeded design matrix. It is not a claim of plant-scale performance or transfer across mines.
