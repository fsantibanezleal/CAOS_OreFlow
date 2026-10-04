# Release verification record

This file is the release gate for OreFlow. It separates reproducibility evidence from serving evidence so a green local build is not mistaken for a live deployment. The newest release is first; each section records what was checked, where and when.

## 0.08.000, 2026-10-04

### Local gate

- The release bake of 2026-10-03 into a sandbox seeded with the committed measured-lane records:
  - contract, 2.1 s;
  - learning, 15303 s on CUDA (RTX 4070 Laptop GPU);
  - cases, 4445 s on 12 workers;
  - benchmark, 3.9 s;
  - studies, 378 s;
  - real samples, 394 s;
  - manifests and validation, 3.7 s.

  `validation.json` records `passed: true`. Another session's job held every core for the whole bake (CPU load at
  100%), so the stages ran four to six times longer than the development bake's; the bake's four-hour stack dump
  fired once in the learning stage (the five-seed network study, progressing) and did not stop it. Its wrapper's
  2.5-hour deadline was removed while it ran, so the deadline would not kill a bake that cannot reuse its learning
  record. Compared leaf by leaf with the development bake adopted earlier in the release:
  - 397,647 values equal;
  - the differences are the engine version, the contract digest (E-15 changed the classifier cut's help text), the
    refractory gold grade ceiling (60 to 38.6 g/t, E-19), the source notes the W batch rewrote, the benchmark's
    range sources (88 new fields), the timings and the byte counts that follow, and 186 learning scores at their
    last bits (below 1e-12 relative);
  - the exported networks, the scalers and the optimizer's screen are byte-identical.

  It was adopted whole; `models/` is unchanged.
- `scripts/check_artifacts.py` passed on the adopted records. The content guard, which now flags private references,
  passes on them; it had flagged the development bake's source notes.
- The suites on the adopted records:
  - Python: 538 tests passed (1534 s, beside the frontend suite and the other job), and 538 of 538 again on the
    final tree (685 s);
  - frontend: the first run passed 435 of 436 (514 s); the one that failed was the optimizer parity's
    `copper_oxide/nominal`, which ran out of its 300 s on the loaded machine, and the limit is now raised for a
    release (`OF_PARITY_TIMEOUT`). On the final tree, after the capture fixes and the one-deployment change below, 439 of 439 passed (187 s);
  - `OF_CORNERS=full`: the cut-mode envelope's corners in all 12 cases, 12 of 12 passed (182 s);
  - `OF_PARITY=full`: 96 of 96 variants passed, in six processes of two cases each.
- The guards: content standards, template residue (519 tracked files), the SDD (103 live requirements with real
  gates), the CI budget, the bilingual architecture diagrams, units and interface formulas; the use-case page check
  (13 pages match the records); the production build.
- One deployment. The plan's deploy class is `vps-service` on the ML VPS, yet the template's GitHub Pages workflow
  had published a second copy of the site since 0.02.001, and the releases had checked it as a mirror. This release
  deletes the workflow and its build path (the `/CAOS_OreFlow/` base, the per-route copies of `index.html`; the
  service answers every page route itself), disables Pages on the repository, and rewrites the pages, diagrams and
  docs that described two hosts. The template-residue guard fails on the workflow or on any page or doc pointing to
  the copy: on the 0.07 tree it names the workflow and three files.
- The convergence verdicts (W-09): every feature's `tasks.md` gives each live requirement's gate and its result in
  this release's runs, the process engine's 43 rows included: 103 of 103 live requirements met, across the eight
  features (the GeoMet lane's seven with the process engine's, where its earlier verdicts are).
- The browser gate on the served build of the release (bundle `index-NqgWRgWC.js`):
  - the full matrix (1280x800, 1600x900, 1920x1080 and 2560x1440; dark and light; English and Spanish), the
    review pass and the phone and tablet pass: 1,332 of 1,332 checks (1,240 in the matrix's 16 combinations, 12 in
    the review pass, 80 at 390x844 and 768x1024), and every capture read;
  - the gate had not run since the 2026-10-02 integration merge. Its first run on the candidate failed 24 checks
    and the first full matrix 29 more: layout, locale and figure defects that the batches had introduced one at a
    time, each invisible to the unit suites. All were fixed before the matrix passed
    1,308 of 1,308;
  - that run's 1,130 captures were then read as contact sheets, and showed 15 defects no check measured. A GeoMet
    sample's Case view quoted the synthetic case's recovery (94.2%) as "Engine, this state" while the sample
    computed; the optimizer's weight and the uncertainty record's seed and samples kept the live run's values over
    the baked record; the dark architecture modal's full-size toggle could not be read (shell known defect 13);
    the real sources' Case views left blank bands at 1920 and 2560 px, an hour's forecast table cut to four of nine
    rows; wide figures drew 4 to 5 px labels on a phone; the Spanish Implementation tab row ended mid-word with no
    sign it scrolled; captions and tables carried raw symbols ("A_j(x)", "2^-10", "diag(S^E)", "Dc", "K1"); a fold
    table dropped trailing zeros and a windows table printed ungrouped counts. Each is fixed with a check in the gate
    or a test, except the heatmap's label chips, which are read from the captures; the phone pass now scrolls each
    view into place before its capture (several had captured only the rail);
  - two of the new checks were wrong on their first run and were corrected: the hour layout check measured the
    chart's legend table, and the toggle check ran before the diagram that renders the toggle had loaded;
  - the next full matrix passed 1,320 of 1,324: the four failures were the GeoMet sample's Case view at 2560 x 1440
    in every theme and language, whose side panel was 28% filled once it stayed beside the facts. The view now
    charts every sample against its locked-cycle test (the engine, the GeoMet lane, and the chosen sample at the
    current state): across the view under the facts and the comparison on large screens, and in a sub-tab of its
    own below them, where under the facts it had got a 60 px plot at 1280 x 800 in Spanish. The gate holds that
    sub-tab to the view rules. A full matrix on that build passed 1,332 of 1,332; its captures showed the facts'
    column half empty beside a crowded comparison panel at 1600 x 900, so the comparison's two notes moved under
    the facts, and the first run after it caught "150 / µm" broken over two lines in the gap sentence, whose
    numbers now keep their units on their line. That build passed 1,332 of 1,332 again; the one-deployment
    change then rewrote the Implementation page's deployment topic, its release figure and the modal's text, and
    the final build passed 1,332 of 1,332, its captures of those views read.
- The documentation (review of 0.07.000, W-01 to W-57): every methodology page from 02 to 18 that quotes a record,
  the data contracts, guide 03 and the manuscript are read by claims tests; methodology pages 03, 12 and 13 had kept
  0.07 numbers and are current. Claims were checked against their primary sources on 2026-10-03: the phosphate
  review gives neither the desliming size nor the concentrate target the 0.07 pages cited it for, and the case now
  labels both authored. The sixteen Methodology figures are exported to `docs/svg/` and held to the app by a test;
  rendering them showed figure 15's labels overflowing in the app as well (added during 0.08, after the last gate
  run), and it was redrawn.

### Remote gate

Recorded after the deploy.

## 0.07.000, 2026-09-30

### Local gate

- The committed bake of 2026-09-30, in the new stage order (learning before the cases, which read its screen):
  - contract;
  - learning, 4082 s on CUDA (RTX 4070 Laptop GPU);
  - cases, 1293 s on 12 workers;
  - benchmark;
  - studies, 129 s;
  - real samples, 3 s;
  - manifests and validation.

  `validation.json` records `passed: true`. Other jobs shared the machine: an optimizer parity run, the Python
  suite and browser checks. The bake was made into a sandbox that held the measured lanes' records, then compared
  file by file with the development bake the page, document and manuscript numbers were drafted from:
  - the benchmark is equal in every optimization, kinetics, uncertainty, case, oracle and lane value, 3,935 in all;
  - the learning record is equal in every number but the timings and the random forest's last bits (1.5e-15
    relative); its MLP again stopped at epoch 1939, with the best at 1789;
  - the screen's export (`process_screen.json`, `process_gp_cholesky.bin`), the two networks and the scalers are
    byte-identical;
  - every record-driven claim and parity test passes on it: 15 files, 230 tests.

  It was adopted whole. The new records are `studies.json`, `real_samples.json` and the screen's export.
- `scripts/check_artifacts.py` gained a check that the benchmark's optimizer rows are the case records' own (status,
  evaluations, the screen's counts, the weight path). It passes on the committed records and names a tampered row.
- The full optimizer parity (`OF_PARITY=full`) passed on the committed records: 96 of 96 variants, in six processes
  of two cases each. A single process over all 96 had run out of its two hours at 90.
- The suites on the committed records: 490 Python tests passed, and 320 frontend tests passed without the optimizer
  parity (323 with its default subset). One test still pinned the 72-variant release's 288 distributions; it now
  takes the count from the index.
- `scripts/smoke.ps1` passed in 680 s: the eight guards (479 tracked files), the use-case page check
  (13 pages), ruff, 490 Python tests, the typecheck, 323 frontend tests and the production build.
- The SDD gate: the six 0.07 features left `Status: planned`. Before the change, the live rule was applied to them:
  two gates named a test that did not exist (CM-08) or had no path (PG-03), and both were fixed. Each feature's
  `tasks.md` now gives the convergence verdict, read from the runs' own outputs: 52 of 52 requirements met.
  `check_sdd.py` holds all 102 live requirements to gates that exist.
- The browser gate on the served build of the release candidate (bundle `index-Bu0WEtPq.js`):
  - the full matrix (1280x800, 1600x900 and 2560x1440; dark and light; English and Spanish) and the phone and
    tablet pass. The matrix includes, in every combination, the optimizer run, the uncertainty re-run, the grinding
    mode and both real sources, and the phone pass now opens every content tab;
  - 921 of 924 checks passed. The three that failed belong to the 1280x800 dark English combination: two
    Introduction figures whose text crossed its boxes, and a console error, `net::ERR_NO_BUFFER_SPACE`. They came
    while the frontend suite ran beside the gate. Re-checked alone, that combination passed 73 of 73, so the
    release's record is 924 of 924;
  - the earlier full runs on the release candidate found, and this release fixes:
    - the plant-hour Case view ran 61 px past its frame;
    - the source checks had never run (they waited for a closed select's options to be visible, and counted the
      chart's legend as a table);
    - the cut-mode equations were wider than their box at 1280 px;
    - a figure note and a Spanish label ran past their figures;
    - short versions read as decimals in Spanish prose.
  - At 390 px, 16 content tabs had scrolled the document sideways, and no gate looked: the phone pass visited the
    App route only. The tables now scroll inside their own boxes, and the pass opens every content tab.
- The static counts had drifted in this release: the architecture diagrams still said 72 variants, twelve inputs
  and COBYLA after the records had moved on. `frontend/src/test/static-counts.test.ts` now holds them to the contract
  and the index.
- The screenshots read:
  - the architecture modal's lanes tab at 1600x900 in light Spanish: the learning stage first, the screened
    optimizer, eight variants, the workers and the float64 screen;
  - the Methods view's optimizer at 1280x800 in dark Spanish: the six starts at one optimum, the weight control and
    the base against the optimum;
  - the grinding topic at 1280x800 in light English: the cut-mode equations on two lines inside their box;
  - the Benchmark optimization tab at 2560x1440 in light Spanish: the four tables, with the screen's cost by case
    and its totals equal to the text (23.535 against 21.692, +8,5%, 0,64 points, 63 of 72);
  - the plant-hour Case view at 1280x800 in dark English: the forecasts and their note whole, the sensors scrolling
    in their panel;
  - the content pages at 390x844: the tables scrolling in their boxes, with their captions above the rows.

### Remote gate

- PR #68 (the release) merged into `develop` at `a03c6c0`; CI `36805077515` passed. Promotion PR #69 merged into
  `main` at `23d88a482c9e7b049eb451ad946f5154a4105cb8`; CI `36805404016` and Pages `36805403981` passed for that commit,
  which carries the annotated tag `v0.07.000` and its GitHub release.
- **The ML VPS updated through `deploy/setup-vps.sh`.** The release's copy of the script ran from outside the
  checkout. It:
  - fast-forwarded the checkout from `ede51ff` to `23d88a4`, every requirement already present;
  - rebuilt the site with the bundle `index-Bu0WEtPq.js`, the local release build's hash;
  - restarted `oreflow.service` and passed its local checks (health 0.07.000, the catalog with the release's digest);
  - exited 0. Everything in the checkout is owned by `fasl`, except `.git/index`, which the verification's own
    `git status` had left to root, as in 0.06.000; it was returned to `fasl`.
- The external checks of architecture 05, from outside the build machine:
  1. `https://oreflow.ml.fasl-work.com/healthz` reported 0.07.000.
  2. `/api/cases` answered `oreflow.index/v2` with 12 cases and 96 variants of 0.07.000. `/api/benchmark` answered
     `oreflow.benchmark/v2` of the same version and contract digest (`bdb92360cd94`), with both measured-lane links.
  3. `POST /api/simulate` answered 200, `oreflow.live/v2`, lane `live-api`, for three states: the nominal states of
     the soft copper porphyry and the fine magnetite, and the soft porphyry's cut-mode variant, where `cut_mode` is
     1. Recovery matched the bake within 1.4e-14, and every balance closed (at most 1.0e-13 relative). A throughput
     of 50,000 t/h answered 422, `oreflow.rejection/v1`, code `out_of_range`.
  4. On both hosts the root, `/methodology/`, `/benchmark/`, `/implementation/`, `/introduction/` and
     `/experiments/` answered 200 with the app, and the routes without the slash and `/focus/copper_porphyry_soft`
     did so after one redirect. Pages serves the 0.07.000 records (12 cases, 96 variants, the same digest) and the
     screen's Cholesky factor (1,002,000 bytes).
  5. The browser gate with `OF_BASE` set to each public host passed 194 checks on the VPS and 194 on Pages. That is
     the smoke pair of combinations with the five content pages, and the phone and tablet pass in both themes and
     languages, which now opens every content tab. A phone capture of the live Benchmark in dark Spanish was read.
  6. The certificate for `oreflow.ml.fasl-work.com` names that host (CN and SAN), is issued by Let's Encrypt YE1,
     and is valid to 2026-12-12.
- Scientific boundary: the twelve cases are authored inside sourced ranges, not calibrated plants. The real-sample
  mode compares the engine with measured tests and does not calibrate it. The learned lane's held-out-case scores
  bound transfer between authored plants. The adversarial validation (#60) waits for Felipe's go-ahead, and his
  acceptance of the design (#62) is not recorded.

## 0.06.000, 2026-09-28

### Local gate

- The committed bake of 2026-09-28: contract, cases (517 s on 12 workers), learning (3180 s, CUDA, RTX 4070 Laptop GPU), benchmark, manifests and validation, while another job shared the machine; `validation.json` records `passed: true`. It was made into a sandbox that held the measured lanes' records, then compared file by file with the records it replaced:
  - the seven cases whose water limits moved differ only in that limit, their optimization records and their uncertainty probabilities;
  - the learning record is equal up to the random forest's last bits (at most 5e-15 relative) and two timings;
  - every model export is bit-identical;
  - the benchmark's links to the measured lanes, null in the intermediate record, are restored.

  It was adopted whole.
- `scripts/check_artifacts.py` gained the lane-link check, which fails the intermediate record on both lanes.
- `tests/test_case_rules.py` holds every case to its authoring rules:
  - every range names its source;
  - every nominal state lies inside its ranges and meets its grade spec;
  - every water capacity follows its rule.
- `tests/test_manuscript_claims.py` holds the manuscript to the records. Run against the 0.05.000 draft, it fails six of its seven tests.
- `scripts/smoke.ps1` passed in 103 s on the release candidate: the eight guards (408 tracked files), the use-case page check (13 pages), ruff, 364 Python tests, the typecheck, 174 frontend tests and the production build. Its first run on the candidate failed at the build: the run was launched with PowerShell's `*>` redirection inside the session, which turns vite's stderr notice into a terminating error. It passed when the output was redirected at the process level.
- Browser gate on the served build of the release candidate (bundle `index-Dxh7Rp0X.js`): 712 checks passed, none failed. That is the full matrix (1280x800, 1600x900 and 2560x1440; dark and light; English and Spanish) and the phone and tablet pass.
- The screenshots read:
  - the Case view's Context and Variants tabs at 2560x1440 in light Spanish: the sourced plausibility rows render under their KPIs, in Spanish, uncut;
  - the Benchmark uncertainty record at 1280x800 in dark Spanish: the text matches its table (82% for the soft porphyry and the free-milling gold, 53% for the magnetite, with its grade at 65% and its power at 79%).

### Remote gate

- PR #64 (the release) merged into `develop` at `a4f8b50`; CI `36490870532` passed. Promotion PR #65 merged into `main` at `2ba66cd4c2d04caf956ba327d9a59475d61c31d5`; CI `36490962086` and Pages `36490962087` passed for that commit, which carries the annotated tag `v0.06.000` and its GitHub release.
- **The ML VPS updated through `deploy/setup-vps.sh`, its first run as an update (#61).** The release's copy of the script ran from outside the checkout, so its own `git pull` could not rewrite the file bash was reading. It:
  - fast-forwarded the checkout from `fb00b90` to `2ba66cd`, installing no package;
  - rebuilt the site, with the bundle `index-Dxh7Rp0X.js`, the local release build's hash;
  - restarted `oreflow.service`, and its local health check retried through the refused connections of the restart;
  - exited 0. The checkout, the environment and the build are owned by `fasl`. The one root-owned file found afterwards, `.git/index`, came from the verification's own `git status` and was returned to `fasl`.
- The external checks of architecture 05, from outside the build machine:
  1. `https://oreflow.ml.fasl-work.com/healthz` reported 0.06.000.
  2. `/api/cases` answered `oreflow.index/v2` with 12 cases and 72 variants of 0.06.000, and `/api/benchmark` answered `oreflow.benchmark/v2` of the same version and contract digest, with both measured-lane links.
  3. `POST /api/simulate` for the nominal states of the soft copper porphyry and the fine magnetite answered 200, `oreflow.live/v2`, lane `live-api`. Recovery matched the bake within 1.4e-14, and every balance closed (at most 1.0e-13 relative). A throughput of 50,000 t/h answered 422, `oreflow.rejection/v1`, code `out_of_range`.
  4. On both hosts the root, `/methodology/`, `/benchmark/` and `/implementation/` answered 200 with the app, and `/methodology`, `/benchmark`, `/introduction`, `/experiments` and `/focus/copper_porphyry_soft` did so after one redirect. Pages serves 0.06.000 records under its base path.
  5. The browser gate with `OF_BASE` set to each public host (the smoke pair of combinations with the five content pages, and the phone and tablet pass in both themes and languages) passed 142 checks on the VPS and 142 on Pages. A phone capture of the live Case view was read.
  6. The certificate for `oreflow.ml.fasl-work.com` names that host (CN and SAN), is issued by Let's Encrypt YE1, and is valid to 2026-12-12.
- Scientific boundary: the twelve cases are authored inside sourced ranges, not calibrated plants. The engine is checked against published examples, not plant operation, and the learned lane's held-out-case scores bound transfer between authored plants. The audit's other gaps (#51 to #57) are 0.07.000. Felipe's acceptance of the design is not recorded.

## 0.05.001, 2026-09-26

### Local gate

- The committed bake of 0.05.001: contract, cases (686.7 s on 12 workers), learning (2106.0 s, CUDA, RTX 4070 Laptop GPU), benchmark, manifests and validation, run while browser checks shared the machine; `validation.json` records `passed: true`. It was made into a sandbox and compared file by file with the 0.05.000 records before it was adopted whole. Of the 38 tracked files under `data/derived` and `models`, 28 changed, and only in version, hash and byte fields (40), timings (8) and 94 random-forest scores (85 in `learning.json`, 9 in `benchmark.json`), at most 2.7e-15 relative. Every case number and ONNX export is identical, and the contract digest is unchanged.
- `scripts/smoke.ps1` passed in 161 s on the release commit: the eight guards (406 tracked files), the use-case page check (13 pages), ruff, 341 Python tests, the typecheck, 174 frontend tests and the production build.
- Browser gate on the served build of the release:
  - the full matrix, 684 checks (1280x800, 1600x900 and 2560x1440; dark and light; English and Spanish);
  - the phone and tablet pass, 28 checks;
  - the App and focus routes of the gold, magnetite and phosphate circuits at 1280x800 and 2560x1440, 40 checks each.
- The screenshots read:
  - on the release build, at 1280x800 in dark Spanish: every App view and sub-tab, and the focus route;
  - in dark English: the Grinding view and three Methods records;
  - at 1600x900 in light Spanish: the Circuit, Separation and Response views, both Case views, the learned lane and the focus route;
  - at 2560x1440 in dark English: the Grinding, Separation and Response views and every Methods record;
  - the Separation view of the gold, magnetite and phosphate circuits at 1280x800 in dark English and at 2560x1440 in light Spanish;
  - full view on a phone in Spanish: the Grinding view and the Optimizer record;
  - on the builds before it: every capture of every view and content page in dark Spanish at 1280x800, where the faults below were found.
- The first run of that set, on the release candidate (commit `8c17f93`), passed the matrix, the phone and tablet pass and the gold and phosphate circuits. It failed one check: the magnetite Separation facts at 1280x800, 0.29 full under the new text-panel floor. Reading that run's captures, and those of the builds after it, found faults the gate did not measure, most of them in Spanish at 1280x800. Three gate checks were added (`RAIL_PROBE`, `ELLIPSIS_PROBE`, `CANVAS_TEXT_PROBE`), and each failed the build before its fix. This release fixes:
  - text panels beside the charts from 1800 by 1000 px. At 2560x1440 the Methods panels measured 0.19 to 0.35 full, and the Grinding facts about a fifth (an estimate from the screenshot). They are now strips under the charts, 0.53 to 0.93 full. The gate fails a text panel its content fills less than 30%;
  - the magnetite Separation facts, 0.29 full beside the view's one chart at 1280x800. They are now a strip under it at every size, 0.71 full at 1280x800, and the chart grew from 0.31 to 0.41 of the viewport;
  - the rail, which cut every control's value at its edge ("720 t,", "8,0 r"). Its controls column took the width of the longest row. The column now stays within the rail, and a long control name wraps. `RAIL_PROBE` failed all ten App views on the build before this fix;
  - the readout's status, cut to "Dentro de todas las verif..." with no title. It is now "Sin avisos del motor", and a cut status or cursor reading carries its full text. `ELLIPSIS_PROBE` failed the status on all ten App views before this fix;
  - text on the charts' canvas that did not fit. The four Sobol factor names ran into each other, y titles longer than a short plot were cut at both ends ("Ganancia en metal recuperado (%)", "Error del guardia"), and level labels sat on data points ("nominal", "óptimo", "sin cambio"). Category labels now wrap to their category, the chart draws its y title wrapped to the plot's height, and a level's label takes the free place nearest the right end of its line. Each chart declares what it could not fit, and `CANVAS_TEXT_PROBE` fails any of it, and any visible chart that declared nothing. On the build before the declarations every chart was silent (15 views failed); squeezed to 220 px, the Sobol chart declares all four labels;
  - a phone chart's legend, which stood in a narrow column beside its title and left the size-distribution plot about 50 px tall. Below 860 px it runs under the title;
  - the Uncertainty histogram, which ranged its x axis on the bin centres and so cut its first and last bars in half. A bar chart on a numeric axis now reaches half a bin past them. Its bars keep their share of the bin at any width, where at 2560 px they had stopped at 64 px. The binning is tested over all 288 recorded distributions (the gate does not measure bar geometry);
  - the Optimizer headline, which gave the gain without its sign and read as the optimum's own recovered metal;
  - a failed build, which reported the Pages fallback's missing `index.html` instead of its own error.

### Remote gate

- PR #44 (the release) merged into `develop`; CI `36263362177` passed the scientific, contracts and frontend jobs. Promotion PR #45 merged into `main` at `8f6731ea4dd3d6540e92a137357c2947f59067a5`; CI `36263447054` and Pages `36263447073` passed for that commit, which carries the annotated tag `v0.05.001` and the GitHub release OreFlow v0.05.001.
- The ML VPS checkout fast-forwarded from `77e9d82` to `8f6731e`, installed the runtime requirements, built the site, returned the checkout to `fasl` and restarted the running `oreflow.service`. Its bundle, `index-nSDbod-P.js`, has the local release build's hash. The local `/healthz` reported 0.05.001, and the checkout read back clean.
- The external checks of architecture 05, from outside the build machine:
  1. `https://oreflow.ml.fasl-work.com/healthz` reported 0.05.001.
  2. `/api/cases` answered `oreflow.index/v2` with 12 cases and 72 variants of 0.05.001; `/api/benchmark` answered `oreflow.benchmark/v2` of 0.05.001 with the same contract digest.
  3. `POST /api/simulate` for the nominal states of the soft copper porphyry and the fine magnetite answered 200, `oreflow.live/v2`, lane `live-api`. Recovery equalled the bake within 1e-9 (5.7e-14 and 1.4e-14 apart), and every unit's balance closed (at most 1.0e-13 relative over 15 units, 4.2e-16 over 10). A throughput of 50,000 t/h answered 422, `oreflow.rejection/v1`, code `out_of_range`.
  4. On both hosts the root, `/methodology/`, `/benchmark/` and `/implementation/` answered 200 with the app. `/methodology`, `/benchmark`, `/introduction`, `/experiments` and `/focus/copper_porphyry_soft` did so after one redirect to their slash. The VPS serves the bundle `index-nSDbod-P.js`, and Pages its own build of the same commit.
  5. The browser gate with `OF_BASE` set to each public host (the smoke pair of combinations with the five content pages, and the phone and tablet pass in both themes and languages) passed 142 checks on the VPS and 142 on Pages.
  6. The certificate served for `oreflow.ml.fasl-work.com` names that host (CN and SAN), is issued by Let's Encrypt YE1, is valid to 2026-12-12 and verifies.
- Scientific boundary: unchanged from 0.05.000. The twelve cases are authored inside published ranges, not calibrated plants, and the learned lane's held-out-case scores bound transfer between authored plants. Felipe's acceptance of the design is not recorded.

## 0.05.000, 2026-09-26

### Local gate

- The committed bake of 2026-09-26: contract, cases (374.9 s on 12 workers), learning (1688.0 s, CUDA, RTX 4070 Laptop GPU), benchmark, manifests and validation; `validation.json` records `passed: true`. It is the re-run of the day's first bake after a catalog text correction (µm and P₂O₅), made into a sandbox and compared file by file before it was adopted whole: every case number is identical, the ONNX exports and the surrogate record are bit-identical, and the only numeric differences are 81 random-forest scores in `learning.json` and 9 in `benchmark.json`, at most 5.8e-15 relative. `scripts/check_artifacts.py` recomputes every unit balance of the 72 variants from the stored streams (within 1e-9), the contract digest, the byte counts and hashes of every artifact, and the method, learning, particle and GeoMet records.
- `scripts/smoke.ps1` passed in 89 s: the eight guards (template residue, content standards over 402 tracked files, CI budget, units, interface formulas, diagram languages and colours, SDD with 49 live requirements, artifacts), the use-case page check (13 pages), ruff, 341 Python tests, the typecheck, 165 frontend tests (the parity of all 72 variants within 1e-6 among them) and the production build.
- Browser gate on the served build of the release: the full matrix, 684 checks (1280x800, 1600x900 and 2560x1440; dark and light; English and Spanish), covering every view and sub-tab of the App route, the modal's five tabs, the focus route and its round trip, and every tab and sub-tab of the five content pages; the phone and tablet pass, 28 checks (both themes and both languages at 390x844 and 768x1024); and the App and focus routes of the gold, magnetite and phosphate circuits at 1280x800 and 2560x1440, 40 checks each. The screenshots were read: every Benchmark tab in all twelve combinations (as contact sheets); the Circuit view and the Case context in all four theme and language pairings at 1600x900, and the Circuit view at 390x844 and 768x1024 in light English and dark Spanish; every Methods record and the Response sweep in dark English and light Spanish at 1600x900; and further captures of every view at the other sizes while the defects above were found and fixed.
- The convergence verdict (`docs/design/features/process-engine-v2/tasks.md`, T23) runs the gate each of the 49 live requirements names: all 49 met.
- The full matrix and the checks added while it ran found, and this release fixes:
  - the case catalog, 1338 px wide at 1280x800 in Spanish;
  - the flowsheet, which stopped growing past a readable cell: at 2560x1440 it spanned 74.5% of its frame's width, and 73.4% on the focus route, while the gate's check of the svg's own box passed at 86.7%. It now scales as one piece, to 97.5%, and the gate measures the drawing against its frame;
  - with the drawing measured, the feed label under the readout column on the focus route at 1280x800, and the LIMS cleaner's concentrate and tail drawn along one line;
  - at phone width, the gate clause of PE-37 the desktop matrix did not cover: the rail's row shrunk to 61 px under its controls, flowsheet boxes overlapping (10 pairs in the copper circuit), a chart label over its axis; at 768 px in Spanish, the header's actions off the screen (shell known defect 10);
  - citation labels in English on Spanish pages (shell known defect 9), formulas without subscripts, "20 um" in the phosphate description, and the case provenance printed in English on the Spanish Case view (a scan of every view and page in Spanish for English words found nothing else);
  - the Benchmark uncertainty table, which needed 135 px of sideways scroll at 1280 px in Spanish, the Implementation gates table, widened past the page by its own new row, and the Response heatmap's ticks, which mixed precisions on one axis.

### Remote gate

- PR #36 (the release) and #37 (architecture 05's update steps) merged into `develop`; CI runs `36249347564` and `36249567624` passed the scientific, contracts and frontend jobs. Promotion PR #38 merged into `main` at `0d6245b3747f04097f25e6827924eab826e0971f`; CI `36249650821` and Pages `36249650834` passed for that commit, which carries the annotated tag `v0.05.000` and the GitHub release OreFlow v0.05.000.
- The ML VPS checkout fast-forwarded from `8897456` to `0d6245b`, installed the runtime requirements, built the site, returned the checkout to `fasl` and restarted the running `oreflow.service`; the local `/healthz` reported 0.05.000 and the checkout read back clean.
- The external checks of architecture 05, from outside the build machine:
  1. `https://oreflow.ml.fasl-work.com/healthz` reported 0.05.000.
  2. `/api/cases` answered `oreflow.index/v2` with 12 cases and 72 variants; `/api/benchmark` answered `oreflow.benchmark/v2` of 0.05.000 with the same contract digest.
  3. `POST /api/simulate` for the nominal states of the soft copper porphyry and the fine magnetite answered 200, `oreflow.live/v2`, lane `live-api`, with recovery equal to the bake within 1e-9 and every unit's balance closed (at most 1.0e-13 relative over 15 units, 4.2e-16 over 10); a throughput of 50,000 t/h answered 422, `oreflow.rejection/v1`, code `out_of_range`.
  4. On both hosts the root, `/methodology`, `/benchmark`, `/introduction` and `/experiments` (without the slash, after one redirect), `/methodology/`, `/benchmark/`, `/implementation/` and `/focus/copper_porphyry_soft` answered 200 with the app.
  5. The browser gate with `OF_BASE` set to each public host (the smoke pair of combinations with the five content pages, and the phone and tablet pass in both themes and languages) passed 142 checks on the VPS and 142 on Pages, and the captures were read. Its first VPS run failed only the architecture modal's tabs 2 to 5: the gate read the diagram before the next tab's diagram had arrived over the network (the capture shows it rendered), so the gate now waits for the tab's own diagram.
  6. The certificate served for `oreflow.ml.fasl-work.com` names that host (CN and SAN), is issued by Let's Encrypt YE1, is valid to 2026-12-12 and verifies.
- Scientific boundary: the twelve cases are authored inside published ranges, not calibrated plants; the learned lane's held-out-case scores bound transfer between authored plants. Felipe's acceptance of the design is not recorded.

## 0.04.000 and earlier

### Local scientific gate (0.04.000)

- Contract 1 validation: passed.
- Contract 2 artifact/index validation: passed.
- Coverage: 12 cases, 72 variants, 1,512 method records and 21 registered methods; check applicability separately.
- Python: Ruff passed and the full test suite passed.
- Data: HZDR RODARE workbook fetched, SHA256 recorded, and processed to an independent four-case particle benchmark; raw input remains ignored. The test sheet has constructed oracle probabilities but no realized test classes; case 4 has 663 rows excluded from the common finite comparison.
- Compute: PyTorch 2.12.0+cu126 executed a tensor operation and trained the circuit MLP, autoencoder and independent HZDR particle MLP on the local RTX 4070 Laptop GPU. `models/registry.json` records the simulator lane; the particle artifact independently records `device: cuda`. The particle ONNX export was tested against its local PyTorch checkpoint over 32 vectors (absolute/relative tolerance 0.000001) and exercised in a browser with changed feature inputs. This is local training evidence, not VPS GPU evidence.

### Local product gate (0.03.004 and 0.04.000)

#### 0.04.000 investigation and measured-data lane (2026-09-24)

- Local verification: all Python and frontend tests passed; Vite production build and Contract 2 artifact check passed. The GeoMet artifact is pinned to SHA256 `e7968c250c1ccc17b63da6d9624473dd92b32a7ba8d8772e70070a0115e42eda` and holds 52 eligible measured LCT rows, 29 holes, five whole-hole folds, three spatial-zone folds and four complete prediction matrices.
- Rendered interaction verification: EN/light and ES/dark at 390, 628, 1280 and 1600 px for the operating envelope, with no document overflow or JavaScript errors; constraint-empty state, reset, point selection, JSON download, apply-to-circuit, family switch and angular projection exercised. Measured Benchmark inspected at 390 and 1280 px with 52 rendered points, model/holdout switch and no document overflow/errors. Screenshots and JSON report are local ignored QA output.
- Local full-data GeoMet checkpoint and example five-assay CSV prediction smoke passed. Predictions are descriptive within this sparse source and are not plant set-points. The circuit simulator is still uncalibrated, and the four topology families remain a limitation.
- Remote CI, Pages, VPS HTTPS and live-browser verification are recorded below. Engineering verification does not establish user design acceptance or plant validity.

#### 0.03.004 focus and flowsheet correction (2026-09-24)

- Shared focus layout was added to `@fasl-work/caos-app-shell` and the OreFlow route uses it outside the document shell. The normal workbench retains its scientific routes and tabs; the flowsheet is again the primary circuit visual with explicit stream values.
- Click-through QA in the local browser: App focus entry opened the selected copper-molybdenum case; feed rate changed 640 to 800 t/h and updated readouts; Return restored the same case and 800 t/h. The focus case picker changed to free-milling gold and displayed a distinct gravity/rougher branch. Phone width 390 px, both themes and Spanish labels were inspected. This is local browser evidence, not production or user design acceptance.
- Full multi-route production QA and Felipe's visual acceptance remain release gates. The 12 authored cases are not 12 distinct topologies: they currently fall into rougher, gravity/rougher, magnetic and deslime/rougher families.
- Production phone inspection of 0.03.002 found an empty CSS grid row under the flowsheet after hiding the obsolete stage tabs. 0.03.003 removed that row; a 390 px live browser check confirmed the panel fills its available space.
- 0.03.004 changes the focus classifier description from "measured" to "calculated" streams, preserving the simulator-truth boundary.

The record of the 0.03.004 candidate continues with the checks below; it does not say whether they were repeated
for 0.03.002 and 0.03.003.

- TypeScript typecheck: passed.
- Frontend unit tests: passed.
- Vite production build: passed.
- Rendered checks before promotion: workbench circuit topology for rougher and magnetite, five-stage magnetic replay advancing and stopping, 390 px single-row shell header/footer, and browser ONNX inference with changed input vector inspected. Full six-route EN/ES/light/dark and production checks remain release gates, not inferred from these local checks.
- API smoke: health, catalog, benchmark and validated simulation returned successful responses.

### Remote gate (0.04.000)

The remote gate is complete only after the public GitHub repository, GitHub Pages project site and `oreflow.ml.fasl-work.com` VPS service have each been checked from outside the local workspace. The deploy script performs health and catalog checks, while the operator record must include the final commit, workflow run and live URLs.

#### 0.04.000, 2026-09-24

- Feature PR #28 and content-standard correction #29 merged into `develop`; CI run `36006829137` passed scientific, contracts and frontend jobs. Promotion PR #30 merged into `main` at `f30f40406dfcb9a96b82c44ab294d80a882c51a7`; CI `36006937653` and Pages `36006937745` passed.
- A live health readback exposed a stale hard-coded API version. Corrective PR #31 merged into `develop` with CI `36007403877` passing; promotion PR #32 merged into final `main` commit `4c35fbc231602a40c2fc494dd070305c0d0c9099`. CI `36007515696` and Pages `36007515772` passed for that exact SHA.
- The ML VPS checkout fast-forwarded to `4c35fbc231602a40c2fc494dd070305c0d0c9099`, built the frontend and restarted the active `oreflow.service`. Public HTTPS `/`, `/methodology`, `/benchmark` and the compact GeoMet artifact returned 200; `/healthz` reported `0.04.000`. A public `/api/simulate` request for the magnetic case returned `oreflow.live/v1`, positive magnetic recovery and zero flotation recovery.
- Rendered public-domain QA at 390, 628, 1280 and 1600 px repeated the constraint, selection, export, apply-to-circuit, topology switch, projection and bilingual/theme interactions with no document overflow or browser errors. The measured Benchmark showed 52 points at 390 and 1280 px. Pages passed the same rendered interaction script. At 390 px, each of Introduction, Methodology, Implementation, Experiments and Benchmark scrolled within its fixed shell, and mobile Focus mode opened on the selected scenario.
- Remaining scientific boundary: no external operating-control/plant-metallurgy campaign calibrates the four circuit families. Measured GeoMet LCT prediction and simulator operating-point analysis must remain separate; this release is not a validated plant decision system. User visual acceptance remains open.
