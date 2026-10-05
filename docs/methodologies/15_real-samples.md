# 15 Real ore samples in the engine

![The normative mineralogy's bands by the molar sulphur to copper ratio, with the locked-cycle samples in each.](../svg/15-real-samples.svg)

*The normative mineralogy's bands by the molar sulphur to copper ratio, with the locked-cycle samples in each.*

The synthetic cases are authored plants and ores. The real-sample source runs measured ore samples through one of
those plants: the GeoMet samples, on their own assays and work index, in the soft porphyry's circuit
(RS-01 to RS-06; `docs/design/features/real-samples/`).

## Source

The GeoMet dataset (Hoffimann et al. 2022, Mathematical Geosciences 54(7):1227-1253,
doi:10.1007/s11004-022-10013-1; data Zenodo 7051975, CC BY 4.0). Two of its tables, pinned by Zenodo's MD5 and by
SHA-256 (RS-01):

- `comminution.csv`: 60 samples with their Bond ball-mill test values;
- `flotation.csv`: 53 locked-cycle tests with head assays and the measured copper recovery. The one without a
  recovery is excluded, as the GeoMet lane excludes it, so 52 remain.

## The Bond work index

The paper is paywalled, so the columns' meaning is inferred from the Bond test, and labelled so: `A` the closing
screen $P_1$ (106 or 150 um), `M` the net undersize per revolution $G_{bp}$ (g/rev), and `F80` and `P80` in um.
Bond's laboratory form (Bond 1961, in the form stated by Nikolić, Doll and Trumić 2022,
doi:10.1016/j.mineng.2022.107822, UNVERIFIED against the full text) gives kWh per short ton, and the factor
1.10231 converts it to the tonne (RS-02):

$$W_i = 1.10231\,\frac{44.5}{P_1^{0.23}\,G_{bp}^{0.82}\left(\dfrac{10}{\sqrt{P_{80}}} - \dfrac{10}{\sqrt{F_{80}}}\right)}$$

Over the 60 samples this gives 15.2 to 26.1 kWh/t, median 20.2. The soft porphyry's authored ore is 11 kWh/t, so
every sample is harder than the case it runs in.

## The copper minerals

The samples' sulphur cannot cover chalcopyrite: of the 52 locked-cycle samples, one has enough for it. The copper
is therefore allocated by a sulphur-limited normative mineralogy in moles (RS-03), $c$ the copper and $s$ the
sulphur (after Whiten 2007, doi:10.1080/08827500701257860, and Lund et al. 2013, doi:10.1016/j.mineng.2013.04.005,
which describe the least-squares form of the same element-to-mineral conversion):

| Sulphur | Copper minerals |
|---|---|
| $s \ge 2c$ | chalcopyrite $c$; pyrite from the sulphur left |
| $0.8c \le s < 2c$ | chalcopyrite $(5s - 4c)/6$, bornite $(2c - s)/6$ |
| $0.5c \le s < 0.8c$ | bornite $(2s - c)/3$, chalcocite $(4c - 5s)/3$ |
| $s < 0.5c$ | no allocation: the sample is excluded, with the reason |

The thresholds are each mineral's S/Cu from its formula, and each pair is the 2x2 balance of copper and sulphur.
One sample falls in the first band, 15 in the second and 36 in the third. In the median sample bornite carries 56%
of the copper and chalcocite 38%. The iron the sulphides leave goes to magnetite, an assumption, since the assays do
not identify it (3.7 to 75% of the ore); quartz closes the mass. An assay whose iron cannot cover the iron its
sulphides need is excluded with that reason, as one short of sulphur is; none of the 52 pinned samples is (until
0.09.000 the iron was clamped at zero, and an iron-poor assay would have given sulphides holding more iron than it
assays; review of 2026-10-04, L-09). The allocation is one choice in a family, and the record carries the other end of
it in the two sulphur-deficient bands: chalcopyrite with chalcocite, which close the same copper and sulphur without
bornite. The chalcopyrite-pyrite band has no freedom and keeps its allocation, and no allocation in either version
gives pyrite any sulphur in the deficient bands, which have none to spare (until 0.09.000 this page said pyrite could
take part of it; review of 2026-10-04, L-06).

**Bornite and chalcocite** join the mineral table (RS-03b; dossier of 2026-09-30). Their densities are the Handbook
of Mineralogy's (5.07 and 5.8 t/m3), and their element contents follow from the atomic weights. The test's
reference is the Handbook's ideal composition, within 2e-4 because the Handbook used older atomic weights. Their
flotation is authored relative to chalcopyrite, as two declared constants:

- **bornite at 0.80 of chalcopyrite's floatability, an upper bound.** Jiang et al. (2025, Minerals 15:1148,
  doi:10.3390/min15111148; abstract only, the full text was not reachable) report chalcopyrite above 90% recovery
  in every collector system and bornite at 84.2% at best. With first-order kinetics at equal time,
  $\ln(1 - 0.842)/\ln(1 - 0.90) = 0.80$.
- **chalcocite at 1.5 times bornite's.** Tafirenyika et al. (2022, Minerals 12:1527, doi:10.3390/min12121527),
  Table 3, in plant water: at pH 9, $\ln(0.60)/\ln(0.65) = 1.19$; at pH 11, $\ln(0.45)/\ln(0.66) = 1.92$; the
  geometric mean is 1.5. These are mass recoveries of impure samples: 42% bornite with calcite and quartz, and
  62% chalcocite with iron sulphides. The ratio is a choice, not a bound: across the source's conditions it runs
  from 0.67 to 2.5, so its direction is not fixed, and the record runs a grid of both ratios.

Everything else about their flotation (the optimum size, the size widths, the half dose, the unresponsive
fraction) is chalcopyrite's; no source separates them.

## The engine run

Each sample's locked-cycle test takes the work index of the nearest comminution sample in its drill hole (3-D
distance), or else the deposit median (RS-04): 42 of the 52 take one from their hole. The soft porphyry's plant and
nominal operating point then run on the sample's ore, head grade and work index (RS-05). The record keeps, per
sample, the ore and the point the browser repeats (RS-06, within 1e-6), the engine's metrics and flags, the
measured recovery, and the GeoMet lane's out-of-fold predictions for the same sample (page 14 of the Benchmark,
hole folds).

## What the record shows

At the case's 720 t/h every sample leaves the mill at installed power: they are harder than the 11 kWh/t ore the
circuit was sized for, so the product is coarse (P80 208 to 496 um against the 150 um target) and the
engine's recovery falls below the locked-cycle test's. The engine is 22.6 points below the measurement on
average (RMSE 24.1 points; 2.9 to 41.1 points below); the GeoMet lane's data-driven predictions, which never see
the engine, are within 5.1 to 5.5 points RMSE.

That gap is mostly the host circuit's size. The record's sensitivity block re-runs the 52 samples under other
assumptions (review of 2026-10-02, S-01 to S-09); engine minus measured, in points of recovery:

| Run | Mean | RMSE |
|---|---|---|
| the soft porphyry's circuit at 720 t/h (the record) | -22.6 | 24.1 |
| the hard porphyry's circuit at its nominal point | -4.9 | 8.8 |
| the mill sized for a 150 um product | +0.2 | 5.6 |
| each sample at the throughput that gives 150 um (340 to 586 t/h) | +4.0 | 6.7 |

- **The grind the tests were floated at is not in the open data.** With the mill sized for an assumed product, the
  gap runs from +10.0 points at 75 um to -20.8 at 300 um and changes sign between 150 and 160 um. No single
  grind-corrected number is published; the record keeps the curve.
- **Residence.** Of the +4.0 points at each sample's own target-grind throughput, 3.8 come from the longer flotation
  residence at the lower throughput, not from the grind.
- **The engine does not order the samples.** At every assumed grind its recovery is uncorrelated with the measured
  one (Pearson r between 0.03 and 0.06), and it varies by 0.6 to 2.6 points across the samples against the tests'
  5.3. That holds with the declared floatability ratios: with chalcocite at 0.67 of bornite, the low end of its
  range, r is 0.30 to 0.35.
- **The authored choices move the level.** With the mill sized for 150 um, the alternative allocation moves the mean
  by 2.0 points, removing the magnetite by 3.0, the bornite ratio over its range (0.62 to 0.80) by 2.7 and the
  chalcocite ratio over its range (0.67 to 2.5 times bornite) by 4.6. At 720 t/h the same four move it by 2.4, 4.2,
  3.0 and 5.7.
- **The work index.** At 720 t/h a sample's recovery falls by 2.8 points per kWh/t (the median over the samples).
  Taking the deposit median for every sample gives -23.7 points, and the nearest comminution sample anywhere in the
  deposit gives -22.0.

This is a comparison of a simulated plant at an operating point with a laboratory locked-cycle test, and not a
calibration: nothing in the engine is fitted to these samples. In the workbench the operating controls stay live
for a sample, so a lower throughput (a finer grind at the same power) shows how much of the gap is the circuit's
size. The contract's throughput floor for the case, 360 t/h, sits above the lowest throughput at which a sample
reaches the 150 um target (340 t/h), so the workbench cannot show every sample at its target grind.

## In the workbench

The rail's source switch selects a sample (RS-07). Its head grade and work index are fixed, with the reason each is
fixed (RS-08), and validated apart from the synthetic envelope, which the samples' assays lie outside. The circuit,
grinding and separation views react; the response sweeps and the method records belong to the synthetic variants,
and those views say so. The Case view lists what the sample fixes and what the engine still authors, and sets the
engine's recovery beside the measured test and the lane's predictions (RS-09).

## Verification

- `tests/test_real_samples.py` (RS-01 to RS-05): the pins refuse a changed file; the Bond range and one sample by
  hand; the allocation closes the copper and the sulphur of every sample, in its band; the minerals' sources and
  ratios; the work-index assignment; the record's fields.
- `tests/test_engine_core.py::test_stoichiometry_from_atomic_weights` (RS-03b).
- `frontend/src/test/real-samples-parity.test.ts` (RS-06) and `real-samples-claims.test.ts` (RS-07 to RS-09);
  `scripts/check_artifacts.py` recomputes the Bond index and checks the allocation, the balances and the lane join.
- `tests/test_docs_claims.py` holds every number of this page to the record.

## What it is not

A calibration, a deposit model or a plant: one circuit, authored for another ore, runs 52 measured feeds. The
allocation and the magnetite are assumptions, the column mapping is inferred, and the two copper minerals' flotation
is authored from bounded laboratory evidence.
