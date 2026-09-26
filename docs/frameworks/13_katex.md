# 13 KaTeX

KaTeX typesets every equation OreFlow shows: the governing equations of each Methodology topic, the
formulas of the Implementation, Experiments and Benchmark topics, and the family's formulas in the
workbench's Case view. It renders TeX to HTML with its own fonts, synchronously and without a server, so an
equation looks the same on GitHub Pages and on the VPS. OreFlow never calls KaTeX directly: the shared
shell's `Equation` component does, and OreFlow supplies the TeX.

## At a glance

| | |
|---|---|
| Package | `katex` |
| Version | 0.16.47 |
| Licence | MIT |
| Declared in | `frontend/package.json` (the shell declares `katex ^0.16.0` as a peer) |
| Rendering | the shell's `Equation` (`@fasl-work/caos-app-shell`), from `content/doc.tsx` and `workbench/views/CaseView.tsx` |
| Sources of TeX | the topics in `frontend/src/content/`, and `content/equations.ts` for the Case view |
| Gates | `frontend/src/test/tex-language.test.ts`; the browser gate's KaTeX-error and cut-equation checks |

## Read in order

1. [Installation](13_katex/01_installation.md): the pin, the peer, the fonts.
2. [Usage in OreFlow](13_katex/02_usage.md): formulas in two languages, decimals, stacking to fit, and the
   checks.
3. [Applying it](13_katex/03_applying.md): writing a new equation that passes them.

No `example.py`: the equations are checked by the test and the gate above.

Related: [15 The CAOS app shell](15_caos-app-shell.md), the [methodologies](../methodologies.md), which
hold the same equations in Markdown.
