# How far does a learned surrogate of a flowsheet simulator transfer across ores? A closed-circuit, size-by-mineral engine and a leave-one-case-out test

Felipe Santibáñez-Leal (ORCID 0000-0002-0150-3246), CAOS open-research programme, Santiago, Chile

Draft of 2026-09-26, written against OreFlow 0.05.000. Not deposited; no DOI. Every number below is read
from the records committed with that version (`data/derived/learning.json`, `data/derived/benchmark.json`,
`data/derived/source/*.json`, the twelve case artifacts), which the repository's tests hold the documentation
to.

## Abstract

Learned surrogates of process simulators are increasingly proposed as the fast core of mineral-processing
digital twins, and they are usually scored by interpolation: random held-out states of the plants they were
trained on. We ask how far such surrogates transfer to an ore and plant they have not seen. As the teacher we
use an open steady-state flowsheet engine that carries every stream as the mass flow of every mineral in 63
size classes plus water, solves closed grinding circuits with an energy-specific population balance and
Plitt hydrocyclones, separates by flotation banks, gravity, magnetic drums or desliming, and closes the
balance of every unit within 1e-9. The engine is checked against four published examples and is reproduced
by an independent browser implementation within 1e-6 on all 72 committed states. On a 3072-state design over
twelve authored plants, five surrogates (ridge, random forest, histogram gradient boosting, a Gaussian
process and a multilayer perceptron) are scored by interpolation inside the cases and by leave one case out.
The protocols rank the models differently: the perceptron interpolates recovery best (RMSE 3.07 points) and
transfers worst (42.1 points on average over the held-out plants). The transfer failure is concentrated:
held-out copper sulphide plants cost the perceptron 2.1 to 4.7 points, while the three plants whose circuits
differ from the rest cost 78 to 259 points. Specific energy transfers (median held-out R² 0.887 for gradient
boosting); the concentrate upgrade does not transfer for any model. An autoencoder guard flags 1.3% of
in-envelope states but accepts 17.0% of states pushed outside the training range, almost all of them shifts
of three weakly coupled inputs. The results bound transfer between authored plants, not to real ones.

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
   models reverses between the protocols, and that the guard misses shifts of inputs its training features do
   not correlate with.

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
minerals classify as coarser particles and circulate. Flotation banks are perfect mixers in series; the rate
constant of each particle class follows from the bubble surface area flux `S_b = 6 J_g / D_32` (Gorain et al.
1997, 1999) and a size window (Trahar 1981), entrainment follows Savassi et al. (1998), and cleaner and
recleaner tails return to the preceding bank:

```text
r = (k tau + ENT w) / (1 + k tau + ENT w),        R_N = 1 - (1 - r)^N
```

A gravity unit on a bleed of the cyclone underflow recovers liberated gold by size (Laplante and Staunton;
Laplante and Gray 2005); low-intensity magnetic drums capture liberated magnetite and composites by their
magnetite content; desliming cyclones discard slimes ahead of flotation.

### 2.4 The audit and the contract

An independent audit recomputes, from the output streams alone, the closure of every mineral, every species
and the water at every unit and for the circuit. The operating point is twelve inputs declared once, with units,
per-case bounds, steps, the families they apply to, a cross-field rule and bilingual messages; the exported
declaration is interpreted identically by the engine's validator, the web service and the browser, so a state
is accepted or rejected with the same code everywhere.

## 3. Verification

**Balances.** All 72 committed states close within 1e-9 relative at every unit and for the circuit, as
recomputed from the stored streams by the artifact checks.

**The second implementation.** A line-by-line TypeScript port runs the engine in the browser. Re-simulating
every committed state from its own definition, it matches every metric, stream record, curve and kinetic
record within 1e-6 relative, with the same flags.

**Published examples.** Each is labelled as a published example, not as plant data:

| Example | Published | Engine |
|---|---|---|
| Moly-Cop BallSim base case (504 t/h, F80 6913 µm) | P80 169.4 µm, circulating load 2.77, 8.56 kWh/t | P80 and circulating load met to round-off; 9.13 kWh/t, 6.7% above, inside the declared 20% tolerance |
| GMG worked examples of the operating work index | 14.4 and 11.7 kWh/t | 14.38 and 11.71 kWh/t |
| Laplante gravity example (a different plant) | gold recovery rising from 64.1 to 77.1% with the bleed, with diminishing returns | gravity recovery rising from 13.7 to 31.7% over the same bleeds, with diminishing returns; gold circulating load 555 to 271% against an ore circulating load of 250% |
| Zandrivierspoort magnetite (a different ore) | a grind from 75 to 45 µm raises the concentrate from 64.9 to 69.0% Fe | the engine's magnetite case rises from 63.8 to 67.8% Fe: 4.0 points against the published 4.1 |

The gravity and magnetite examples are trend oracles: the engine's cases are not the published plants, so the
checks are the direction, the diminishing returns and the size of the grade effect.

## 4. The test

### 4.1 The plants

Twelve authored cases in four circuit families: nine copper, nickel, zinc and refractory-gold rougher-cleaner
flotation circuits (`rougher`), free-milling gold with a gravity bleed (`gravity_rougher`), fine magnetite with
magnetic drums instead of flotation (`magnetic`), and phosphate with desliming ahead of flotation
(`deslime_rougher`). Every parameter is authored inside a published range and carries its source; none is
fitted to a plant.

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
noise term, on at most 500 training rows (Rasmussen and Williams 2006); and a perceptron of two hidden layers
of 64 units, trained by full-batch AdamW with early stopping on a 15% validation split (Loshchilov and Hutter
2019). Features and targets are standardized on the training rows of each split.

*Interpolation* holds out 20% of the states inside every case (2460 training, 612 test rows). *Leave one case
out* holds out each case in turn; the models that predict a case never saw any of its states. An autoencoder
(16, 6 and 16 units) trained on the features gives a guard: its threshold is the 99th percentile of the
reconstruction errors of its validation rows; its false-alarm rate is measured on the 612 held-out in-envelope
states, and its false-accept rate on 11 016 probes, each a held-out state pushed half its training range past
the maximum of one continuous feature.

## 5. Results

### 5.1 The protocols rank the models differently

**Table 1.** Recovery, RMSE in percentage points.

| Model | Interpolation RMSE | Interpolation R² | Leave one case out: mean RMSE | worst case | median R² |
|---|---|---|---|---|---|
| Ridge | 9.77 | 0.678 | 18.47 | 49.99 | 0.531 |
| Random forest | 7.00 | 0.834 | 12.08 | 47.02 | 0.606 |
| Histogram gradient boosting | 5.18 | 0.909 | 11.84 | 58.70 | 0.749 |
| Gaussian process | 6.95 | 0.837 | 13.28 | 30.27 | 0.496 |
| Perceptron | 3.07 | 0.968 | 42.11 | 259.28 | 0.216 |

The perceptron is the best interpolator and the worst at transfer; gradient boosting is the best at transfer
by mean and median. An interpolation score alone would have chosen the model that transfers worst.

### 5.2 Transfer failure is concentrated

**Table 2.** Recovery RMSE (points) on each held-out case.

| Held-out case | Ridge | Random forest | Gradient boosting | Gaussian process | Perceptron |
|---|---|---|---|---|---|
| Soft copper porphyry | 9.3 | 7.6 | 5.3 | 6.3 | 2.9 |
| Hard copper porphyry | 9.4 | 6.7 | 4.9 | 6.0 | 2.1 |
| Copper-molybdenum | 9.3 | 5.8 | 3.9 | 5.7 | 2.4 |
| Low-grade copper | 9.5 | 5.8 | 4.0 | 6.9 | 2.4 |
| Copper ore with clay | 9.9 | 7.1 | 5.7 | 7.2 | 4.7 |
| Zinc sulphide | 12.9 | 10.9 | 9.4 | 10.7 | 8.6 |
| Nickel sulphide | 7.9 | 10.2 | 9.3 | 10.8 | 15.7 |
| Refractory gold | 16.5 | 9.5 | 7.0 | 15.7 | 17.5 |
| Oxide copper | 23.7 | 18.7 | 18.3 | 23.4 | 19.6 |
| Phosphate with desliming | 36.2 | 8.5 | 9.5 | 19.1 | 78.1 |
| Free-milling gold with gravity | 50.0 | 7.2 | 6.1 | 17.3 | 91.9 |
| Magnetite with drums | 26.9 | 47.0 | 58.7 | 30.3 | 259.3 |

Held out, the five copper sulphide plants, each with close neighbours in the training set, are predicted about
as well as the pooled interpolation, and by the perceptron, in four of the five, better than it. The plants whose circuits no other
case shares fail: the perceptron predicts recoveries far outside 0 to 100% for the magnetite circuit, and the
tree models, which cannot extrapolate, fail there as well (47 and 59 points), where ridge fails least. The
same model can be the best on one held-out plant and the worst on another.

### 5.3 Energy transfers; the upgrade does not

For the total specific energy, gradient boosting and the random forest transfer with median held-out R² of
0.887 and 0.858 (mean RMSE 1.33 and 1.45 kWh/t), because hardness and grind govern energy in every case. The
log10 upgrade ratio interpolates almost perfectly (R² 0.997 to 0.999 for the four non-linear models) and does
not transfer at all: its median held-out R² is negative for every model, because the upgrade depends on
mineralogy that the other eleven plants do not share.

### 5.4 Interval coverage

The Gaussian process's 95% intervals cover 89.2% of the held-out recoveries (mean half-width 10.5 points),
92.0% of the upgrades and 95.6% of the energies under interpolation: somewhat too narrow for recovery. On a
deterministic teacher the fitted noise term goes to its lower bound, and the intervals express only the
kernel's smoothness assumption.

### 5.5 The guard

The autoencoder flags 1.3% of the held-out in-envelope states and accepts 17.0% of the out-of-envelope probes.
The accepts are not spread evenly: probes that shift the water (97% accepted), the crusher setting (97%) or the
circulating load (91%) pass almost always. A single input that moves without the features it correlates with
changes the reconstruction little, which is exactly the situation an autoencoder of correlated features
cannot see. A guard is honest only with its false-accept rate per feature beside it.

## 6. The method records

The engine produces, for each variant, records that do not depend on learning:

- **Kinetic lumping.** Five lumped models fitted to a virtual batch test of the rougher feed, projected to
  the bank under the same residence distribution and compared with the exact bank recovery by true flotation,
  over 66 flotation states: mean absolute projection errors of 0.75 points for the gamma model, 0.91 for
  Kelsall, 2.02 for Klimpel, 3.02 for the stretched exponential and 5.32 for first order (Polat and Chander
  2000; Vinnett and Waters 2025). The first-order projection falls below the exact result at every nominal
  state: a batch curve that is a mixture of rates is not one exponential.
- **Constrained optimization.** COBYLA from six starts (Powell 1994; Zhang et al. 2023) finds a point within
  the grade, power and water constraints for 70 of the 72 variants; the two exceptions are the magnetite
  circuit's harder ore and higher throughput, where the grind is the only decision and the mill is already at
  installed power.
- **Sensitivity.** Sobol indices of four uncertain ore properties at each nominal state (Saltelli et al. 2010;
  Herman and Usher 2017): floatability drives recovery in ten cases, liberation size drives concentrate grade
  in nine, the work index drives grinding energy and the head grade drives recovered metal in all twelve.

## 7. Two measured lanes, kept apart

The engine calibrates nothing and is calibrated by nothing; two lanes of measured data sit beside it.

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

The linear model fails only in case 4, where the network does not.

**Locked-cycle tests.** 52 GeoMet locked-cycle copper recoveries from 29 drill holes of one deposit
(Hoffimann et al. 2022; Zenodo 7051975, CC BY 4.0), predicted from five assays by the training mean, ridge, a
random forest and a Gaussian process, under five folds of whole holes and three spatial zones. RMSE ranges
from 5.09 to 5.51 points (whole holes) and 5.15 to 5.69 (zones). A paired bootstrap over complete holes
(2000 resamples) shows how little separates them: under whole-hole folds only ridge beats the training mean
with an interval that excludes zero (0.42 points, 95% interval 0.02 to 0.82), and under spatial zones no model
does. The source has no grind, reagent or residence information, so it cannot calibrate the engine's controls.

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
in inputs that do not move with the others, so its false-accept rate must be reported by input.

A calibrated study would replace the authored targets by measured metallurgy across campaigns, calibrate the
engine on some and hold out a whole campaign and an ore family, and score both point error and whether the
surrogate preserves the ranking of operating decisions.

## 9. Reproducibility

The repository is https://github.com/fsantibanezleal/CAOS_OreFlow (MIT). The engine, the bake, the records,
the browser port, the service and the documentation are versioned together; this draft describes 0.05.000.
`./scripts/setup.ps1` builds the environments, `./scripts/precompute.ps1` regenerates every record (the
committed process bake took 327 s for the cases on 12 workers and 1972 s for the learned lane on an RTX 4070
Laptop GPU, on a workstation with 32 logical cores; the two measured lanes follow it), and
`./scripts/smoke.ps1` runs the checks, including 341 Python tests and 150 frontend tests. The workbench at
https://oreflow.ml.fasl-work.com runs the engine in the browser on any state of any case.

## References

- Bond, F.C. (1952). The third theory of comminution. Transactions AIME 193:484-494.
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
- Pereira, L., Frenzel, M., Khodadadzadeh, M., Tolosana-Delgado, R. and Gutzmer, J. (2021). A self-adaptive particle-tracking method for minerals processing. Journal of Cleaner Production 279:123711. doi:10.1016/j.jclepro.2020.123711
- Plitt, L.R. (1976). A mathematical model of the hydrocyclone classifier. CIM Bulletin 69(776):114-123.
- Polat, M. and Chander, S. (2000). First-order flotation kinetics models and methods for estimation of the true distribution of flotation rate constants. International Journal of Mineral Processing 58:145-166. doi:10.1016/S0301-7516(99)00069-1
- Powell, M.J.D. (1994). A direct search optimization method that models the objective and constraint functions by linear interpolation. In Advances in Optimization and Numerical Analysis, 51-67. doi:10.1007/978-94-015-8330-5_4
- Rasmussen, C.E. and Williams, C.K.I. (2006). Gaussian Processes for Machine Learning. MIT Press.
- Saltelli, A., Annoni, P., Azzini, I., Campolongo, F., Ratto, M. and Tarantola, S. (2010). Variance based sensitivity analysis of model output. Design and estimator for the total sensitivity index. Computer Physics Communications 181(2):259-270. doi:10.1016/j.cpc.2009.09.018
- Savassi, O.N., Alexander, D.J., Franzidis, J.P. and Manlapig, E.V. (1998). An empirical model for entrainment in industrial flotation plants. Minerals Engineering 11(3):243-256. doi:10.1016/S0892-6875(98)00003-X
- Trahar, W.J. (1981). A rational interpretation of the role of particle size in flotation. International Journal of Mineral Processing 8(4):289-327. doi:10.1016/0301-7516(81)90019-3
- Vinnett, L. and Waters, K.E. (2025). The use of compressed exponentials for kinetic modelling of batch flotation. Minerals Engineering 226:109246. doi:10.1016/j.mineng.2025.109246
- Zhang, Z., Ragonneau, T.M. and Schueller, J. (2023). PRIMA, version 0.5: reference implementation of Powell's derivative-free optimization methods. doi:10.5281/zenodo.8052654
