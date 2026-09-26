# Playwright: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.

## Checking a deployment

The same gate runs against a public host:

```powershell
$env:OF_BASE = 'https://oreflow.ml.fasl-work.com'; node gate.mjs
$env:OF_BASE = 'https://fsantibanezleal.github.io/CAOS_OreFlow'; node gate.mjs
```

A deployment check measures what readers get: the artifacts the host serves, its caching, its deep-link
handling. Run it after both hosts deploy the same commit, and read its screenshots as well.

## Writing a probe that can fail

1. **Name the defect first**, then measure the thing itself. "The page does not scroll sideways" is
   measured on element boxes, not on `document.scrollWidth`, which the shell's scroll container pins to the
   viewport.
2. **Reproduce the failure.** Before trusting a probe, run it on a state that has the defect (an older
   build, a style re-imposed with `page.addStyleTag`, a value injected into the DOM) and see it fail. A
   probe that has never failed has not been tested.
3. **Report measurements, not only verdicts.** Put the numbers in the record (`{ moved: 1200, tall: true }`),
   so a pass by a small margin is visible.
4. **Scope it.** Exclude what is legitimately exempt (screen-reader tables, KaTeX's MathML copy, uPlot's
   cursor overlays, a reference list) by class, in the probe, with the reason in a comment.
5. **Keep it cheap.** A probe runs on every state of every combination; sample strokes every two pixels,
   stop after the first few findings.

## Reading the screenshots

The probes find the defects they were written for. They do not judge whether a chart shows the right
thing, whether a label says something sensible, or whether a layout is good; a person reading the
screenshots does. For a release, read at least every view and sub-tab in one light and one dark
combination, the Spanish ones included, and every screenshot a probe flagged.

## Traps

- **Waiting for the right thing.** Wait for the element that proves the state has settled (a chart's
  canvas, the end of a sweep's progress, the absence of a loading status), not for a fixed time.
- **A local server is not the deployment.** Caching, redirects between `/route` and `/route/`, and
  compression differ; check the public host too.
- **One browser at a time on a busy machine.** Two gates, or a gate and a bake, compete for the CPU and
  turn timing waits into flaky failures.
- **Stop what you start.** The gate does not start the preview server; whoever starts it stops it.
