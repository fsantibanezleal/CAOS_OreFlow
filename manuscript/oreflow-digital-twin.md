# How far does a learned surrogate of a flowsheet simulator transfer across ores? A closed-circuit, size-by-mineral engine and a leave-one-case-out test

Felipe Santibáñez-Leal (ORCID 0000-0002-0150-3246), CAOS open-research programme, Santiago, Chile

Draft of 2026-09-30, written against OreFlow 0.07.000. Not deposited; no DOI. Every number below is read
from the records committed with that version (`data/derived/learning.json`, `data/derived/benchmark.json`,
`data/derived/source/*.json`, the twelve case artifacts), and `tests/test_manuscript_claims.py` fails if a
number here and the records disagree.

## Abstract

Learned surrogates of process simulators are increasingly proposed as the fast core of mineral-processing
digital twins, and they are usually scored by interpolation: random held-out states of the plants they were
trained on. We ask how far such surrogates transfer to an ore and plant they have not seen. As the teacher we
use an open steady-state flowsheet engine that carries every stream as the mass flow of every mineral in 63
size classes plus water, solves closed grinding circuits with an energy-specific population balance and
Plitt hydrocyclones, separates by flotation banks, gravity, magnetic drums or desliming, and closes the
balance of every unit within 1e-9. The engine is checked against four published examples and is reproduced
by an independent browser implementation within 1e-6 on all 96 committed states. On a 3072-state design over
twelve authored plants, five surrogates (ridge, random forest, histogram gradient boosting, a Gaussian
process and a multilayer perceptron) are scored by interpolation inside the cases and by leave one case out.
The protocols rank the models differently: the perceptron interpolates recovery best (RMSE 3.70 points) and
transfers worst by mean error (65.4 points on average over the held-out plants at one training seed, 27.0 to
65.4 over five), though its median held-out R² (0.660) is close to gradient boosting's (0.668). The transfer
failure is concentrated: held-out copper sulphide plants cost the perceptron 1.7 to 3.1 points, while the two
plants whose circuits differ most from the rest cost 209 and 500 points. Specific energy transfers (median
held-out R² 0.927 to 0.969 for the four non-linear models); the concentrate upgrade transfers among the copper
sulphide plants and fails on the others. An autoencoder guard flags 2.3% of in-envelope states and accepts
17.7% of states pushed half a training range outside the envelope, 45% of those pushed a tenth of it; most of
its accepts are shifts of three weakly coupled inputs. The results bound transfer between authored plants, not
to real ones.

## 1. Introduction

A surrogate of a flowsheet simulator is attractive for the same reason as any surrogate: the simulator is
slow and the surrogate is fast, so it can sit inside an optimizer, a sweep or an interactive tool. Whether it
can stand in for the simulator depends on the question it is asked. Inside the envelope it was trained on, an
interpolation score answers that question. A digital twin is asked something harder: what happens with a
different ore, a harder or finer feed, another plant. That is transfer, and an interpolation score says
nothing about it.

This work measures both on the same models, with a simulator whose answers are known exactly and can be
reproduced. Its contributions are three:

1. an open flowsheet engine that represents streams by size and mineral, solves closed circuits, audits
   every balance from its output streams, and is verified against published examples and against an
   independent second implementation;
2. a test protocol that scores learned surrogates of it by interpolation and by leave one case out over
   twelve authored plants in four circuit families, with interval coverage and an out-of-envelope guard;
3. the finding that transfer failure is concentrated in the plants unlike the others, that the ranking of
   models changes between the protocols and with the statistic that summarizes transfer, and that the guard
   misses shifts of inputs its training features do not correlate with.

## 2. The engine

### 2.1 Representation

Every stream holds, for each mineral, a vector of mass flows (t/h) over one grid of 63 size classes on a
fourth-root-of-two progression from 150 mm to a pan below 3.24 µm, and a water flow. Assays are computed from
mineral masses and the minerals' element contents (from their formulas and the IUPAC atomic weights); no grade
is stored, so a grade changes only when a mass does. Liberation is described per valuable mineral by size
(King 1979): a liberated fraction, and composites whose content and host are declared.

### 2.2 Comminution

The crusher is the Whiten form (Duarte et al. 2021), with a strictly lower-triangular breakage matrix `B` and
a classification function `C` set by the closed-side setting:

```text
p = (I - C)(I - B C)^-1 f
```

The ball mill is an energy-specific population balance (Herbst and Fuerstenau 1980) in the form of the
Moly-Cop tools: three perfect mixers of volume fractions 0.70, 0.15 and 0.15 share the breakage operator
`D = (I - B) diag(S^E)`, so the mill's inverse transfer at an energy per pass `e` is a cubic polynomial in `D`,
and the closed circuit with the cyclone returning a fraction `C_i` of each class solves

```text
(T^-1(e) - diag(C)) p = f,        T^-1(e) = I + c1 e D + c2 e^2 D^2 + c3 e^3 D^3
```

per mineral. Two scalar unknowns, the energy per pass that meets the target P80 and the host cut that holds the
design circulating load, are found by the Illinois method; when the required power exceeds the installed
power, the circuit runs at installed power with a coarser product and says so. Specific energy is reported by
the Bond law, `E = 10 W_i (P^-1/2 - F^-1/2)`, with Rittinger and Kick calibrated to agree with it at a
reference reduction (Bond 1952; GMG 2021).

### 2.3 Classification and separation

Hydrocyclones follow Plitt (1976): a Rosin-Rammler partition `y(d) = R_f + (1 - R_f)(1 - exp(-ln 2 (d/d50c)^m))`
with a water bypass `R_f` from the water balance and a cut corrected for each mineral's density, so dense
minerals classify as coarser particles and circulate. Plitt's sizing of the cyclone cluster is uncalibrated and
fails its published check (section 3), so the cluster's count and pressure are reported as an estimate, never as
a result. Flotation banks are perfect mixers in series; the rate constant of each particle class follows from the
bubble surface area flux `S_b = 6 J_g / D_32` (Gorain et al. 1997, 1999) and a size window (Trahar 1981),
entrainment follows Savassi et al. (1998), and cleaner and recleaner tails return to the preceding bank:

```text
r = (k tau + ENT w) / (1 + k tau + ENT w),        R_N = 1 - (1 - r)^N
```

Gold follows the gravity-recoverable gold (GRG) model of Laplante, Woodcock and Noaparast as Vincent (1997)
states it: the gold is a GRG component with its own size distribution, from a GRG test, plus a non-GRG
component; the GRG's cyclone cut takes a density correction with an exponent of 1.0, fitted to measured GRG
partitions where Stokes would give 0.5; the gravity unit on a bleed of the cyclone underflow, or of the mill
discharge, recovers GRG by size at a per-pass recovery `R(d) = R_max (1 - exp(-(d/x_g)^2))`; and grinding moves
GRG to non-GRG at a slowed breakage rate (Banisi et al.). Low-intensity magnetic drums capture liberated
magnetite and composites by their magnetite content; desliming cyclones discard slimes ahead of flotation.

### 2.4 The audit and the contract

An independent audit recomputes, from the output streams alone, the closure of every mineral, every species
and the water at every unit and for the circuit. The operating point is thirteen inputs declared once, with units,
per-case bounds, steps, the families they apply to, a cross-field rule and bilingual messages; the exported
declaration is interpreted identically by the engine's validator, the web service and the browser, so a state
is accepted or rejected with the same code everywhere.

## 3. Verification

**Balances.** All 96 committed states close within 1e-9 relative at every unit and for the circuit, as
recomputed from the stored streams by the artifact checks.

**The second implementation.** A line-by-line TypeScript port runs the engine in the browser. Re-simulating
every committed state from its own definition, it matches every metric, stream record, curve and kinetic
record within 1e-6 relative, with the same flags.

**Published examples.** Each is labelled as a published example, not as plant data:

| Example | Published | Engine |
|---|---|---|
| Moly-Cop BallSim base case (504 t/h, every published input) | net 7.71 kWh/t, gross 8.56; cut 183.3 µm; 6 cyclones at 53 kPa | net 7.30 kWh/t, 5.2% below, inside the 20% tolerance set before the first run; cut 188 µm; Plitt's uncalibrated sizing asks for 2 cyclones at 816 kPa |
| GMG worked examples of the operating work index | 14.4 and 11.7 kWh/t | 14.38 and 11.71 kWh/t |
| Laplante and Staunton gravity example, run like for like (80.4% GRG, the unit on 10 to 60% of the mill discharge) | GRG recovery 79.8 to 95.9%, GRG circulating load 2016 to 413% | GRG recovery 69.5 to 90.7%, GRG circulating load 696 to 84%: outside the 5-point and 35% tolerances |
| Zandrivierspoort magnetite (a different ore; the 45 µm product is a regrind) | 64.9 and 69.0% Fe at 75 and 45 µm | 63.8 and 67.8% Fe: a step of 4.0 points against 4.1, at levels 1.1 and 1.2 points below |

The gravity example misses because the measured GRG of the case's ore (Snip) is very fine: 9 to 31% of the GRG,
almost all finer than about 37 µm, leaves by the overflow; without the GRG finer than 25 µm the GRG recovery comes
within 1.1 points from the 20% row on, and the circulating load stays 50 to 69% low. The magnetite example checks a
direction and a proportion, not a level, because its ore is not the engine's case.

## 4. The test

### 4.1 The plants

Twelve authored cases in four circuit families: nine copper, nickel, zinc and refractory-gold rougher-cleaner
flotation circuits (`rougher`), free-milling gold with a gravity bleed (`gravity_rougher`), fine magnetite with
magnetic drums instead of flotation (`magnetic`), and phosphate with desliming ahead of flotation
(`deslime_rougher`). Every parameter carries its unit and either a source or the label authored; none is fitted
to a plant.

### 4.2 The design, the features and the targets

For each case a scrambled Sobol sequence draws 256 states the contract accepts over the case's whole
envelope and two ore factors (liberation size and floatability within their uncertainty half-widths), 3072 in
all; the engine simulates every state. Each state is described by 22 physical features computed before
simulation: the payable fraction, throughput per installed megawatt, the grind, circulating load, water, crusher
setting and work index, the payable carriers' share-weighted liberation size, composite content, density,
floatability and dose ratio, the rougher gas velocity, cells and volume per t/h, the gravity bleed, the desliming
cut and four circuit descriptors. The case identity is never a feature. The targets are recovery (%), the
log10 upgrade ratio (concentrate over head grade) and the total specific energy (kWh/t).

### 4.3 The models and the protocols

Ridge (alpha 1); a random forest (300 trees; Breiman 2001); histogram gradient boosting (300 iterations;
Friedman 2001); a Gaussian process with a squared-exponential kernel with one length scale per feature and a
noise term, on a seeded subsample of 500 training rows (Rasmussen and Williams 2006); and a perceptron of two
hidden layers of 64 units, trained by full-batch AdamW with early stopping on a 15% validation split (Loshchilov
and Hutter 2019). Features and targets are standardized on the training rows of each split. Because the Gaussian
process sees fewer rows, the other models are also refitted on the same 500 rows; and because one training seed
is one draw, the perceptron is retrained with four more seeds on every split.

*Interpolation* holds out 20% of the states inside every case (2460 training, 612 test rows). *Leave one case
out* holds out each case in turn; the models that predict a case never saw any of its states. An autoencoder
(16, 6 and 16 units) trained on the features gives a guard: its threshold is the 99th percentile of the
reconstruction errors of its validation rows; its false-alarm rate is measured on the 612 held-out in-envelope
states, and its false-accept rate on 11 016 probes, each a held-out state pushed past the training range of one
continuous feature, at six distances from 0.02 to 1.0 of the range, above the maximum and below the minimum.

## 5. Results

### 5.1 The protocols rank the models differently

**Table 1.** Recovery, RMSE in percentage points.

| Model | Interpolation RMSE | Interpolation R² | Leave one case out: mean RMSE | worst case | median R² |
|---|---|---|---|---|---|
| Ridge | 9.71 | 0.631 | 15.75 | 33.12 | 0.325 |
| Random forest | 6.51 | 0.834 | 13.53 | 49.23 | 0.413 |
| Histogram gradient boosting | 4.66 | 0.915 | 13.75 | 60.38 | 0.668 |
| Gaussian process | 6.90 | 0.814 | 14.52 | 42.85 | 0.478 |
| Perceptron | 3.70 | 0.947 | 65.44 | 499.82 | 0.660 |

The perceptron is the best interpolator and the worst at transfer by mean error; by median R² it is close to
gradient boosting. Its numbers are one training seed's: over five seeds its interpolation RMSE runs from 2.71 to
4.02 points and its mean leave-one-case-out RMSE from 27.0 to 65.4, so the seed in Table 1 is its worst by that
statistic, while its rank holds in every seed. Gradient boosting and the random forest cannot be told apart by
mean error (13.75 and 13.53 points): the forest is better in only 3 of the 12 folds, and its lower mean comes from
the magnetite and phosphate folds. Refitted on the Gaussian process's 500 rows, the random forest and gradient
boosting interpolate recovery with an R² of 0.706 and 0.824 against the Gaussian process's 0.814, so its place in
the table is partly its smaller training set. An interpolation score alone would have chosen the model with the
largest transfer errors, and a median alone would have hidden them: they come from two held-out plants
(Table 2).

### 5.2 Transfer failure is concentrated

**Table 2.** Recovery RMSE (points) on each held-out case.

| Held-out case | Ridge | Random forest | Gradient boosting | Gaussian process | Perceptron |
|---|---|---|---|---|---|
| Hard copper porphyry | 9.2 | 6.8 | 4.9 | 4.3 | 1.7 |
| Copper-molybdenum bulk flotation | 9.0 | 6.0 | 3.6 | 4.6 | 2.0 |
| Low-grade copper at high throughput | 9.5 | 6.0 | 4.2 | 6.4 | 2.0 |
| Copper ore with clay | 9.5 | 6.1 | 4.5 | 5.2 | 2.6 |
| Soft copper porphyry | 12.2 | 10.6 | 8.8 | 8.0 | 3.1 |
| Zinc sulphide | 10.8 | 10.3 | 8.2 | 5.8 | 7.6 |
| Nickel sulphide with serpentine slimes | 17.1 | 13.3 | 13.2 | 29.1 | 8.6 |
| Free-milling gold with gravity | 7.4 | 12.8 | 11.5 | 12.5 | 9.8 |
| Oxide copper by sulphidisation | 23.4 | 12.8 | 15.4 | 21.4 | 19.2 |
| Refractory gold in sulphides | 18.2 | 12.8 | 8.9 | 13.3 | 19.8 |
| Fine magnetite concentration | 33.1 | 49.2 | 60.4 | 42.9 | 209.1 |
| Phosphate with clay slimes | 29.5 | 15.8 | 21.4 | 20.8 | 499.8 |

Held out, the five copper sulphide plants, each with close neighbours in the training set, cost the perceptron
1.7 to 3.1 points at this seed and 1.6 to 3.6 over five, and it is the most accurate model on each of them. The two
plants whose circuits no other case shares fail: the perceptron predicts recoveries far outside 0 to 100% for the
magnetite and phosphate circuits (179 to 242 and 28 to 500 points over the seeds), and the tree models, which
cannot extrapolate, fail on the magnetite circuit as well (49 and 60 points), where ridge fails least (33). With
the gravity circuit rebuilt on the GRG model, the free-milling gold plant no longer fails for any model. The same
model can be the best on one held-out plant and the worst on another.

### 5.3 Energy transfers; the upgrade transfers within a family

For the total specific energy every non-linear model transfers by its median, with median held-out R² from 0.927
(random forest) to 0.969 (Gaussian process), because hardness, grind and throughput per megawatt govern energy in
every case. By mean error gradient boosting (0.93 kWh/t) and the random forest (1.11) lead; the perceptron's 5.62
comes from the phosphate and magnetite circuits (57.5 and 3.5 kWh/t), and on the phosphate circuit the Gaussian
process fails too (R² -16.5); over five seeds the perceptron's mean energy error runs from 0.9 to 5.6 kWh/t. The
log10 upgrade ratio interpolates almost perfectly (R² 0.996 to 0.997 for the four non-linear models), and its
median held-out R² over all twelve cases is negative for every model. That median says as much about R² on cases
whose own upgrade barely varies, the two gold plants, as about transfer: among the five copper sulphide plants,
which share their mineralogy, the median held-out R² is 0.92 for the Gaussian process and gradient boosting and
0.93 for the perceptron, and the upgrade fails on the plants with other circuits.

### 5.4 Interval coverage

The Gaussian process's 95% intervals cover 84.2% of the held-out recoveries (mean half-width 9.3 points), 88.9% of
the upgrades and 91.7% of the energies under interpolation, and 75.8, 63.9 and 94.2% under leave one case out (2%,
0.4% and 73% in the worst fold): too narrow for recovery and the upgrade under both protocols. The fitted noise term
sits at its lower bound for recovery only; for the upgrade and the energy it is five to seven orders of magnitude
above it.

### 5.5 The guard

The autoencoder flags 2.3% of the held-out in-envelope states and accepts 17.7% of the out-of-envelope probes
pushed half a training range past the maximum (20.4% below the minimum). That figure is one point of a curve: a
probe a tenth of the range outside is accepted 45% of the time (60% below), one at the full range 14%. The accepts
are not spread evenly: probes that shift the crusher setting (95% accepted), the circulating load (94%) or the water
(92%) pass almost always. A single input that moves without the features it correlates with changes the
reconstruction little, which is exactly the situation an autoencoder of correlated features cannot see. The flag
also tracks the circuit family rather than the surrogate's error: held out, the soft porphyry is flagged in 3.9% of
its states while gradient boosting's upgrade R² there is -1.83. A guard is honest only with its false-accept rate
per feature and per distance beside it.

## 6. The method records

The engine produces, for each variant, records that do not depend on learning:

- **Kinetic lumping.** Five lumped models fitted to a virtual batch test of the rougher feed, projected to
  the bank under the same residence distribution and compared with the exact bank recovery by true flotation,
  over 88 flotation states: mean absolute projection errors of 0.73 points for the gamma model, 0.79 for
  Kelsall, 1.90 for Klimpel, 2.79 for the stretched exponential and 4.91 for first order (Polat and Chander
  2000; Vinnett and Waters 2025). The first-order projection falls below the exact result at every nominal
  state: a batch curve that is a mixture of rates is not one exponential.
- **Constrained optimization.** A generalized pattern search with a progressive barrier from six starts
  (Torczon 1997; Audet and Dennis 2006, 2009) finds a point within the grade, power and water constraints for
  94 of the 96 variants; the two exceptions are the magnetite circuit's harder ore and higher throughput, where
  the grind is the only decision and the mill is already at installed power. The learned lane screens the search
  step (Booker et al. 1999): candidates are ranked by the perceptron's prediction and reach the engine only where
  the guard accepts their state and the Gaussian process's 95% half-width on recovery is within 5 points, a
  novelty measure for the perceptron rather than an interval on what it ranks; the poll and the optimum stay
  engine results. The screen did not save engine work: over the 72 screened variants it cost 14.1% more engine
  evaluations than the same starts without it, although where it proposed the surrogate's recovery was 0.63
  points from the engine's on average over the variants (0.70 over the 5142 proposals), and the unscreened search
  reaches the same optimum in 65 of the 72.
- **Sensitivity.** Sobol indices of four uncertain ore properties at each nominal state (Saltelli et al. 2010;
  Herman and Usher 2017): floatability drives recovery in ten cases, liberation size drives concentrate grade
  in eight and the head grade in the other four, the work index drives grinding energy and the head grade
  drives recovered metal in all twelve.

## 7. Measured data, which calibrate nothing

The engine calibrates nothing and is calibrated by nothing. Measured data feed three lanes, and one of them also
runs through the engine as inputs.

**Particles.** The HZDR constructed-case workbook (Pereira et al. 2021; RODARE 336, CC BY 4.0) keeps its
training sheet (68 008 particles with A/B labels) and its test sheet (29 147 particles with constructed
probabilities and the source authors' predictions, but no observed labels). A sparse logistic model per case
and a shared network (4, 32, 32, 4) are scored against the constructed probabilities:

| Case | Published reference | L1 logistic | Network |
|---|---|---|---|
| 1 | 0.0257 | 0.0131 | 0.0138 |
| 2 | 0.0175 | 0.0157 | 0.0181 |
| 3 | 0.0207 | 0.0171 | 0.0143 |
| 4 (28 484 complete rows) | 0.0371 | 0.1919 | 0.0226 |

The linear model beats the network in cases 1 and 2 and fails only in case 4, where the network does not.

**Locked-cycle tests.** 52 GeoMet locked-cycle copper recoveries from 29 drill holes of one deposit
(Hoffimann et al. 2022; Zenodo 7051975, CC BY 4.0), predicted from five assays by the training mean, ridge, a
random forest and a Gaussian process, under five folds of whole holes and three spatial zones. RMSE ranges
from 5.09 to 5.51 points (whole holes) and 5.15 to 5.69 (zones). A paired bootstrap over complete holes
(2000 resamples) shows how little separates them. On the five fixed hole folds ridge beats the training mean
by 0.42 points (95% interval 0.02 to 0.82), but that partition sits at the 98.5th percentile of 200 random hole
partitions; averaged over them the gain is 0.17 points (-0.39 to 0.71) and under leave one hole out 0.22 (-0.36 to
0.79), each interval widened for the six model pairs, and under spatial zones no model separates either. The source
has no grind, reagent or residence information, so it cannot calibrate the engine's controls.

**The engine on the same samples.** The 52 samples also run through the engine as inputs, each on its own assays in
the soft copper porphyry's circuit at that case's operating point; nothing in the engine is fitted to them. The work
index comes from the nearest comminution sample in the hole (42 samples) or the deposit median (10), and spans 15.2
to 26.1 kWh/t against the case's 11.0. Most of the copper is bornite and chalcocite, allocated by a sulphur-limited
normative mineralogy, one choice in a family of allocations; the two minerals float at declared ratios to
chalcopyrite (0.8, and chalcocite at 1.5 times bornite, a choice the GeoMet data do not bound). Every sample runs
the mill at installed power, and the engine's recovery falls short of the locked-cycle test by 20.4 points on
average (RMSE 22.2 points; 0.3 to 39.9 points below). That gap is mostly the host circuit's size: the samples are
harder than the circuit's design ore, so at 720 t/h the product is coarse. With the circuit sized for the case's
150 µm target the gap is +2.0 points, and it runs from +10.4 to -18.5 points as the assumed laboratory grind goes from
75 to 300 µm, which the open data do not give. At each sample's own target-grind throughput it is +5.2 points, of
which 3.2 come from the longer flotation residence at the lower throughput rather than from the grind. At every
assumed grind the engine carries no information about which sample recovers more (Pearson r between -0.03 and
0.01). It is a comparison, not a calibration: the circuit, the breakage, the liberation and the flotation are
authored for another ore, and a locked-cycle test is not a plant.

**Plant hours.** One iron-ore plant's reverse flotation record (Kaggle dataset 6294, CC0; 737,453 rows) gives
hourly laboratory silica beside 21 feed, reagent, pulp and column sensors. Dropping the 310 hours whose silica
label was interpolated leaves 3,701 pairs of consecutive hours. Scored on three future windows after at least 24
hours of embargo, the previous assay alone forecasts the next hour's silica with a mean absolute error of 0.464
points, and the best sensor-only model, ridge, is 0.001 points below the training mean's 0.766. The engine has no
reverse cationic flotation family, so these hours are shown and never simulated.

## 8. Discussion and limitations

The test bounds transfer between authored plants. A thirteenth authored plant is not a real one: the engine
is a steady-state model with authored parameters, no froth stability, no dynamics and no prices, and its
twelve plants share its structural assumptions. That is a feature of the design, since the teacher's answer
is exact and reproducible, and a limit of the conclusion, since a real plant can depart from all twelve at
once.

Three findings should carry over to any surrogate of a flowsheet model. First, interpolation and transfer are
different questions, and the model that answers the first best can answer the second worst. Second, transfer
error is an average over held-out plants that hides where it fails; the plants unlike the others dominate it,
and reporting the worst held-out case matters as much as the mean. Third, a reconstruction guard misses shifts
in inputs that do not move with the others, so its false-accept rate must be reported by input and by distance.

A calibrated study would replace the authored targets by measured metallurgy across campaigns, calibrate the
engine on some and hold out a whole campaign and an ore family, and score both point error and whether the
surrogate preserves the ranking of operating decisions.

## 9. Reproducibility

The repository is https://github.com/fsantibanezleal/CAOS_OreFlow (MIT). The engine, the bake, the records,
the browser port, the service and the documentation are versioned together; this draft describes 0.07.000.
`./scripts/setup.ps1` builds the environments and `./scripts/precompute.ps1` regenerates every record. On a
workstation with 32 logical cores and an RTX 4070 Laptop GPU, the committed precompute took 885 s for the cases on 12
workers and 2483 s for the learned lane, while other jobs shared the machine; the measured lanes follow it.
`./scripts/smoke.ps1` runs the checks, including 490 Python tests and 323 frontend tests. The workbench at
https://oreflow.ml.fasl-work.com runs the engine in the browser on any state of any case.

## References

- Audet, C. and Dennis, J.E. (2006). Mesh adaptive direct search algorithms for constrained optimization. SIAM Journal on Optimization 17(1):188-217. doi:10.1137/040603371
- Audet, C. and Dennis, J.E. (2009). A progressive barrier for derivative-free nonlinear programming. SIAM Journal on Optimization 20(1):445-472. doi:10.1137/070692662
- Bond, F.C. (1952). The third theory of comminution. Transactions AIME 193:484-494.
- Booker, A.J., Dennis, J.E., Frank, P.D., Serafini, D.B., Torczon, V. and Trosset, M.W. (1999). A rigorous framework for optimization of expensive functions by surrogates. Structural Optimization 17(1):1-13. doi:10.1007/BF01197708
- Breiman, L. (2001). Random forests. Machine Learning 45:5-32. doi:10.1023/A:1010933404324
- Duarte, R., Yamashita, A., da Silva, M., Cota, L. and Euzébio, T. (2021). Calibration and validation of a cone crusher model with industrial data. Minerals 11(11):1256. doi:10.3390/min11111256
- Friedman, J.H. (2001). Greedy function approximation: a gradient boosting machine. Annals of Statistics 29(5):1189-1232. doi:10.1214/aos/1013203451
- Global Mining Guidelines Group (2021). Determining the Bond Efficiency of Industrial Grinding Circuits, GMG01-MP-2021.
- Gorain, B.K., Franzidis, J.-P. and Manlapig, E.V. (1997). Studies on impeller type, impeller speed and air flow rate in an industrial scale flotation cell. Part 4: Effect of bubble surface area flux on flotation performance. Minerals Engineering 10(4):367-379. doi:10.1016/S0892-6875(97)00014-9
- Gorain, B.K., Franzidis, J.-P. and Manlapig, E.V. (1999). The empirical prediction of bubble surface area flux in mechanical flotation cells from cell design and operating data. Minerals Engineering 12(3):309-322. doi:10.1016/S0892-6875(99)00008-4
- Herbst, J.A. and Fuerstenau, D.W. (1980). Scale-up procedure for continuous grinding mill design using population balance models. International Journal of Mineral Processing 7(1):1-31. doi:10.1016/0301-7516(80)90034-4
- Herman, J. and Usher, W. (2017). SALib: an open-source Python library for sensitivity analysis. Journal of Open Source Software 2(9):97. doi:10.21105/joss.00097
- Hoffimann, J., Augusto, J., Resende, L., Mathias, M., Mazzinghy, D., Bianchetti, M. et al. (2022). Modeling geospatial uncertainty of geometallurgical variables with Bayesian models and Hilbert-Kriging. Mathematical Geosciences 54(7):1227-1253. doi:10.1007/s11004-022-10013-1
- King, R.P. (1979). A model for the quantitative estimation of mineral liberation by grinding. International Journal of Mineral Processing 6:207-220. doi:10.1016/0301-7516(79)90037-1
- Laplante, A.R. and Gray, S. (2005). Advances in gravity gold technology. Developments in Mineral Processing 15:280-307. doi:10.1016/S0167-4528(05)15013-3
- Laplante, A.R. and Staunton, W.P. Gravity recovery of gold, an overview of recent developments (AMIRA P420B).
- Loshchilov, I. and Hutter, F. (2019). Decoupled weight decay regularization. arXiv:1711.05101.
- Moly-Cop Tools (Sepúlveda). BallSim_Direct and BallParam_Direct spreadsheets and documentation.
- Muthaphuli, P. (2014). Production of pelletizing concentrates from Zandrivierspoort magnetite/haematite ore by magnetic separation. Journal of the Southern African Institute of Mining and Metallurgy 114(7).
- Oliveira, E.M. Quality prediction in a mining process: one iron-ore flotation plant, March to September 2017 (CC0). Kaggle dataset 6294, version 1. https://www.kaggle.com/datasets/edumagalhaes/quality-prediction-in-a-mining-process
- Pereira, L., Frenzel, M., Khodadadzadeh, M., Tolosana-Delgado, R. and Gutzmer, J. (2021). A self-adaptive particle-tracking method for minerals processing. Journal of Cleaner Production 279:123711. doi:10.1016/j.jclepro.2020.123711
- Plitt, L.R. (1976). A mathematical model of the hydrocyclone classifier. CIM Bulletin 69(776):114-123.
- Polat, M. and Chander, S. (2000). First-order flotation kinetics models and methods for estimation of the true distribution of flotation rate constants. International Journal of Mineral Processing 58:145-166. doi:10.1016/S0301-7516(99)00069-1
- Rasmussen, C.E. and Williams, C.K.I. (2006). Gaussian Processes for Machine Learning. MIT Press.
- Saltelli, A., Annoni, P., Azzini, I., Campolongo, F., Ratto, M. and Tarantola, S. (2010). Variance based sensitivity analysis of model output. Design and estimator for the total sensitivity index. Computer Physics Communications 181(2):259-270. doi:10.1016/j.cpc.2009.09.018
- Savassi, O.N., Alexander, D.J., Franzidis, J.P. and Manlapig, E.V. (1998). An empirical model for entrainment in industrial flotation plants. Minerals Engineering 11(3):243-256. doi:10.1016/S0892-6875(98)00003-X
- Torczon, V. (1997). On the convergence of pattern search algorithms. SIAM Journal on Optimization 7(1):1-25. doi:10.1137/S1052623493250780
- Trahar, W.J. (1981). A rational interpretation of the role of particle size in flotation. International Journal of Mineral Processing 8(4):289-327. doi:10.1016/0301-7516(81)90019-3
- Vinnett, L. and Waters, K.E. (2025). The use of compressed exponentials for kinetic modelling of batch flotation. Minerals Engineering 226:109246. doi:10.1016/j.mineng.2025.109246
