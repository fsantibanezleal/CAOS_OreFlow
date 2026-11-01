# Data and model attribution

OreFlow's authored simulator code, case definitions and simulator-trained models are released under MIT.
The measured sources and models trained from them retain the terms listed in [LICENSES.md](LICENSES.md).
Source metadata and checksums are preserved in the compact records; preprocessing and fitted models are adaptations.

## Particle mineralogy

Lucas Pereira, Max Frenzel, Mahdi Khodadadzadeh, Raimon Tolosana Delgado and Jens Gutzmer (2020),
*Particle dataset for constructing mineral processing case studies*, RODARE record 336,
[DOI 10.14278/rodare.336](https://doi.org/10.14278/rodare.336),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

OreFlow summarizes the workbook's training and test sheets, fits a particle-label classifier and exports
its compact model and evaluation. Published separation probabilities are constructed reference values;
they are not observed plant recoveries. The summary, evaluation, ONNX classifier and figures derived
from this dataset retain attribution and CC BY 4.0. OreFlow changes the representation and fits its own model;
the source authors do not endorse this application.

## GeoMet

Júlio Hoffimann, José Augusto, Lucas Resende, Marlon Mathias, Douglas Mazzinghy, Matheus Bianchetti,
Mônica Mendes, Thiago Souza, Vitor Andrade, Tarcísio Domingues, Wesley Silva, Ruberlan Silva,
Danielly Couto, Elisabeth Fonseca and Keila Gonçalves, *GeoMet dataset*, version 4,
[Zenodo record 7051975](https://doi.org/10.5281/zenodo.7051975),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

OreFlow selects complete locked-cycle recovery records, converts fractional recovery to percent,
evaluates assay-based models with grouped splits and uses samples in an explicitly authored circuit comparison.
The extracted observations, derived records, fitted GeoMet checkpoint and figures based on them retain
CC BY 4.0. The simulator's results are not GeoMet measurements. The associated research is
[Hoffimann et al., Mathematical Geosciences](https://doi.org/10.1007/s11004-022-10013-1).

## Iron-flotation measurements

Eduardo Magalhães de Oliveira, *Quality Prediction in a Mining Process*, Kaggle dataset 6294, version 1,
[source record](https://www.kaggle.com/datasets/edumagalhaes/quality-prediction-in-a-mining-process),
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

OreFlow aggregates observations into hourly records, separates chronological training and test periods,
and reports forecast comparisons and blocked uncertainty estimates. These transformations do not establish
intervention effects or plant set-point recommendations. Attribution is retained for provenance even though
the source is dedicated to the public domain.

## Publications

The [technical report](https://doi.org/10.5281/zenodo.23783845) and
[screening article](https://doi.org/10.5281/zenodo.23833134) are distributed under CC BY 4.0.
Their licence does not replace the software or third-party data licences.
