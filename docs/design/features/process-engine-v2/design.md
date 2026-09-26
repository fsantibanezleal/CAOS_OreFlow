# Process engine v2 design

Sources for every equation and range: the verified research dossier of 2026-09-26, transcribed into
`docs/methodologies/` (libraries get one card each in `docs/frameworks/`). Units are SI-derived and
stated at each symbol; sizes are in um, flows in t/h, energy in kWh/t, power in kW.

## 1. Architecture

```
ore + plant + operating point
  -> crusher (Whiten matrix)                      open circuit, bulk ore
  -> ball-mill circuit (PBM + cyclone, closed)    by mineral and size; gravity bleed for gold
  -> [desliming cyclone]                          phosphate only
  -> separation: flotation rougher + cleaner      recycle of cleaner tails
                 | LIMS rougher + cleaner          magnetite
  -> products, balances, energy, method records
```

Python (`data-pipeline/pipeline/engine/`) is canonical. TypeScript (`frontend/src/engine/`) is a
line-by-line port with the same algorithms, bracket limits and iteration rules, so that parity is a
property of the code and not of luck.

## 2. Size grid

Upper bounds `x_i = 150000 * 2^(-(i-1)/4)` um, `i = 1..63`. Class `i < 63` spans
`[x_{i+1}, x_i)`; class 63 is the pan below `x_63 = 3.24 um`. Representative size
`d_i = sqrt(x_i x_{i+1})`, pan `d_63 = x_63 2^(-1/8)`. Cumulative passing at `x_i` is the mass in
classes `i..63`. P80 and other percentiles interpolate linearly in `(log x, passing)`.

## 3. Ore and particle classes

- Minerals carry density (t/m3), relative grindability of liberated grains `g` (dimensionless) and
  element contents computed from formulas and IUPAC atomic weights; non-stoichiometric minerals
  (electrum, chrysocolla, silicate gangue iron) declare their contents with a source.
- Each case declares its minerals, the head grade of each payable element (from which the valuable
  mineral fraction follows), and the gangue proportions.
- Liberation of a valuable mineral V in class i: `L_i = 1 / (1 + (d_i / x_L)^n_L)`. Composites are
  binary particles of V and the host gangue with V mass fraction `c`; composite density
  `rho_c = 1 / (c/rho_V + (1 - c)/rho_host)`.
- At a separation, class i carries: liberated V (mass `L_i V_i`), composite particles (mass
  `(1 - L_i) V_i / c`), free host gangue (host mass minus the composite share) and every other
  gangue mineral free.

## 4. Crusher

`p = (I - C)(I - B C)^-1 f`, `C_i` the Whiten classification function with `K1 = a1 CSS`,
`K2 = a2 CSS`, `K3`, evaluated at `d_i`; `B` strictly lower triangular from the cumulative Austin
form with crusher parameters. Feed is a Rosin-Rammler distribution with the case crusher-feed F80;
all minerals share the bulk distribution. Crushing energy is Bond with the crushing work index.

## 5. Grinding circuit

- Energy-specific selection: `S^E_i = alpha0 (Wi_ref/Wi) d_i^alpha1 / (1 + (d_i/d_crit)^alpha2)`
  (t/kWh); pan `S^E = 0`. Per mineral: valuable `S^E_i (L_i g_V + 1 - L_i)`, gangue `S^E_i g_G`.
- Breakage: `B_ij = beta0 (x_i/x_{j+1})^beta1 + (1 - beta0)(x_i/x_{j+1})^beta2` for `i > j`,
  `b_ij = B_ij - B_{i+1,j}`, `b_{63,j} = B_{63,j}`; columns sum to one.
- Residence: three perfect mixers with volume fractions `(0.70, 0.15, 0.15)` (Austin structure,
  fractions declared). With `D = (I - b) diag(S^E)` and per-pass specific energy `e` (kWh per tonne
  of mill feed), `T^-1(e) = I + e D + c2 e^2 D^2 + c3 e^3 D^3`, `c2 = f1f2 + f1f3 + f2f3`,
  `c3 = f1f2f3`. `D`, `D^2`, `D^3` are built once per mineral and scale with `Wi_ref/Wi`.
- Cyclone partition to underflow per particle class: `y'(d) = 1 - exp(-0.693147 (d/d50c_k)^m)`,
  `y = Rf + (1 - Rf) y'`, `d50c_k = d50c sqrt((rho_host - 1)/(rho_k - 1))`, with `d50c` the cut for
  host-gangue particles.
- Mineral systems: valuable `(T^-1 - diag(C_V)) p_V = f_V` with
  `C_V = Rf + (1 - Rf)(L y'_V + (1 - L) y'_c)`. Host gangue carries the composite share
  `X_i = (1 - L_i) p_V,i (1 - c)/c`, which gives a known source term:
  `(T^-1 - diag(C0_G)) p_G = f_G + delta`, `C0_G = Rf + (1 - Rf) y'_G`,
  `delta_i = (1 - Rf) X_i (y'_c,i - y'_G,i)`. Other gangue minerals are independent systems.
- Gravity bleed (gold): a fraction `b` of the underflow feeds the gravity unit; per class it
  recovers liberated gold with `E_g(d) = E_max (1 - exp(-(d/x_g)^2))`, composite gold with `E_gc`
  and gangue with mass yield `y_g`. The mill recycle becomes `(1 - b E_eff) C p`, still linear.
- Water: overflow water `W_o = F w` (w in m3/t, water density 1 t/m3); underflow water
  `W_u = U (1 - s_u)/s_u`; `Rf = W_u/(W_u + W_o)`; mill discharge solids `s_md` fixes the sump
  dilution, which must be non-negative (flagged otherwise).
- Solve: for a per-pass energy `e`, find `d50c` giving circulating load `U/F = CL` (Illinois
  root finder on `ln d50c`), then find `e` giving overflow P80 equal to the target (Illinois on
  `ln e`). Grinding specific energy per tonne of new feed `E = e (1 + CL)`; power `E F`. If the
  power exceeds the installed power, set `E = P_inst / F` and solve `d50c` at that energy; the
  achieved P80 is reported with `power_limited = true`.
- Plitt sizing at the solved cyclone feed: flow per cyclone from the Plitt cut equation for the
  required cut, nearest integer count, then the Plitt cut, pressure, volume split and sharpness at
  that count; pressure outside 35 to 200 kPa is flagged.

## 6. Desliming (phosphate)

A second cyclone on the grinding overflow with its own cut (a control), sharpness and water bypass;
the overflow reports to tailings as slimes; P2O5 lost to slimes is reported.

## 7. Flotation

- `Sb = 60 Jg / D32` (1/s, Jg in cm/s, D32 in mm); `D32 = D32_0 + c_D Jg` (declared linear form of
  the monotone increase reported by Nesset et al.).
- `k_s,i = 60 P_s Sb f_size,s(d_i) f_dose,s(D)` (1/min): two-sided log-normal size factor around
  `x_opt`; dose factor `D/(D + K)` with `K_gangue > K_valuable`; composite floatability
  `P_V c^(2/3)`.
- Water per cell: `r_w = kw tau / (1 + kw tau)`, `kw = 60 P_w Sb`; `w = r_w/(1 - r_w)`.
- Entrainment: Savassi ENT with `(xi, delta)`; cleaner ENT multiplied by a froth-wash factor.
- Per cell: `r = (k tau + ENT w)/(1 + k tau + ENT w)`; bank of N cells `R = 1 - (1 - r)^N`;
  `tau = V_cell (1 - eps_g) / Q_pulp` with the bank feed pulp flow.
- Circuit: rougher feed `X = F_o + T_c`; cleaner feed is rougher concentrate diluted to `s_cf`;
  `T_c = (1 - R_c) R_r X`; fixed-point on X and its water until the residual is below 1e-10 t/h.
- Outputs: final concentrate and tails by species and size; grades from element contents; overall,
  rougher and cleaner recoveries on their own feeds; mass pulls; water recoveries; entrained share
  of gangue; bank grade-recovery profile cell by cell; recovery by size for liberated, composite
  and gangue classes.

## 8. Magnetic separation

LIMS rougher and cleaner on the grinding overflow. Capture: liberated magnetite
`p_max (1 - exp(-d/d_f))`; composites `p_max (1 - exp(-c/c0)) (1 - exp(-d/d_f))`; free gangue
entrapment `e0 + e1 exp(-d/d_e)`, halved in the cleaner. Fe grade from the mineral balance.

## 9. Energy report

Crushing Bond; grinding from the PBM; Bond requirement, operating work index and efficiency ratio
for the achieved reduction; Rittinger and Kick calibrated to Bond at the reference reduction
`F_ref = 10000 um`, `P_ref = 150 um` with the case work index. The reported total is crushing plus
grinding.

## 10. Method records

- Kinetics: a virtual batch test of the rougher feed (true flotation, times 0.5 to 16 min) is fitted
  by the same Levenberg-Marquardt routine in both languages with first-order, Kelsall, Klimpel, gamma
  and compressed/stretched exponential forms; each is projected to the rougher bank with the
  tanks-in-series residence distribution (closed forms for the first three, Gauss-Laguerre
  quadrature with an exported node table for the fourth) and compared with the engine's distributed
  bank recovery.
- Optimization: COBYLA from six fixed starts over target P80, collector dose and gas velocity (the
  grind target alone for magnetite); maximize recovered primary element subject to final grade at or
  above the case specification, required power at or below installed power and process water per
  tonne at or below the plant's capacity; the optimum is re-simulated to report its slacks.
- Uncertainty: 128 seeded scrambled Latin-hypercube samples over work index, head grade,
  liberation size and floatability (authored uniform spreads); P05, P50, P95 of recovery, grade,
  grinding energy and recovered metal, and the probabilities of meeting the grade, power and water
  constraints; Saltelli-Sobol first and total indices with bootstrap intervals for nominal
  variants (SALib, N = 256).
- Learning: see requirements PE-29; features are physical properties and controls, never the case
  identity, so leave-one-case-out measures transfer.

## 11. Contracts

- Contract 1: `pipeline/io/contract.py` declares inputs with unit, bounds, step, integer flag,
  families and help text, plus the rule `deslime_cut_um <= 0.5 target_p80_um`. Scale-dependent
  inputs (throughput, head grade, work index, collector) are bounded by factors of the case
  nominal, intensive inputs absolutely; the export resolves every bound per case. Exported to
  `data/derived/contract/operating_contract.json` with the Gauss-Laguerre table, the grid and a
  digest; `validate()` interprets only that document, and `contract_probes.json` records the
  verdicts every validator must reproduce. Every accepted state must solve (PE-30b).
- Contract 2: case artifact with the ore and plant definitions (everything the engine needs), six
  variants each with operating point, metrics, streams, curves, method records and flags.

## 11a. Pipeline

`data-pipeline/run.py [--output DIR] [--models DIR] [--workers N]` bakes every case and runs the stages in
order:

1. **contract**: export `operating_contract.json` and `contract_probes.json`.
2. **cases**, in parallel over cases (every record is seeded, so the result does not depend on the
   worker count): per variant the trace (point, metrics, streams, topology, curves, kinetics,
   balance, flags), the optimization record and the uncertainty record; for the nominal variant also
   the Sobol record. `data/derived/cases/<id>.json`, schema `oreflow.case/v2`, embeds the ore and
   plant definitions, the bilingual texts, the KPI ranges and the source notes.
3. **learning**: the learned lane (CUDA when available) writes `data/derived/learning.json` and
   `models/process_surrogate.onnx`, `models/process_guard.onnx`, `models/process_surrogate.json`.
4. **benchmark**: `data/derived/benchmark.json` assembled from this run's case records, the
   published-example oracles recomputed by the engine, the learning summary and the two measured
   lanes (HZDR particles, GeoMet locked-cycle tests with paired bootstrap intervals over holes).
5. **manifests**: one per case (artifact path, bytes, SHA-256, schema, engine version, contract
   digest) and `index.json`, built from this run's results only, never from files already on disk,
   so a partial bake cannot ship as complete.
6. **validation**: the checks of `scripts/check_artifacts.py` run in process and again in CI:
   coverage (12 cases, 72 variants), byte and hash integrity, a balance recheck of every unit from
   the stored stream records along the stored topology, the contract digest, the kinetic, optimizer,
   uncertainty and learning record schemas. A failing check fails the bake.

## 12. Browser

- `frontend/src/engine/` mirrors the Python modules; `frontend/src/engine/worker.ts` runs sweeps.
- Controls, ranges and help come from the contract JSON; the validator (a port of `validate()`)
  runs before the engine and rejects the same states with the same codes as the API, showing the
  contract's message in the interface language with locale-formatted limits.

### 12.1 The App route (workbench)

The layout follows ADR-0071 and the shell (`@fasl-work/caos-app-shell`), with no hand-rolled chrome.

- **Rail (left, sized, never scrolls).** The case as a shell `CaseSelector` in `select` mode (one
  optgroup per category), the variant as a select, the case question, and the contract controls of
  the case's family split into three sections shown one at a time: *Feed and grind* (throughput,
  work index, head grade, crusher setting), *Classification* (target P80, circulating load, overflow
  water), *Separation* (collector, gas velocity, rougher cells, gravity bleed or desliming cut, as
  the family has them). Each control shows its unit and help from the contract; a changed control
  marks the state as modified from the variant, with a reset. The entry to the focus view sits here
  (ADR-0070 rule 8).
- **Readout row (top of the main area).** Recovery, concentrate grade, specific energy, P80, mill
  power and the active flags, formatted in the interface language; it is one row and never wraps.
- **Views (one tab row, six views, ADR-0071 rules 4 and 5).**
  1. *Circuit*: the flowsheet drawn from the trace topology, every stream with its solids and water
     flow and its payable grade, the recycle edges (cyclone underflow to the mill, cleaner tails to
     the rougher, recleaner tails to the cleaner, the gravity bleed) drawn and labelled (PE-37);
     selecting a unit shows its input and output records and its closure.
  2. *Grinding*: cumulative size distributions of the circuit streams, the cyclone partition with the
     cut and the bypass marked, the liberation curve with the liberation size and the target P80
     marked, the host-limited composite scale where it departs from 1.
  3. *Separation*: flotation recovery by size for the payable and the host gangue with its entrained
     share, the grade-recovery profile down the rougher bank, and the kinetic record (the batch curve,
     the five fits, their bank projections against the exact bank); for magnetite the LIMS capture
     curves; for phosphate the desliming partition and the slimes loss.
  4. *Response*: a one-input sweep (any metric against any contract input over its bounds) and a
     two-input decision surface (a viridis heatmap with the grade-specification and installed-power
     boundaries drawn), both computed in the Web Worker on an explicit request (PE-38), with the baked
     optimum of the variant marked.
  5. *Methods*: the method records of the variant, one at a time as the shell's `SubTabs`: the
     optimizer (where every start ended against the base and the optimum; decisions, outcomes,
     slacks and active constraints), the uncertainty record (the histogram of one output with P05,
     P50, P95 and the base marked, that output against one uncertain factor, the quantiles of every
     output and the constraint probabilities), the Sobol indices baked at the nominal state (paired
     S1 and ST bars with bootstrap half widths), and the learned lane: the ONNX surrogate and guard
     run in the browser (PE-39) for the current state beside the engine, and on request a sweep of
     one input by the engine in the worker with the surrogate asked for the same states and the
     guard's error against its threshold; the protocol results of the bake (interpolation R²,
     leave-one-case-out median R² and RMSE, guard rates) say how far to trust it.
  6. *Compare*: the chosen metric for the six variants of the case as bars against the nominal,
     with a table of every variant's change and headline metrics, and the twelve cases at their
     nominal states on one map of recovery against total specific energy (from `benchmark.json`,
     whose variant metrics the artifact checks hold equal to the case artifacts).
- **Charts.** Every analytical chart is a uPlot host that follows the shell theme tokens, sizes itself
  from its box, draws what the engine computed as labelled marks, reports the cursor into the readout
  row, supports brush zoom with a reset, and carries a text summary and a data table for screen
  readers (the interactive-visualization rubric; shell defect 3). Heatmaps are canvas images with a
  perceptually uniform colour map.
- **Numbers.** One formatter, `lib/format.ts`, formats every number with `Intl.NumberFormat` in the
  interface language (decimal comma in Spanish), at a precision chosen per unit.
- **Language.** A `DocumentLanguage` component inside `AppShell` writes the interface language to
  `<html lang>` (shell defect 4); the focus route sets it itself, since it renders outside the shell.

### 12.2 The focus route

`/focus/<case>` renders the shell's `FocusShell` (ADR-0070): the stage holds one instrument, chosen
in the rail: the flowsheet, any single chart of the grinding or separation views (the views build
their charts with `grindingCharts` and `separationCharts`, so the focus route reuses them), or the
response sweep. The instrument's canvas is full-bleed; an `OverlayInset` context gives the plot room
under the shell's label, HUD and actions, so nothing drawn sits under an overlay. The rail holds the
variant and the controls with a basic set (throughput, target P80 and the separation lever the family
has) and an advanced set (every contract input); the headline metrics are the HUD, and the stage is
labelled in place with the state the circuit is in (power-limited, grade below the specification,
water above capacity, or within every constraint, plus any other engine flag). A chart's cursor
reading shows in a corner of the stage. The state travels in the URL (with the chosen instrument), so
entering and leaving keeps the case, the variant, the view and every changed control; the entry and
the return are visible controls, verified by clicking. The shell's rail column (at least 300 px)
leaves the stage 76.5% of a 1280x800 viewport; the product narrows its lower bound to 248 px, which
keeps the stage above 80% at every gated viewport (recorded as a shell known defect).

### 12.3 Gates

`locale.test.ts` (PE-35: document language and number format), `trace-curves.test.ts` (PE-36: every
value the grinding and separation charts plot is a trace number, copied, reversed or in a display
unit; checked on every baked variant, and shown to fail when a chart invents a value) and
`scripts/check_ui_formulas.py` (PE-36 and PE-38: no exponential, power or `**` outside the engine
unless the line says why it is not an engine quantity, interface files import only the engine's
interface, and a sweep starts only from a `compute` function referenced only as a click handler),
`worker-sweeps.test.ts` (PE-38: the worker streams cells and stops a sweep between cells on a newer
sweep or a cancel), `surrogate.test.ts` (PE-39), and the browser gate at 1280x800,
1600x900 and 2560x1440 in both themes and both languages: no document scroll on the App route, the
rail shows its own controls, one tab row, the instrument at least 50% of the viewport (80% on the
focus route), `<html lang>` equal to the interface language, the focus round trip by clicking, and a
screenshot of every view (PE-37).

## 13. Performance budget

One circuit evaluation: under 50 ms in Python, under 30 ms in the browser. The full bake of 72
variants with uncertainty, optimization, Sobol and the design matrix: about 35 minutes locally
(measured 2026-09-26 on 12 case workers with CUDA: cases 297 s, learning 1789 s, every other stage
under a second).
