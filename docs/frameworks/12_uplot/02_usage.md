# uPlot: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## What the host adds (`components/charts/Chart.tsx`)

uPlot draws; the host decides everything a reader relies on, the same way on every chart:

| Concern | What the host does | Why |
|---|---|---|
| Colour | series and marks take a named colour (`accent`, `good`, `warn`, `magenta`...), resolved from the shell's CSS tokens; the plot is rebuilt when the theme changes | a hard-coded colour ignores the theme; one palette across every chart |
| Size | the plot takes its size from its container and follows it with a `ResizeObserver` | a width fixed at authoring time either overflows or wastes the stage |
| Reading | `legend: { show: false }`; a `setCursor` hook reports the index, the x value and every series' value to the view's readout row | uPlot's own legend sits below the plot and a sized host clips it (shell known defect 3); every instrument reports to one place |
| Ticks | tick labels through `formatTick`, in the interface language, with the decimals the tick spacing needs; a logarithmic axis spans the data, not whole decades | PE-35; a log axis padded to decades wastes half the plot |
| Series | a legend of buttons, one per series, that hide and show it (`setSeries`) | comparing curves means switching them off |
| Zoom | drag across the plot to zoom the x range; a reset button and Escape restore it | reading a knee in a size distribution needs a closer x range |
| Keyboard | with the chart focused, the arrow keys move the cursor sample by sample | a reading without a mouse |
| Marks | vertical marks at an x value for what the engine computed (a cut, a target, a liberation size) and horizontal levels at a y value for a limit (a specification, the base case), labels stacked when they would overprint | the chart says where the engine's own numbers sit on the curve |
| Categories | an axis of named categories (inputs, starts, variants) with one tick per category, and paired bars side by side | method records compare named things, not a continuum |
| Point labels | the points of the first series can carry names (a case on a map of cases); a label that would overlap one already drawn is left to the cursor reading | twelve cases on one scatter stay readable |
| Accessibility | the canvas is an image named after the chart, and a visually hidden table carries the plotted values | a screen reader gets the numbers, not a picture |

## Rebuilds that do not reset the cursor

A plot is created in an effect and destroyed in its cleanup. The effect depends on the data, the series
and the marks by value, through serialized keys, not on the arrays' identity: a parent passes fresh
array literals on every render, and depending on their identity would rebuild the plot continuously and
reset the cursor before a reading could settle (the second defect recorded under shell known defect 3).

## Where the data comes from

A chart receives `uPlot.AlignedData` (an x array and one array per series) built by the view from the
trace or from a baked record. The host never computes a quantity: unit conversions for display (a
fraction shown as a percentage) are marked `// not-engine:` where they happen, and
`trace-curves.test.ts` checks, on every baked variant, that every value the grinding and separation
charts plot is a number of the trace, copied, reversed or in a display unit.

## The heatmap (`components/charts/Heatmap.tsx`)

The decision surface of the Response view is a metric over two inputs: cells coloured in viridis (ten
equal steps, interpolated; never jet or rainbow), each constraint's zero-slack boundary traced as a
labelled line, rejected states hatched grey, and the baked optimum and the current state marked. Hovering
or the arrow keys report the cell under the pointer to the same readout row as the line charts. Its
values come from the worker sweep; like the host, it computes nothing of its own.
