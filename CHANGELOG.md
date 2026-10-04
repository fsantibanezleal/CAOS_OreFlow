# Changelog

## [Unreleased]

## [0.08.001] - 2026-10-04

A patch of 0.08.000: the service answers a direct request for a page again.

### Fixed

- A direct request for a content page (`/methodology`, `/benchmark`, a focus route) answered 404 on the VPS. The
  service's fallback to the app read a 404 response, but Starlette's static files answer a miss with a 404
  response only when the build holds a `404.html`, and raise otherwise; only the GitHub Pages build path, removed
  in 0.08.000, wrote one. The fallback now takes both forms of the miss, a test runs it with and without
  `404.html` (it fails on 0.08.000), and the release's browser gate runs against the service itself instead of
  the Vite preview, whose own fallback had hidden the defect. Found by the 0.08.000 deployment's external checks.
- The service declares the types of the files it serves that the browser checks: the ONNX runtime's `.mjs` module
  as JavaScript, and `.wasm`. It took them from the host's table, which maps `.mjs` to `text/plain` on Windows, so
  the learned lane never loaded when the service ran there (found by this release's gate against the service; the
  VPS, on Linux, served it right). A test serves both through the service with a wrong host table.

### Records

- The release bake, compared with 0.08.000's leaf by leaf: 397,879 values equal; the version stamps and the hashes
  that follow change, with the timings and 183 random-forest scores in their last bits (at most 4.4e-14 relative).
  The networks, scalers and screen are byte-identical.

## [0.08.000] - 2026-10-04

The fixes of the adversarial review of 0.07.000 (issue #60: seven dimensions, each verified by a second reviewer;
the verified findings under #72) and the gravity rebuild. Every fix carries a test or a gate check that fails on
0.07.000.

### Changed

- **One deployment, the VPS.** OreFlow is served from its ML VPS only, its declared deploy class (`vps-service`).
  The template's GitHub Pages workflow, which published a second copy of the site from 0.02.001 to 0.07.000, is
  removed with its build path (the `/CAOS_OreFlow/` base, the per-route copies of `index.html`), Pages is disabled
  on the repository, and the template-residue guard names the workflow. The pages, the diagrams and the docs
  describe the one host.
- **Gravity on the published GRG model** (E-11, PE-18 restated). Gravity-recoverable gold enters liberated with a GRG
  test's sizes, breaks at Banisi's slower rate, classifies with a density exponent fitted to measured GRG partitions,
  and the unit may treat a share of the mill discharge, as Laplante, Woodcock and Noaparast's model does. The
  Laplante oracle runs the published simulator example like for like and states its miss: a perfect unit leaves the
  GRG recovery 5 to 10 points low, because GRG finer than about 37 um escapes the cyclone.
- **The Moly-Cop oracle** runs every published input with the base case's own breakage parameters and compares net
  energy with net (7.30 against 7.71 kWh/t, 5.2% below). The Plitt cyclone sizing is a stated failure, and the
  `cyclone_pressure` flag is retired (E-05, E-07, E-08).
- **The head grade is the feed's total assay** of the payable; the magnetite case's control is 29.7% total Fe (E-02).
- **The cut mode refuses a state with no steady state** (CM-09), in Python, the service and the browser (E-01).
- **The iron-plant lane** compares the sensors with the fitted last assay, an AR(1) baseline, with day-block bootstrap
  intervals (M-04), and names the laboratory values carried over unchanged for three or more hours, scoring every
  model with and without the pairs that touch them (S-16).
- **The GeoMet comparison** is reported over 200 hole partitions and leave one hole out, with intervals widened for
  the six model pairs; no surface names a winner (M-05).
- **The real-sample record** states what its gap to the locked-cycle tests depends on: the assumed laboratory grind,
  the residence, the host circuit and every authored choice (S-01 to S-09).
- **The learned lane** records five MLP seeds, equal training rows, coverage under both protocols, and the guard's
  acceptance by distance and by input (M-07, M-08, M-11, M-16, M-21).

### Fixed

- The phosphate and clay cases state what the engine computes (E-03, E-04); the KPI ranges are presented as
  authoring constraints with their margins (E-12 to E-14); the refractory gold grade ceiling is 38.6 g/t (E-19).
- The workbench shows only current, honest state: rejections, stale sweeps, losses never in the success colour,
  units, flags, one precision per column and layout (U-01 to U-37, R-07, S-12 to S-15, S-20).
- The figures are drawn from their equations and the engine (D-01 to D-32), the flowsheet places every label and
  draws no crossing line, and content-bearing small text meets WCAG AA (D-29, shell known defect 12).
- The pages and the docs say what the records hold, in both languages (the T and M batches, W-01 to W-57).
- Claims checked against their primary sources on 2026-10-03: the phosphate review gives neither a desliming size
  nor a 35% P2O5 target, so the case labels its 20 um cut authored; the collector and bank-model citations are
  narrowed to what their sources state.
- The release gate's captures, read whole, found what no check measured, and each now has one: a GeoMet sample's
  Case view quoted the synthetic case's recovery while the sample computed; the re-run controls kept the live run's
  values over the baked record; the dark architecture modal's full-size toggle was unreadable (shell known defect
  13); the real sources' Case views left blank bands on large screens; wide figures drew 4 px labels on a phone and
  now scroll in their own row; a content tab row cut mid-word now fades its hidden end; raw symbols in captions and
  tables are typeset; and table numbers keep their digits and their grouping.

### Added

- Methodology pages 17 (the HZDR particle lane) and 18 (the GeoMet lane); data contract 06 (the iron plant), field
  tables for the lanes, and the studies and real-sample schemas.
- The Methodology figures as standalone theme-aware SVGs in `docs/svg/`, embedded on pages 01 to 16 and held to the
  app's by a test.
- Claims tests for the docs: methodology pages 02 to 04, 06, 09, 11 to 18, the data contracts, the SDD's coverage
  matrix, guide 03's snippets and the CHANGELOG; the content guard flags private references.
- `scripts/setup -NoGpu` (`--no-gpu`), and `scripts/precompute` runs the three measured lanes before the bake.
- A GeoMet sample's Case view charts every sample against its locked-cycle test: the engine at the case's nominal
  state, the GeoMet lane's out-of-fold ridge prediction, and the chosen sample at the current state, which moves
  with the controls. On a large screen the chart spans the view under the facts and the comparison; below that it
  has a sub-tab of its own.

### Records

- The release bake of 2026-10-03 (learning 15303 s, cases 4445 s on 12 workers, while another job held every core),
  compared leaf by leaf with the development bake adopted during the release: 397,647 values equal; the differences
  are the engine version, the contract digest (E-15 changed the cut's help text), the refractory gold grade ceiling
  (60 to 38.6 g/t, E-19), the rewritten source notes, the benchmark's new range sources, the timings and the byte
  counts that follow, and 186 learning scores in their last bits (below 1e-12 relative). The exported networks,
  the scalers and the optimizer's screen are byte-identical.
- The iron-plant record gains the held-label block (S-16); the particle and GeoMet records are unchanged.

## [0.07.000] - 2026-09-30

The rest of the plan that the audit of 2026-09-27 found missing (issues #51 to #57, under #63): the optimizer the
plan proposed, screened by the learned lane and running live in the browser; live uncertainty with its seed and
sample count; the classifier cut as a control; real ore samples and plant hours as workbench sources; the
iron-plant soft-sensor lane; mechanism ablations; and the Implementation and Experiments pages at their planned
tabs. Every feature was designed before its code (`docs/design/features/`, ADR-0075), and every requirement names
the test or check that fails when it is broken.

### Added

- **The live optimizer** (#53, #54, OP-01 to OP-11).
  - A generalized pattern search with a progressive barrier replaces COBYLA, written line for line in Python and
    TypeScript. The browser takes the bake's steps.
  - The objective is `w M/M0 - (1-w) E/E0`. The contract declares the weight on recovered metal
    (`optimizer_weight_pct`, 0 to 100 in steps of 5), and the record keeps the optimum at 0.75, 0.5 and 0.25,
    each run warm-started from the one before.
  - The learned lane screens the search step: a candidate passes only where the autoencoder guard accepts its
    state and the Gaussian process's 95% half-width on recovery is at most 5 points. The poll and the optimum are
    always engine results.
  - The record keeps each start's screen counts and proposals, and the same starts run without the screen, so
    the saving is measured, not assumed.
  - The Methods view runs the optimizer at the current state, in its own worker, only on the button.
- **Live uncertainty** (#54, UQ-01 to UQ-08). A SplitMix64 Latin hypercube, bit for bit in both languages. The
  contract declares the seed and the sample count as controls, and the Methods view re-runs the record in the
  browser at another seed or sample count. The Sobol indices stay baked only.
- **The classifier cut as a control** (#55, CM-01 to CM-08).
  - A corrected cut above 0 holds the classifier's cut; the mill draws its installed power, and the P80 and the
    circulating load follow as results. The bounds are 0.8 to 1.6 times the cut the nominal state solves.
  - Two cut-mode variants per case, so a case carries eight variants and the bake 96.
  - The optimizer's grind decision becomes the cut, and that search runs unscreened, with the reason recorded.
  - The modes agree to about 1e-13 at the same state.
- **Real samples and plant hours** (#51, RS-01 to RS-10).
  - The 52 GeoMet locked-cycle samples run through the soft porphyry's circuit on their own assays. Their work
    index comes from the pinned comminution table, and their copper from a sulphur-limited normative mineralogy.
    Bornite and chalcocite join the mineral table.
  - The engine's recovery sits beside the measured test and the GeoMet lane's out-of-fold predictions: the engine is 20.4 points below the tests on average (RMSE 22.2), against the GeoMet lane's RMSE of 5.09 to 5.51 points, every sample at installed power.
  - The rail's source switch chooses a synthetic case, a sample or an iron-plant hour. An hour is shown, never
    simulated.
- **The iron-plant soft-sensor lane** (#52, IS-01 to IS-06). On the CC0 flotation-plant record, the 310
  interpolated hours are excluded and 3,701 next-hour pairs remain. Persistence (MAE 0.464 points of silica) beats
  every model; the sensor-only ridge (0.765) is 0.001 better than the training mean (0.766). A Benchmark group,
  Industrial quality, states it so.
- **Mechanism ablations and a seed study** (#57, AB-01 to AB-04). Entrainment, composite classes, cleaner
  recirculation, regrind and the gravity bleed are each taken away at every nominal state, and the uncertainty
  record is re-run at eight more seeds. Removing the cleaner recirculation costs 3.1 to 11.2 points of recovery.
- **Pages.** Experiments has the seven planned tabs (data and splits, the uncertainty protocol with its live
  re-run and seed study, the ablations). Implementation has nine (the model registry, the GPU lane, deployment).
  Methodology pages 15 (real samples) and 16 (the soft sensor) are new, and page 03 gains the cut mode.

### Changed

- **Bake order.** Learning runs before the cases, so the screen reads this bake's exports. The stages: contract,
  learning, cases, benchmark, studies, real samples, manifests, validation.
- **The uncertainty draws.** The SplitMix64 design replaces SciPy's scrambled Latin hypercube. Every uncertainty
  record therefore holds new draws of the same distributions, and the quoted spreads and probabilities move:
  the recovery spread between P05 and P95 runs from 2.9 points (free-milling gold) to 7.7 (zinc), where it ran from 3.7 to 9.1, and the chance of meeting every constraint from 52% (magnetite) to 83% (phosphate), where it ran from 53% to 82%.
- The records of the 0.07.000 bake. The pages the page-claim tests hold were updated with them; several guides and
  architecture and methodology pages kept older counts, corrected in 0.08.000 (review of 2026-10-02, W-11 to W-24):
  - **optimization.** 94 of the 96 variants reach an optimum; the two magnetite variants that cannot are the
    same as before. 28 of the 72 target-mode variants break a constraint as run, and none of the 24 cut-mode
    variants. The gains run from -0.8% to +18.1% (+18.2% with COBYLA), 0.3% to 7.6% at the nominal states and
    0.3% to 5.1% in the cut mode. Power is active at 81 optima, grade at 23 and water at 10;
  - **the screen.** Over the 72 screened variants it cost 8.5% more engine evaluations than the same starts
    without it (23,535 against 21,692). Where it proposed, the surrogate was 0.64 points of recovery from the
    engine on average, and the unscreened search reaches the same optimum in 63 of the 72;
  - **the weight path.** With a quarter of the weight on metal the nominal optima spend 31 to 46% less energy per
    tonne and recover 10 to 35% less metal; the magnetite optimum does not move, its grade already binding;
  - **kinetic lumping.** 88 fits a model, the eight variants of the eleven flotation cases; first order loses 5.0
    points on average, gamma 0.73 and Kelsall 0.80;
  - **the learned lane** is unchanged from 0.06.000;
  - **the manuscript** gains the engine on the GeoMet samples and the plant hours, the pattern search and what
    its screen cost; methodology pages 12 and 13 are re-measured, the use-case pages re-rendered, and the bake
    timings updated.
- The architecture modal's diagrams follow the release: learning before the cases, the screened optimizer and
  its worker, the cut mode, the real sources, 96 variants and thirteen inputs. `static-counts.test.ts` holds them
  to the records.
- The content pages fit a phone: below 860 px every table scrolls inside its own box, with its caption above the
  rows, and a panel's column no longer takes a wide table's width. The gate's phone and tablet pass now opens every
  tab of every content page; 16 tabs had scrolled the document sideways.

### Fixed

- **An empty size class could divide 0 by 0.** The host-limited composite scale divided 0 by 0 where round-off
  leaves the host at about -4e-16 against no composite demand. The cut mode's finest grinds reached it at the
  nickel and zinc envelope corners. The host is now clipped at 0 before it limits, in the circuit and in the
  particle-class split, in both engines.
- **The two languages could decide differently on a flat objective.** Every comparison in the pattern search,
  the screen's ranking and the choice of the best start now uses a declared decrease tolerance (1e-9). One
  start had taken 64 iterations in the browser and 65 in the bake, over equal values.
- **Worded formulas.** Every formula with words now has an English and a Spanish form.


## [0.06.000] - 2026-09-28

From the audit of 2026-09-27 (issues #50 and #58):
- the engine's grinding energy no longer lets a soft bulk mineral override the ore's work index;
- seven of the twelve cases are re-authored inside the ranges their sources give;
- every plausibility range names its source;
- every page, guide and the manuscript quote the new records, and tests hold them to those records.

### Fixed

- **Grinding energy (PE-07b).** The mineral grindabilities multiplied the energy-specific selection
  directly. An ore whose bulk mineral was declared soft therefore broke faster than its own Bond work
  index allowed: the serpentine of the nickel case, and the clays of the oxide, mixed and phosphate cases.
  Its grinding energy was understated up to 1.9 times, and the nickel case ground at 1.62 times Bond's
  efficiency.
  - The selection is now divided by the ore's mass-weighted harmonic mean grindability, and composites
    break at the ore's rate, so the work index alone sets the ore's hardness.
  - Every nominal case grinds at 0.83 to 0.91 of Bond, and `tests/test_grinding.py` holds that ratio.
  - Installed power is re-sized with the documented rule: the same headroom over the nominal requirement.
- **Seven cases outside their cited ranges** (#58). The audit named three; checking every case against
  its source found seven, and the hard porphyry missed its own 24% Cu spec. Each change stays within the
  case's documented mechanism:
  - zinc: sphalerite liberation 80 to 150 µm, 47.3 to 52.9% Zn, inside the 50 to 60% of the US EPA's
    zinc sector profile (citing Kirk-Othmer) and the case's own 50% spec;
  - nickel: pyrrhotite depressed, pentlandite liberation 95 µm, less floatable serpentine; 16.0 to 19.8%
    Ni and 13.7 to 10.2% MgO, against about 20% Ni in Mt Keith-type ore;
  - oxide copper: floatable clay, chrysocolla 10% of the copper, a better sulphidised malachite liberated
    at 90 µm; 29.8 to 20.8% Cu at 67.7 to 79.0% recovery, inside 15 to 21% Cu at 77 to 86%;
  - the four other copper porphyries: chalcopyrite liberation 120 µm, composite content 0.42; 23.7-24.4
    to 25.9-26.7% Cu, inside the practice band from 25% Cu to chalcopyrite's stoichiometric 34.6%.
- **Plausibility ranges** were authored wider than their sources, so the gate passed off-spec cases.
  - Every range now comes from one table in the case catalog, each with its source note: a citation, or
    an explicit "authored" label where no source exists.
  - The case records export the notes (`kpi_sources`), the Case view shows each under its row, and the
    use-case pages have a column for them.
- **Process-water capacity** is 1.05 times each case's nominal need again, to two decimals, as documented.
  After the re-authoring, oxide copper needed 3.13 m³/t against a 2.51 limit, so its nominal state broke
  the water constraint.
- `tests/test_case_rules.py` holds every case to its authoring rules:
  - every range names its source;
  - every nominal state sits inside its ranges and meets its own grade spec;
  - every water capacity follows its rule.
- **Case text.** The soft porphyry quoted smelter grades of 25 to 50% Cu without the source's qualifier;
  a chalcopyrite concentrate is capped at 34.6% Cu. The Introduction's scope line says how the
  grindabilities act, and its Spanish reads per ore (mena).
- **The manuscript** still described 0.05.000. Its tables, abstract, results and method records now quote
  the 0.06.000 records, and `tests/test_manuscript_claims.py` holds them to those records: it parses the
  tables and formats every quoted number from the records. Run against the previous draft, it fails six of
  its seven tests.
- `deploy/setup-vps.sh` now works as an update path as well as a first install:
  - it restarts the running service, which `enable --now` left on the code it had loaded;
  - it installs only the packages that are missing, where it had reinstalled and so upgraded them,
    the host's shared nginx among them;
  - once the certificate exists it installs the TLS virtual host directly. On a rerun the plain one
    had been loaded first, for a few seconds, and HTTPS for this name reached another site;
  - it retries its local health checks while the restarted port refuses connections;
  - it adds the repository to git's safe directories once, not on every run.
  - it returns the checkout to `fasl` after building, not before. Before, an update left the environment,
    `node_modules` and the build owned by root.

### Changed

- The records of the 0.06.000 bake. Every page, guide and methodology page that quotes them was updated,
  and the page-claim tests were updated with them:
  - **the learned lane.** The MLP still interpolates recovery best (R² 0.955) and has the largest mean
    transfer error (55.5 points). By median held-out R² it is now second (0.638), after gradient boosting
    (0.714). The random forest has the lowest mean error, and the MLP is the most accurate model on every
    held-out copper sulphide plant;
  - **the guard.** It raises 0.5% false alarms and accepts 18.1% of the probes, 89% of those along the
    water, the circulating load and the crusher setting. The oxide copper plant is flagged in 99.6% of its
    states, where it was flagged in all of them;
  - **kinetic lumping.** First order loses 5.1 points on average; gamma 0.75 and Kelsall 0.85;
  - **the variant effects on the Experiments page** follow the new grinding energy and cases.
  - **optimization.** Every nominal state now meets its own specification and constraints. 28 of the 72 variants
    break a constraint as run, where 40 did. The gains run from -0.8% to +18.2%; the one loss comes from a state
    that broke a constraint. Power is active at 58 optima, grade at 17, water at 6;
  - **uncertainty.** The probability of meeting every constraint at nominal runs from 53% (magnetite) to 82%.
    Liberation size drives the concentrate grade in eight cases, and the head grade in the other four;
  - **methodology pages 11 to 13** are re-measured on these records, and the bake timings are updated.
- The benchmark record links its measured lanes again. They were null in an intermediate record, because that
  bake's sandbox lacked the lanes' records when the benchmark stage ran. `scripts/check_artifacts.py` now
  requires both links.
- Two tests pinned to the cases before their re-authoring now build their own states: the kinetic ranges
  (the stretched exponential's beta is 0.83 to 0.94), and an off-specification state for the optimizer.

## [0.05.001] - 2026-09-26

A patch of 0.05.000:
- the charts get the surface that text panels left empty;
- text that did not fit now fits, and the gate checks it. Most of it was in Spanish at 1280x800: the
  rail's values, the readout's status, and the charts' labels and titles;
- the Uncertainty histogram draws its end bars whole;
- a failed build reports its own error.

### Fixed

- From 1800 by 1000 px a text panel beside the charts stood mostly empty: at 2560x1440 the Grinding facts
  filled about a fifth of their cell, and the Methods tables a fifth to a third of their column. The
  Grinding facts and the Methods records' tables and notes now sit in a strip under the charts, as tall as
  their content. The flotation Separation panel, which holds the kinetic table as well, does so from 2200
  by 1200 px. The browser gate fails a text panel beside the charts that its content fills less than 30%.
- That floor also failed the magnetite Separation facts at 1280x800, where the six facts filled 29% of
  their panel. The view holds one chart, so its facts now sit in a strip under it at every size, framed
  like the Grinding facts.
- The Uncertainty histogram cut its first and last bars in half at the plot's edges: the chart ranged its
  x axis on the bin centres. A bar chart on a numeric axis now reaches half a bin past them. Its bars keep
  their share of the bin at any width; at 2560 px they had stopped at 64 px and stood apart like
  categories.
- In Spanish at 1280x800 the rail cut every control's value at its edge ("720 t,", "8,0 r"). Its controls
  column took the width of the longest row (the crusher setting and its value), wider than the rail. The
  column now stays within the rail, and a long control name wraps beside its value. The gate measures
  the rails' content against their box (`RAIL_PROBE`). On the build before this fix, whose rail was the
  0.05.000 one, the check fails all ten App views.
- The readout's status was cut in Spanish at 1280x800 ("Dentro de todas las verif..."), with no title to
  read it by. It is now "Sin avisos del motor", the Case view's word for the engine's flags, and a cut
  status or cursor reading is named in full on hover. The gate requires every text an ellipsis cuts to
  carry its full text (`ELLIPSIS_PROBE`).
- Text on the charts' canvas that did not fit, all in Spanish at 1280x800 and all out of the gate's reach:
  - the four Sobol factor names ran into each other. A category label now wraps at its spaces to its
    category's width, and the axis grows for a third line;
  - y titles longer than a short plot were cut at both ends ("Ganancia en metal recuperado (%)" on the
    Benchmark page, "Error del guardia" under the learned lane). The chart now draws its y title itself,
    wrapped to the plot's height in up to two lines;
  - a level's label sat on a data point ("nominal" in the Case view, "sin cambio" on the Experiments
    page, "óptimo" on the Optimizer). It now takes the place nearest the right end of its line, above
    or below, that covers no point.

  Each chart declares on its host what it could not fit (`data-ticks-cut`, `data-title-cut`,
  `data-labels-over`), and the gate fails any, and any visible chart that declared nothing
  (`CANVAS_TEXT_PROBE`).
- On a phone a chart's legend stood in a narrow column beside its title: six series took six lines and
  left the size-distribution plot about 50 px tall, too short for its title. Below 860 px the legend
  runs under the title, across the chart.
- The optimizer's headline gave the gain without its sign ("Optimum found: 0.2594 t/h recovered metal"),
  which read as the optimum's own recovered metal. It now reads "+0.2594 t/h of recovered metal".
- A failed build reported the Pages fallback's missing `index.html` instead of its own error; the fallback
  now skips a build that emitted nothing.

### Changed

- The records are re-baked for the new version stamp: every case number and ONNX export reproduced the
  0.05.000 bake bit for bit, and the random-forest scores within 3e-15.

## [0.05.000] - 2026-09-26

The process engine is rebuilt as a closed-circuit, size-by-mineral flowsheet simulator, and the product
around it (the browser engine, the views, the pages, the records, the gates and the documentation) is
rebuilt on it. GitHub issue #35 records the defects of 0.04 that motivated it.

### Added

- An engine that carries every stream as the mass flow of every mineral in 63 size classes plus water: a
  Whiten crusher; an energy-specific population-balance ball mill (three mixers, Moly-Cop form) closed with
  Plitt hydrocyclones that meets the target P80 and the design circulating load, and runs at installed power
  with a coarser product when it cannot; density-corrected cuts per mineral; flotation banks with rates from
  bubble surface area flux, Savassi entrainment, cleaner and recleaner recycles and regrind; a gravity unit
  on the underflow; low-intensity magnetic drums; desliming; Bond, Rittinger and Kick energy. An independent
  audit recomputes every unit's balance from the output streams; every variant closes within 1e-9.
- Contract 1: one declaration of the twelve operating inputs (units, per-case bounds, steps, families, a
  cross-field rule, bilingual messages), exported once and interpreted identically by the Python validator,
  the API and the browser (719 recorded probe verdicts).
- Method records for every variant: five lumped kinetic models fitted to a virtual batch test and
  projected to the bank; a constrained optimizer (COBYLA from six starts) that maximizes recovered metal
  under grade, power and water constraints; a seeded uncertainty record (128 Latin-hypercube samples of
  four ore properties) with constraint probabilities; Sobol indices at the nominal state.
- A learned lane scored by interpolation and by leave one case out on a 3072-state design: ridge, random
  forest, histogram gradient boosting, a Gaussian process with interval coverage, a PyTorch MLP, and an
  autoencoder guard with its false-alarm and false-accept rates; the MLP and the guard exported to ONNX
  and run in the browser against the bake's reference.
- A TypeScript port of the engine that reproduces all 72 baked variants within 1e-6, running in a Web
  Worker; one- and two-input response sweeps with the constraint boundaries, on request.
- Workbench views rebuilt on the trace (Circuit, Grinding, Separation, Response, Methods, Case) and the
  focus route; the five content pages rebuilt with every stated number held to the records by claims tests;
  the architecture modal with five bilingual diagrams.
- The documentation wiki: architecture, methodologies, data contract, fifteen framework nodes with runnable
  examples, guides, and twelve use-case pages rendered from the records and checked in CI.
- Gates: the SDD check (every live requirement names a gate that exists), the diagram check (language pairs
  and colour tokens), the interface-formula check, the units check, the use-case page check; the browser gate
  measures overflow, clipping, cut equations, figure labels against boxes and against lines, the modal, the
  Spanish number format, the document scroll, the focus stage and the drawn flowsheet against its frame in
  every viewport, theme and language, and a phone and tablet pass;
  `scripts/smoke` is the local release gate.

### Changed

- The version shown in the footer and used to key every artifact request is read from `VERSION`.
- The Sobol record treats an output that is constant up to round-off as constant instead of ranking its
  floating-point spread.
- Spanish pages write authored values, equation constants and figure labels with the decimal comma.

### Fixed

- The document scroll of the content pages (shell known defect 1), with the gate that measures it.
- The browser gate's App-route vertical-overflow check, which read a height the shell pins to the viewport.
- The CI budget gate, which let an install of the GPU requirements through.
- The smoke script, which passed an argument the bake rejects and would have written into `models/`.
- Five figure labels crossed by curves or edges, and the energy-law figure, whose curves did not meet at the
  reference reduction they are calibrated to.
- The flowsheet on a large stage: past a readable cell it stopped growing, and at 2560x1440 spanned 75% of
  its frame's width and half its height. It is now scaled as one piece to span the stage. On the focus
  route the feed label sat under the readout column; labels now stay inside the frame the overlays leave.
- The magnetite circuit drew the LIMS cleaner's concentrate and tail along one line, one arrow under two
  labels; a unit's concentrate now leaves to the right and its tail downward.
- The case catalog on the Introduction page, wider than a 1280 px page in Spanish.
- At phone width the rail's row shrank to 61 px under its controls, which spilled over the readout and the
  tab row; the readout cut its last readings; the flowsheet's cells shrank to 46 px under 64 px unit boxes,
  which overlapped; and a long chart label placed left of its mark ran over the y axis. The rail keeps its
  height and the page body scrolls, the readout scrolls sideways, the flowsheet keeps an 88 px cell and
  scrolls sideways in its panel, and chart labels stay inside the plot.
- From 761 px to about 1060 px in Spanish the header pushed its actions (language, theme, architecture)
  off the screen (shell known defect 10); the route links now scroll in their row at every width.
- The Response heatmap's ticks mixed precisions on one axis (0.00 beside 18.8, 75.0 beside 131); each axis
  now takes one precision from its grid step.
- The Case view printed each case record's provenance in English on Spanish pages; the catalog's phrase
  is now rendered in the interface language, and a test holds every baked record to it.
- The Benchmark uncertainty table needed a sideways scroll at 1280 px (135 px in Spanish); its case names
  and named inputs wrap, and the gate fails a table that needs its scroll box at the gated sizes.
- Spanish pages showed the citation labels as authored in English (author pairs joined with "and", two
  descriptive labels untranslated); the labels now follow the interface language and the records stay
  verbatim. Chemical formulas are printed with subscripts (P₂O₅, SiO₂) in the tables, charts and text.
- The phosphate case description read "20 um" and "P2O5" (the Case view shows it in both languages), and
  the grinding source note "6514 um"; the case catalog writes µm and P₂O₅, and the bake was re-run from
  it: every case number and ONNX export reproduced bit for bit, and the random-forest scores within 6e-15.

### Removed

- The 0.04 one-pass engine and its operating-envelope Investigate view, superseded by the Response view and
  the constrained optimizer; the unused three.js dependency; the documentation pages of the 0.04 engine.

## [0.04.000] - 2026-09-24

- Added a case-aware operating-envelope investigation: explicit feasible limits, declared perturbation stress, finite-grid Pareto classification, point inspection, baseline comparison, apply-to-circuit and reproducible JSON export.
- Added an independent measured GeoMet locked-cycle recovery lane from pinned CC BY 4.0 source data: 52 usable tests from 29 holes, whole-hole and spatial-zone holdouts, four evaluated baselines/models, rendered observed-versus-predicted and spatial diagnostics.
- Added local, checksummed five-assay CSV inference with a full-data checkpoint and out-of-reference-range flags. Measured inference and circuit simulation remain separate; neither is a calibrated plant set-point predictor.
- Added feature-level software design contracts, automated artifact/numerical/browser gates and responsive EN/ES light/dark visual QA at phone, tablet and desktop viewports.

## [0.03.004] - 2026-09-24

- The focus workbench labels its classifier streams "calculated", not "measured": they are the simulator's.

## [0.03.003] - 2026-09-24

- The circuit panel fills its space on a phone: hiding the old stage tabs in 0.03.002 had left an empty grid row
  under the flowsheet, found on the live site at 390 px. The release version is aligned across the service and the
  site.

## [0.03.002] - 2026-09-24

- The flowsheet is again the workbench's primary circuit view, with its stream values, and a focus route opens the
  selected case outside the document shell, through the shared app shell's focus layout.

## [0.03.001] - 2026-09-24

- Preserve and validate process family at the live API boundary. Requests for known authored cases infer their gravity, magnetic, desliming or rougher path when the family field is omitted; explicit unsupported families are rejected.

## [0.03.000] - 2026-09-24

- Rebuilt the contained workbench around selectable, mass-linked circuit operations and an explicit walkthrough with playback, stage selection and local-versus-baked state.
- Added distinct gravity/rougher, magnetite magnetic-separation and phosphate-desliming process paths alongside generic rougher scenarios; exported applicability status for 21 method records in all 72 variants.
- Added process-family-specific controls, size-by-size classification and magnetic views, a material-balance diagram, and method-applicability evidence visualization.
- Recomputed the artifact matrix and ONNX exports with local CUDA training; the public browser remains a simulator explorer, not a plant predictor.
- Added an independent HZDR particle-learning lane with original-sheet train/test separation, L1 and CUDA-capable MLP models, common-row missingness handling, calibration and threshold artifacts, and on-demand browser ONNX inference. Constructed probabilities are not plant recovery.
- Reworked research pages, assumptions, sources and mobile workbench access. Pinned CAOS App Shell v0.06.009 for a single-row mobile header and footer.

## [0.02.001] - 2026-09-23

- Version and bypass browser caches for baked artifact requests, preventing old case JSON from persisting after a shell deployment.

## [0.02.000] - 2026-09-23

- Rebuilt the fixed-viewport instrument: quantitative circuit, response curves, selectable grind-by-collector decision surface, method-specific plots, variant comparison and mobile control view. Added bilingual linked readouts and light/dark responsive layouts.
- Corrected the classifier to partition size-bin masses, normalized the overflow cumulative distribution, connected classifier split to overall recovery and capped concentrate mass pull by rougher feed.
- Recomputed all 12 cases, 72 variants and 1,368 method records; neural models were trained with CUDA on the local RTX 4070 Laptop GPU. Added browser/Python parity checks, classifier sensitivity tests and separate autoencoder reconstruction diagnostics.
- Replaced unsupported plant, uncertainty and OOD claims with explicit simulator-only interpretation, and revised the manuscript as a proposed transfer study rather than a completed novel result.
- Repaired direct document-route serving on the VPS and GitHub Pages; project-site builds now carry the correct base path and a 404 fallback document.
- Emit real GitHub Pages route files so direct document links return HTTP 200, not merely rendered fallback content with status 404.

## [0.01.000] - 2026-09-13

- Initial OreFlow release with six-route visual workbench, 12 x 6 case matrix, 19 process and learned methods, HZDR source summary, reproducible pipeline, manuscript proposal, GitHub Pages workflow and ML VPS service files.
