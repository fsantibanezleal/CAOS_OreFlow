# Guide: bring your own data

OreFlow has separate inputs for operating points and measured assays. Use the matching contract;
the process bake does not accept an arbitrary case CSV as a positional argument.

For an operating point, use the workbench controls, live API or Python engine through
[Contract 1](../data-contract/01_operating-contract.md). It validates the selected case's named fields,
units and bounds. Exploring a point does not need a bake.
[Using other data](03_use-on-other-data.md) shows the API and Python paths, including changed ore or plant
definitions and the balance checks needed when those definitions change.

For GeoMet assay inference, prepare an existing CSV with `Cu ppm`, `Fe ppm`, `S ppm`, `Si ppm` and
`Al ppm`. Keep it outside the checkout, for example under `<CAOS_DATA_ROOT>/oreflow/inputs/`.
Export `CAOS_DATA_ROOT` and `CAOS_MODELS_ROOT` to external device roots in the launching shell,
then supply the existing input explicitly:

```powershell
$assays = '<existing assays CSV>'
$predictions = Join-Path $env:CAOS_DATA_ROOT 'oreflow/predictions.csv'
./scripts/predict-geomet.ps1 -InputCsv $assays -OutputCsv $predictions
```

The measured reference files remain pinned under `<CAOS_DATA_ROOT>/oreflow/raw/`; local GeoMet
checkpoints are under `<CAOS_MODELS_ROOT>/oreflow/` (or an explicit external checkpoint file).
The input assays are read without modification. The output carries the model predictions and input
quality flags described in [the GeoMet contract](../data-contract/05_geomet-lane.md).
Local inference may fit a missing checkpoint from the pinned reference source; it does not fit on the
new assay rows. Do not replace a pinned reference file with your own measurements.

The [local-run guide](01_run-locally.md) documents process-environment configuration and explicit
root/source options. `.env` is not automatically loaded. Existing legacy files can remain where they
are: measured runners and the pandas example accept an existing `--source` file read-only, including
an ignored checkout input. Missing explicit files fail; checkout cache/checkpoint destinations are
refused. No move, deletion or migration is required.
