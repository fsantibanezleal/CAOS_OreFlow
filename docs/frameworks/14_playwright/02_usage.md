# Playwright: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The matrix

| Variable | Default | Meaning |
|---|---|---|
| `OF_BASE` | `http://127.0.0.1:4914` | the site under test; a public URL checks a deployment |
| `OF_MATRIX` | smoke | `full` runs 1280x800, 1600x900 and 2560x1440, each in dark and light, English and Spanish (12 combinations); the smoke run is 1280x800 dark English and 1600x900 light Spanish |
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
| flowsheet drawing | the union of the drawn units, streams and labels against the svg's frame (its box less the overlay inset the diagram declares, at most a quarter of each axis): at least 90% on the limiting axis, and inside the frame | at 2560x1440 the circuit spanned 74.5% of its frame's width and half its height, and the focus view 73.4%, while the svg element's own box passed the 80% check at 86.7% |

The App route additionally requires one row of tabs, a rail that fits without scrolling, the active view
at least half the viewport, `<html lang>` equal to the interface language; the focus route requires the
stage and its largest chart to cover at least 80% of the viewport. Both require the flowsheet drawing
check wherever the flowsheet is on the stage.

## Outputs

`gate.json` records every check with its measurements (so a pass shows its margin, not just its verdict),
and one screenshot per state: `circuit-1280x800-dark-en.png`, `methods-3-...`, `architecture-2-...`,
`methodology-2-1-...` and so on. Content pages are captured full height. The last line of the run is
`GATE PASSED: <n> checks` or the number of failures, and the exit code follows it.
