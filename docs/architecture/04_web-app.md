# 04 The web app

![The web app: what the build copies, the routes, the workbench loop and the content pages](../../frontend/public/svg/tech/03-web-app.svg)

The interface is a React and Vite single-page app on the shared CAOS shell
(`@fasl-work/caos-app-shell`, pinned to a release tag in `frontend/package.json`). The shell owns the
header, the navigation, the theme and language toggles, the footer, the case selector, the tabs and
sub-tabs, the equation, callout, figure and reference blocks, the focus layout and the architecture
modal; OreFlow supplies the configuration and the content (`frontend/src/main.tsx`). Nothing the shell
provides is rebuilt locally.

## What the build copies

`frontend/copy-data.mjs` runs before the dev server and before every build. It empties and refills
three folders of `frontend/public/`, so a file the bake no longer writes can never ship from an older
copy:

| Target | Source |
|---|---|
| `data/` | `data/derived/` whole: the contract and its probes, the twelve case artifacts, the manifests and the index, the learning record, the benchmark, the validation record and the two measured lanes |
| `models/` | every `.onnx` network in `models/` with its scaler document |
| `ort/` | the onnxruntime-web WebAssembly runtime, served once instead of a second hashed copy in the bundle |

The copy refuses to run without `manifests/index.json`, so a checkout without a bake cannot build a
site that loads nothing. Every artifact request carries the app version as a query parameter and
bypasses the browser cache (`frontend/src/lib/artifacts.ts`), so a deploy never reads a record cached
from the previous release. The version shown in the footer and sent with those requests is the root
`VERSION` file, read at build time, the same file the engine stamps on every artifact.

## Routes

| Route | What it holds | Loading |
|---|---|---|
| `/` | The workbench (Laboratorio in Spanish), the only viewport-sized route (`fixedRoutes`, ADR-0071) | With the app |
| `/focus/:caseId` | One instrument on the stage, rendered outside the shell's header | On first use |
| `/introduction`, `/methodology`, `/implementation`, `/experiments`, `/benchmark` | The content pages, which keep the document scroll | On first use |
| any other path | The workbench | With the app |

On GitHub Pages the app lives under `/CAOS_OreFlow/` and the router takes that base; on the VPS it is
served from the root. Pages answers a deep link with the app only where a file exists, so the build
writes a copy of `index.html` for every route and for the focus route of every baked case
(`frontend/vite.config.ts`).

## The workbench loop

1. The case index, the contract and the benchmark load once per page; the benchmark is optional and
   only feeds the Compare sub-tab.
2. The state lives in a small store (`frontend/src/workbench/state.ts`, zustand) and travels in the
   URL: `?case=`, `?variant=`, `?set=` for the controls changed from the variant, and `?view=`. The
   URL is applied once, when the page opens; after that it mirrors the store with a replace, so the
   back button leaves the page instead of undoing a slider, and a state can be shared as a link.
3. The case artifact loads per case; a reply for a case the user has already left is dropped.
4. Every point is validated against the contract before the engine sees it. A rejected value shows
   the contract's message, in the interface language, next to its control.
5. An accepted point goes to the Web Worker with the case's ore and plant definitions and comes back
   as a trace. A newer state supersedes an evaluation still on its way, so a dragged slider never
   queues stale traces.
6. The views draw the trace. Nothing in the interface computes an engine quantity (see
   [03 The browser engine](03_browser-engine.md) for the gates that hold this).

## The rail and the readout

The rail holds the shell's case selector, the variant, the case's question and the contract's controls
for the case's family, in three sections shown one at a time so the rail never scrolls
(`frontend/src/workbench/Rail.tsx`):

| Section | Inputs |
|---|---|
| Feed | throughput, work index, head grade, crusher closed-side setting |
| Classification | target P80, circulating load, water |
| Separation | collector dose, superficial gas velocity, rougher cells, gravity bleed, desliming cut |

The readout is one row that never wraps: recovery, concentrate grade, total specific energy, P80 and
mill power, every engine flag, and, at the end, the reading of whichever chart has the cursor, so every
instrument reports to the same place.

## The views

| View | What it draws | Requirement |
|---|---|---|
| Circuit | The flowsheet from the trace's topology, every stream's flow and grade on the stage, and for the selected unit its input and output streams with its closure error from the independent audit. The drawing spans the stage on its limiting axis at every viewport: one scale per axis up to a readable cell, then the whole drawing, text included, scaled by one factor (`fit` in `flowsheet.ts`); on a stage narrower than the narrowest readable cell (a phone) the drawing keeps that cell and scrolls sideways in its panel | PE-37 |
| Grinding | Size distributions of the circuit streams, the cyclone partition, the liberation of each valuable mineral and the host-limited composite scale, with the target, the cut and the liberation sizes marked where the engine put them | PE-36 |
| Separation | By family: the rougher recovery by size, the grade-recovery curve down the bank and the kinetic record (batch curve, five fits, their bank projections); the magnetic capture by particle class; the desliming partition | PE-36 |
| Response | A metric against one contract input, or over two inputs as a decision surface with the grade-specification and installed-power boundaries, the current state and the baked optimum marked; computed in the worker only when asked | PE-38 |
| Methods | The variant's method records as sub-tabs: the optimizer, the uncertainty record, the Sobol indices (nominal state) and the learned lane, which runs the exported surrogate and guard in the browser | PE-39 (the learned lane) |
| Case | The case's context in a fixed order (problem, components and variables, formalization, scope and assumptions, what each variant shows, how to read the views) and the comparison of its six single-factor variants, with the twelve cases on one map of recovery against specific energy | PE-40 (the context), PE-32 (the variants) |

On a large screen (from 1800 by 1000 px) a text panel beside the charts would stand mostly empty, so it
becomes a strip under them, as tall as its content: the Grinding facts, the magnetite Separation facts
and the Methods records' tables and notes; the flotation Separation panel, which holds the kinetic table
as well, does so from 2200 by 1200 px. The last chart of a two-by-two grid then spans both columns.

Each view's panel is keyed by the case, so a choice that only makes sense for one case, such as an
input or a factor, never carries over to another.

## The focus route

The focus route (ADR-0070) uses the shell's focus layout: one instrument fills the stage (the
flowsheet, any single chart of the grinding or separation views, or the response sweep), the headline
metrics form the display on top, the stage is labelled with the state the circuit is in, and the rail
holds the controls with a basic and an advanced set. The grinding and separation views build their
charts with `grindingCharts` and `separationCharts`, which the focus route reuses, so a chart on the
stage is the same object as in the view. Entering and leaving keep the case, the variant, the view and
every changed control, because the state travels in the URL.

## Charts and figures

- `frontend/src/components/charts/Chart.tsx` is the one uPlot host every line chart mounts through:
  colours from the shell tokens, re-read on a theme change; a size taken from its own observed box;
  tick labels in the interface language; a legend whose entries hide and show their series; drag to
  zoom and Escape to reset; arrow keys to move the cursor; marks for what the engine computed (a cut,
  a target) and levels for limits (a specification, a threshold).
- `Heatmap.tsx` draws a decision surface in viridis, with each constraint's zero-slack boundary as a
  labelled line, rejected states hatched and the optimum and the current state marked.
- Both carry a screen-reader table of the plotted values.
- Equations are KaTeX. Schematic figures are hand-drawn SVG built from shared parts
  (`frontend/src/content/figures.tsx`) and themed through the shell's tokens.

## The content pages

Each page is a `DocPage` with top-level tabs and vertical sub-tabs (`frontend/src/content/doc.tsx`).
A topic is data: its paragraphs, its governing equations, a limitations callout, a parameter table, a
figure, the results it reads from the committed records, and its own references, all in both
languages. A narrow figure sits beside the prose with the limitations under it; a wide one leads.

| Page | Tabs |
|---|---|
| Introduction | What it is, Approach, The cases, Scope and evidence, Using it |
| Methodology | Streams and conservation, Comminution, Classification and separation, Method records |
| Implementation | The system, Engine and port, The bake, Contracts and artifacts, What runs where, Gates and release |
| Experiments | Design and coverage, Metrics, What the variants did, Protocols |
| Benchmark | Published examples, Method records, Learned lane, Measured lanes |

A number on a page is read from the committed records at run time, never retyped: `useArtifact`
loads a record and `Loaded` shows a status while it arrives and an alert if it fails
(`frontend/src/content/data.tsx`). Where the prose states a result, a claims test reads the same record
and fails when the two disagree (`case-claims.test.ts`, `experiments-claims.test.ts`,
`benchmark-claims.test.ts`). The Measured lanes tab runs the particle network in the browser on request,
with sliders bounded by the training data's 1st and 99th percentiles.

## The architecture modal

The header's information button opens the architecture modal (ADR-0058) with five tabs: the app, what
runs where, the web app, the science and the data contracts (`frontend/src/content/architecture.ts`).
Each diagram (`frontend/public/svg/tech/`) carries both languages in one file, as `l-en` and `l-es`
text pairs at identical coordinates plus `l-neutral` text for symbols and numbers, and is drawn with the
shell's colour tokens with CSS system colours as the fallback, so it stays readable when opened on its
own. `scripts/check_arch_i18n.py` rejects an untagged text, a text without its counterpart at the same
coordinates, a Spanish text identical to its English one, and any colour that is not a shell token with
a system-colour fallback.

## Language

Every string of the interface exists in English and Spanish (`frontend/src/lib/i18n.ts`); English is
the default. Numbers are formatted in the active locale (a decimal comma in Spanish,
`locale.test.ts`), and `DocumentLanguage` writes the interface language to `<html lang>` on every
route, including the focus route that renders outside the shell.

## Gates

`frontend/gate.mjs` drives a served build in Chromium. For each combination of viewport, theme and
language (two by default; `OF_MATRIX=full` runs 1280x800, 1600x900 and 2560x1440 in both themes and
both languages) it:

- visits every view, every Case sub-tab and every Methods record, runs the response sweep and the
  learned lane, and measures what ADR-0071 binds: no document scroll in either direction, no element
  outside the viewport and none clipped out of reach inside the view, no equation wider than its box,
  a rail that shows its own controls, one row of tabs, the active view at least half the viewport,
  `<html lang>` equal to the interface language, every text panel beside the charts at least 30% filled
  by its content, and, where the flowsheet is on the stage, what it drew
  (units, streams and labels) across at least 90% of its frame on the limiting axis and inside it: the
  svg element always fills its host, so its own box says nothing about the drawing;
- opens the architecture modal and checks every tab: the diagram inlined, only the interface
  language's text shown, every text inside the diagram and inside any box it touches;
- enters the focus route by clicking, requires the stage and its largest chart to cover at least 80%
  of the viewport and the drawn flowsheet to fill its frame as above (the frame is the stage less the
  overlay inset the diagram declares, bounded to a quarter of each axis), and returns by clicking to
  the same case, variant and changed controls;
- opens every tab and sub-tab of every content page and requires no sideways overflow, the interface
  language, no KaTeX error, no cut equation, no table that needs its scroll box at these sizes, no failed
  record load and no figure text outside its box or across a box it does not fit, running the in-browser
  network where a page offers it;
- at 390x844 and 768x1024 in both themes and languages, where the rail stacks above the instrument and
  the page body scrolls, visits every view and requires the rail whole and clear of the readout, no
  sideways document scroll, no element outside the viewport except inside its own scroll box, and no
  flowsheet unit box over another;
- fails on any console error, and writes a screenshot of every state and the measurements
  (`gate.json`) to `qa-output/`, which git ignores.

The screenshots are read, not only counted: a gate that passes can still measure the wrong element.
