# uPlot: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../12_uplot.md](../12_uplot.md).

```json
"uplot": "1.6.32"
```

It installs with the frontend (`npm ci` in `frontend/`). The host imports the library and its
stylesheet once:

```ts
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
```

uPlot has no dependencies and ships its own TypeScript types (`uPlot.Options`, `uPlot.Series`,
`uPlot.AlignedData`). It needs a canvas, so the tests that inspect chart elements mock it
(`vi.mock('uplot', () => ({ default: class {} }))`) and check the data handed to it instead of drawing.
