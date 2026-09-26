# 12 uPlot

uPlot draws every line, scatter and bar chart in OreFlow: size distributions, partition curves, recovery
by size, the grade-recovery curve down the bank, the kinetic fits, the response sweeps, the method records
and the benchmark comparisons. It is fast (a canvas, no DOM per point), small, and gives a cursor, zoom
and series toggles that a reader can use to read a value off a curve. Every chart mounts through one host
component, `frontend/src/components/charts/Chart.tsx`, so a fix to how charts behave lands once. The
decision surface is the exception: it is a plain canvas heatmap (`Heatmap.tsx`), since a colour grid with
constraint lines is not a series chart.

## At a glance

| | |
|---|---|
| Package | `uplot` |
| Version | 1.6.32 |
| Licence | MIT |
| Declared in | `frontend/package.json` |
| Host | `frontend/src/components/charts/Chart.tsx` (and `inset.ts` for overlays) |
| Users | 11 component files across the workbench views, the method records and the content pages |
| Rules | the interactive-visualization rubric of the product line; shell known defect 3 (uPlot's legend is clipped in a sized host) |

## Read in order

1. [Installation](12_uplot/01_installation.md): the pin and the stylesheet.
2. [Usage in OreFlow](12_uplot/02_usage.md): what the host does on top of uPlot, and why each piece is
   there.
3. [Applying it](12_uplot/03_applying.md): drawing a new chart through the host, and the traps.

No `example.py`: the charts are exercised by `trace-curves.test.ts` (what they plot) and by the browser
gate (how they render).

Related: [10 React](10_react.md), [architecture 04](../architecture/04_web-app.md).
