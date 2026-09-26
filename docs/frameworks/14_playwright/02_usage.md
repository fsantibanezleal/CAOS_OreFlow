# Playwright: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The matrix

| Variable | Default | Meaning |
|---|---|---|
| `OF_BASE` | `http://127.0.0.1:4914` | the site under test; a public URL checks a deployment |
| `OF_MATRIX` | smoke | `full` runs 1280x800, 1600x900 and 2560x1440, each in dark and light, English and Spanish (12 combinations); the smoke run is 1280x800 dark English and 1600x900 light Spanish; `none` runs the phone and tablet pass alone |
| `OF_ONLY` | none | combinations of the full matrix to re-check after a fix (`1280x800-dark-es,2560x1440-light-en`); a name outside the matrix stops the run, and the phone and tablet pass is off unless `OF_SMALL` names combinations |
| `OF_SMALL` | `390x844-light-en,390x844-dark-es,768x1024-light-en,768x1024-dark-es` | the phone and tablet pass after the matrix, both themes and languages at each size; empty for none |
| `OF_CASE` | `copper_porphyry_soft` | the case the workbench opens on |
| `OF_PAGES` | all five | the content pages to walk; empty for none |
| `OF_QA` | `qa-output` | where the screenshots and `gate.json` go |

Each combination is a fresh browser context whose theme and language are set in local storage before the
page loads, so the first paint is already in that theme and language.

## What one combination does

1. **The workbench.** Opens the App route, checks that the gate's view list matches the tab bar, then
   visits every view, every Case sub-tab and every Methods record, runs the response sweep and the learned
   lane, and measures each state.
2. **The architecture modal.** Opens it from the header, visits every tab, and checks each diagram.
3. **The focus route.** Enters it by clicking, measures the stage, leaves by clicking, and compares the
   case, the variant and the changed controls with the state it left.
4. **The content pages.** Every top tab and every sub-tab of every page, running the in-browser network
   where a page offers it.
5. **The console.** Any error logged or thrown anywhere fails the combination.

## The probes, and how each was proved

A probe that cannot fail is worse than none: it reports a pass for a defect. Each probe below was run
against a state with the defect and seen to fail, then against the fixed state and seen to pass.

| Probe | Measures | Proved against |
|---|---|---|
| `OVERFLOW_PROBE` | every visible element's box against the viewport, except inside a deliberate horizontal scroll area | the compare table that overflowed; the screen-reader tables that widened the page |
| `CLIP_PROBE` | every element inside a sized view against the view's own box, unless a scroll area inside owns it | content clipped out of reach inside views |
| cut equations | every `.katex-display` wider than its box | 15 formulas that could only be read by scrolling inside them |
| `FIGURE_PROBE`, boxes | a text touching a figure's box without fitting inside it, or leaving the figure | labels crossing box outlines, a translation longer than its box |
| `FIGURE_PROBE`, strokes | every curve, marker and edge sampled every two pixels; a sample inside a label's core | five labels crossed by lines, found when the check was added |
| `ARCH_PROBE` | in the modal: the diagram inlined, only the interface language's text visible, every text inside the diagram and inside any box it touches | a gate that measured English twice and reported a bilingual pass |
| `LOCALE_PROBE` | on Spanish pages, a visible number with a decimal point that is not point grouping or a version; inside an equation, any decimal point | six findings on one Methodology sub-tab before the fix, none after |
| document scroll | a content page taller than the viewport must move on `scrollTo` | the shell's defect re-imposed: 0 px moved, the document height pinned to the viewport |
| document height | the larger of `<html>`'s and `<body>`'s scroll height against the viewport | an App-route check that read the pinned height and could never fail |
| view list | the gate's list of views against the app's tab bar | (structural: a new view added to the app would otherwise never be measured) |
| scroll tables | on a content page at the gated desktop sizes, any table whose scroll box needs a sideways scroll | the uncertainty table, 135 px wider than its box at 1280x800 in Spanish |
| text panels | on the App route, each text panel beside the charts (facts, tables, notes): the extent of its content against its height, at least 0.3 | at 2560x1440 the Grinding facts filled about a fifth of their cell and the Methods tables a fifth to a third of their column; at 1280x800 the magnetite Separation facts filled 0.29 of theirs |
| `RAIL_PROBE` | every visible element of the workbench and focus rails against the rail's content box | in Spanish at 1280x800 the longest control row widened the whole controls column, and the rail cut every value at its edge ("720 t,", "8,0 r") on all ten App views |
| `CANVAS_TEXT_PROBE` | what each chart declares on its host about the text on its canvas, which no page probe can read: category labels that do not fit their category once wrapped (`data-ticks-cut`), a y title too long for its axis in two lines (`data-title-cut`) and level labels with no free place beside the data (`data-labels-over`); every chart declares its title, so a visible chart that declared nothing has not drawn, and fails | in Spanish at 1280x800 the four Sobol factor names ran into each other, "Ganancia en metal recuperado (%)" and "Error del guardia" were cut at both ends, and "nominal" sat on a data point; squeezed to 220 px, the fixed Sobol chart declares all four labels |
| `ELLIPSIS_PROBE` | every element an ellipsis actually cuts must carry its full text in its `title` | in Spanish at 1280x800 the readout's status was cut to "Dentro de todas las verif..." with nothing to read it by |
| flowsheet drawing | the union of the drawn units, streams and labels against the svg's frame (its box less the overlay inset the diagram declares, at most a quarter of each axis): at least 90% on the limiting axis, and inside the frame | at 2560x1440 the circuit spanned 74.5% of its frame's width and half its height, and the focus view 73.4%, while the svg element's own box passed the 80% check at 86.7% |

The App route additionally requires one row of tabs, a rail that fits without scrolling, the active view
at least half the viewport, `<html lang>` equal to the interface language; the focus route requires the
stage and its largest chart to cover at least 80% of the viewport. Both require the flowsheet drawing
check wherever the flowsheet is on the stage.

A phone and tablet pass follows the matrix (`OF_SMALL`: both themes and both languages at 390x844 and
768x1024 by default, empty for none). Below 860 px the rail stacks above the instrument and the page body scrolls, so the
fixed-surface measures do not apply; every view must instead keep the rail whole and clear of the
readout, keep its controls inside it (`RAIL_PROBE`) and every cut text named (`ELLIPSIS_PROBE`), keep the document from scrolling sideways, keep every element inside the viewport unless it
sits in its own scroll box (the readout, the tab row and a phone's flowsheet scroll sideways), and draw
the flowsheet with no unit box over another. Its first run found the rail shrunk to 61 px under its
controls, overlapping flowsheet boxes on a phone, and, at 768 px in Spanish, the header's actions off
the screen (shell known defect 10).

## Outputs

`gate.json` records every check with its measurements (so a pass shows its margin, not just its verdict),
and one screenshot per state: `circuit-1280x800-dark-en.png`, `methods-3-...`, `architecture-2-...`,
`methodology-2-1-...` and so on. Content pages are captured full height. The last line of the run is
`GATE PASSED: <n> checks` or the number of failures, and the exit code follows it.
