# 16 The iron-plant soft sensor

A soft sensor predicts a quantity the plant measures rarely, here the laboratory silica of the flotation
concentrate, from the quantities it measures continuously (Kadlec, Gabrys and Strandt 2009, Computers and Chemical
Engineering 33(4):795-814, doi:10.1016/j.compchemeng.2008.12.012). This lane forecasts one iron-ore plant's
next-hour silica from its sensors, on open data, and stays apart from the copper circuit, from the optimizer and
from any set-point advice (IS-01 to IS-06; `docs/design/features/industrial-soft-sensor/`).

## Data

Kaggle dataset 6294, version 1, "Quality Prediction in a Mining Process" (CC0), the publisher's archive pinned by
SHA-256 (IS-01): 737,453 rows from 2017-03-10 to 2017-09-09, one plant's reverse cationic flotation. The date field
is hourly, while most process channels have about 180 rows per hour (174 to 180). Both concentrate assays, iron and
silica, are laboratory results.

- **Interpolated labels (IS-02).** In 310 nominal hours the silica label changes on almost every 20-second row: it
  was interpolated, not measured. Those hours are excluded whole (55,800 rows), and the 20-second rows are never
  treated as independent laboratory observations.
- **Hours and pairs (IS-03).** The remaining hours become the median of each sensor. Only exact consecutive hours
  with a measured label form a pair: hour $t$'s 21 feed, reagent, pulp and column sensors predict the silica
  measured at $t + 1$. That gives 3,701 pairs. Both concentrate assays, the future target and the date are kept out
  of the predictors.

## Protocol

Three future windows are scored in time order (IS-04), following Bergmeir and Benítez (2012, Information Sciences
191:192-213, doi:10.1016/j.ins.2011.12.028): each trains on an expanding history, leaves at least 24 hours of
embargo, and tests on the next 15, 15 and 20% of the pairs. Median imputation and scaling are fitted inside each
training window, as steps of the model.

$$\hat y_{t+1} = f\left(\tilde x_t\right),\qquad \tilde x_t = \operatorname{median}_{s \in t}\ x_s,\qquad \mathrm{MAE} = \frac{1}{n}\sum_t \left|\hat y_{t+1} - y_{t+1}\right|$$

| Model | Inputs |
|---|---|
| training mean | none |
| previous laboratory assay (persistence) | the hour's own silica assay |
| ridge, random forest, gradient boosting | the 21 sensor medians |
| ridge and gradient boosting with the previous assay | the sensors and the hour's assay |

The persistence and the lab-conditioned models assume the previous hour's assay is already known when the forecast
is made; the data do not establish the laboratory's reporting latency, and the record says so.

## What the record shows

Pooled over the three windows, in percentage points of silica (mean absolute error):

| Model | MAE |
|---|---|
| previous laboratory assay | 0.464 |
| ridge with the previous assay | 0.501 |
| gradient boosting with the previous assay | 0.523 |
| ridge | 0.765 |
| training mean | 0.766 |
| random forest | 0.779 |
| gradient boosting | 0.812 |

The sensor-only models do no better than the training mean: ridge is 0.001 points below it, and the random forest
and gradient boosting are above it. No model beats persistence, and adding the sensors to the previous assay makes
the forecast worse. Under this protocol the hourly sensor medians carry little information about the next hour's
silica that the last assay does not already hold.

A published random forest on the same data reports R² 0.965 (Pural 2023, Physicochemical Problems of Mineral
Processing 59(5):169823, doi:10.37190/ppmp/169823, from its abstract). Its split protocol and its treatment of the
interpolated hours are not in the abstract (UNVERIFIED). A random split of the 20-second rows would put rows of one
hourly label on both sides of it, so the two are cited and not compared. Ramos et al. (2025, IFAC-PapersOnLine
59(32):132-137, doi:10.1016/j.ifacol.2025.12.409) is on the same problem; its data source is UNVERIFIED.

## In the product

The Benchmark's Industrial quality tab shows the traces, the error by window and model, and the windows (IS-05).
The workbench's iron-plant source shows one traced hour: its 21 sensors, its two assays, and every model's forecast
of the next hour beside the measured one. The engine views say that the plant's reverse cationic circuit is not an
engine family, and nothing is simulated (RS-07).

## Verification

- `tests/test_iron_plant.py` (IS-01 to IS-04, IS-06): the pin refuses a changed archive; the interpolated-hour rule
  and the next-hour pairs on synthetic frames; the windows' order and embargo, and the preprocessing inside each
  model; the absence of set-point advice. The tests never refit the lane or read the 184 MB CSV.
- `scripts/check_artifacts.py`: the pin, the population, the exclusions, the features, the windows and the model
  matrix.
- `frontend/src/test/iron-plant-claims.test.ts` (IS-05, IS-06): every number of the tab against the artifact.
- The artifact regenerates from the pinned archive with `data-pipeline/run_iron_plant.py`. The 0.07 run
  reproduced every value of the branch's first artifact, and added the two lab-conditioned models and each traced
  hour's sensors.

## What it is not

One plant, one season and observational data: the scores say how well the next hour is forecast here, not what a
change of any sensor would do, and nothing here recommends a set point. The iron plant's circuit is not an engine
family, so the lane never feeds the copper circuit or the optimizer.
