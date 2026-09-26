# uPlot: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.

## Drawing a new chart

Use the host, never `new uPlot` in a view:

```tsx
const es = lang === 'es';
<Chart
  data={[sizes, feedPassing, productPassing] as uPlot.AlignedData}   // x first, then one array per series
  series={[{ label: es ? 'alimentación' : 'feed', colour: 'subtle' }, { label: es ? 'producto' : 'product', colour: 'accent' }]}
  xLabel={es ? 'tamaño (µm)' : 'size (µm)'} yLabel={es ? 'pasante acumulado (%)' : 'cumulative passing (%)'} logX
  summary={es ? 'Distribución de tamaño de la alimentación y del producto' : 'Size distribution of the feed and the product'}
  marks={[{ x: trace.metrics.p80_um, label: 'P80' }]}
  onCursor={onCursor}
/>
```

The props are `ChartProps` in `Chart.tsx`: `data`, `series`, `xLabel`, `yLabel` and `summary` (the one
sentence a screen reader hears) are required; `title`, `marks`, `levels`, `categories`, `pointLabels`,
`logX`, `logY`, `yRange`, `onCursor` and `format` are optional. In the product, labels come from the
string tables in `lib/i18n.ts` rather than inline literals.

- Build the arrays from the trace or a baked record; if the chart needs a quantity neither holds, the
  engine is where it belongs.
- Give every series a label in the interface language; the legend and the screen-reader table use it.
- Put the chart in a container that has a size; the host fills it and follows it.
- Pass `onCursor` so the reading appears in the readout row.
- Mark what the engine computed and the limits that apply, at their values.

## Choosing the chart for the data

| Data | Chart |
|---|---|
| A distribution over size | lines on a log x axis, cumulative passing |
| A partition or a recovery by size | lines on a log x axis, 0 to 100% |
| A response to one input | a line with the current state and the baked optimum marked |
| A metric over two inputs | the heatmap, with constraint boundaries |
| Named alternatives (fits, starts, variants) | bars on a categorical axis |
| Cases against two metrics | a scatter with point labels |

## Traps

- **Do not depend on array identity** in an effect that builds a plot; depend on a serialized key of the
  values, or the plot rebuilds on every render.
- **A logarithmic axis needs positive data.** Filter or mark empty classes (`null`), as the engine does
  below its declared share floor, instead of passing zeros.
- **`null` is a gap, `0` is a value.** uPlot draws a gap at `null`; a zero where a value is undefined draws a
  false curve.
- **An x range that never spans** (all x equal) leaves uPlot with nothing to scale; the gate's screenshots
  catch a blank chart that a green build does not.
- **Colours only through the named tokens**, or the chart stays light in the dark theme.
