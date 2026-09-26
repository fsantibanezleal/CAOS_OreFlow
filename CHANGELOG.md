# Changelog

## [0.05.001] - 2026-09-26

A patch of 0.05.000. The charts get the surface that text panels left empty, the Uncertainty histogram
draws its end bars whole, and a failed build reports its own error.

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
- On a phone a chart's legend stood in a narrow column beside its title: six series took six lines and
  left the size-distribution plot about 50 px tall, too short for its title. Below 860 px the legend
  runs under the title, across the chart.

  Each chart declares on its host what it could not fit (`data-ticks-cut`, `data-title-cut`,
  `data-labels-over`), and the gate fails any, and any visible chart that declared nothing
  (`CANVAS_TEXT_PROBE`).
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

## 0.04.000, 2026-09-24

- Added a case-aware operating-envelope investigation: explicit feasible limits, declared perturbation stress, finite-grid Pareto classification, point inspection, baseline comparison, apply-to-circuit and reproducible JSON export.
- Added an independent measured GeoMet locked-cycle recovery lane from pinned CC BY 4.0 source data: 52 usable tests from 29 holes, whole-hole and spatial-zone holdouts, four evaluated baselines/models, rendered observed-versus-predicted and spatial diagnostics.
- Added local, checksummed five-assay CSV inference with a full-data checkpoint and out-of-reference-range flags. Measured inference and circuit simulation remain separate; neither is a calibrated plant set-point predictor.
- Added feature-level software design contracts, automated artifact/numerical/browser gates and responsive EN/ES light/dark visual QA at phone, tablet and desktop viewports.

## 0.03.001, 2026-09-24

- Preserve and validate process family at the live API boundary. Requests for known authored cases infer their gravity, magnetic, desliming or rougher path when the family field is omitted; explicit unsupported families are rejected.

## 0.03.000, 2026-09-24

- Rebuilt the contained workbench around selectable, mass-linked circuit operations and an explicit walkthrough with playback, stage selection and local-versus-baked state.
- Added distinct gravity/rougher, magnetite magnetic-separation and phosphate-desliming process paths alongside generic rougher scenarios; exported applicability status for 21 method records in all 72 variants.
- Added process-family-specific controls, size-by-size classification and magnetic views, a material-balance diagram, and method-applicability evidence visualization.
- Recomputed the artifact matrix and ONNX exports with local CUDA training; the public browser remains a simulator explorer, not a plant predictor.
- Added an independent HZDR particle-learning lane with original-sheet train/test separation, L1 and CUDA-capable MLP models, common-row missingness handling, calibration and threshold artifacts, and on-demand browser ONNX inference. Constructed probabilities are not plant recovery.
- Reworked research pages, assumptions, sources and mobile workbench access. Pinned CAOS App Shell v0.06.009 for a single-row mobile header and footer.

## 0.02.001, 2026-09-23

- Version and bypass browser caches for baked artifact requests, preventing old case JSON from persisting after a shell deployment.

## 0.02.000, 2026-09-23

- Rebuilt the fixed-viewport instrument: quantitative circuit, response curves, selectable grind-by-collector decision surface, method-specific plots, variant comparison and mobile control view. Added bilingual linked readouts and light/dark responsive layouts.
- Corrected the classifier to partition size-bin masses, normalized the overflow cumulative distribution, connected classifier split to overall recovery and capped concentrate mass pull by rougher feed.
- Recomputed all 12 cases, 72 variants and 1,368 method records; neural models were trained with CUDA on the local RTX 4070 Laptop GPU. Added browser/Python parity checks, classifier sensitivity tests and separate autoencoder reconstruction diagnostics.
- Replaced unsupported plant, uncertainty and OOD claims with explicit simulator-only interpretation, and revised the manuscript as a proposed transfer study rather than a completed novel result.
- Repaired direct document-route serving on the VPS and GitHub Pages; project-site builds now carry the correct base path and a 404 fallback document.
- Emit real GitHub Pages route files so direct document links return HTTP 200, not merely rendered fallback content with status 404.

## 0.01.000, 2026-09-13

- Initial OreFlow release with six-route visual workbench, 12 x 6 case matrix, 19 process and learned methods, HZDR source summary, reproducible pipeline, manuscript proposal, GitHub Pages workflow and ML VPS service files.
