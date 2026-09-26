# 10 React

React draws OreFlow's interface: the workbench, the focus route and the content pages, all inside the
shared CAOS shell ([15](15_caos-app-shell.md)). react-router maps the routes, zustand holds the workbench
state, and the state travels in the URL so a view can be shared as a link. React components draw what
the engine's trace says; the engine itself runs in a Web Worker and is not a React concern.

## At a glance

| | |
|---|---|
| Packages | `react`, `react-dom`, `react-router`, `zustand` |
| Versions | 19.3.0, 19.3.0, 8.3.1, 5.0.15 |
| Licence | MIT (all four) |
| Declared in | `frontend/package.json` (pinned exact versions; the shell declares them as peers) |
| Entry | `frontend/src/main.tsx` |
| State | `frontend/src/workbench/state.ts` (zustand), mirrored in the URL |
| Rules enforced | `scripts/check_ui_formulas.py`: no engine arithmetic or solver import in a component; sweeps only from a click |

## Read in order

1. [Installation](10_react/01_installation.md): the pins, the peers, the dev server.
2. [Usage in OreFlow](10_react/02_usage.md): the routes and lazy pages, the workbench loop in hooks, the
   store and the URL, and how stale answers are dropped.
3. [Applying it](10_react/03_applying.md): adding a view or a content topic, and the rules that keep a
   component honest.

This node has no `example.py`: the frontend's runnable companions are its Vitest suites
([11](11_vite.md)) and the browser gate ([14](14_playwright.md)).

Related: [architecture 04](../architecture/04_web-app.md), [12 uPlot](12_uplot.md), [13 KaTeX](13_katex.md).
