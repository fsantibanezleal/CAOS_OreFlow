# 14 Playwright

Playwright drives a real Chromium through OreFlow's built site for the browser gate, `frontend/gate.mjs`.
The gate clicks through every view, sub-tab, content page and modal tab in several viewports, both themes
and both languages, measures what the interface rules bind (nothing outside the viewport, nothing clipped,
no cut equation, figure labels clear of their lines, numbers in the page's language), exercises the sweeps
and the in-browser networks, and saves a screenshot of every state for a person to read. A green build
says the code compiles; the gate says what a reader would see.

## At a glance

| | |
|---|---|
| Package | `playwright` (the library, not the test runner) |
| Version | 1.61.0 |
| Licence | Apache-2.0 |
| Declared in | `frontend/package.json` (devDependencies) |
| Script | `frontend/gate.mjs`, run with `npm run gate` or `node gate.mjs` against a served build |
| Browser | Chromium (headless shell), one per run |
| Output | `gate.json` and a PNG per state in `OF_QA` (default `frontend/qa-output/`, ignored by git) |

## Read in order

1. [Installation](14_playwright/01_installation.md): the pin, the browser download and where it goes.
2. [Usage in OreFlow](14_playwright/02_usage.md): the matrix, every probe and what it measures, the
   variables, and the checks that were proved both ways.
3. [Applying it](14_playwright/03_applying.md): running the gate against a deployment, writing a probe
   that can fail, and reading the screenshots.

The gate itself is the runnable companion of this node.

Related: [architecture 04](../architecture/04_web-app.md) (what the gate measures, from the app's side),
[15 The CAOS app shell](15_caos-app-shell.md) (the shell defects some probes guard against).
