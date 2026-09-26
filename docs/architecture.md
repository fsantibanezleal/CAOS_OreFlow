# Architecture

How OreFlow is put together: one Python engine, an offline bake that writes versioned artifacts, a
line-by-line TypeScript port that recomputes every state in the browser, a small service that runs
the Python engine behind the same contract, and the gates that hold them to each other.

![What runs where](../frontend/public/svg/tech/02-lanes.svg)

| Page | What it covers |
|---|---|
| [01 The system](architecture/01_system.md) | What OreFlow is and is not, the four places the engine runs, and the documents every hand-off goes through |
| [02 The bake](architecture/02_bake-pipeline.md) | The six stages that turn the engine and the case catalog into the committed artifacts; determinism, parallelism, what cannot ship |
| [03 The browser engine](architecture/03_browser-engine.md) | The TypeScript port, how it stays faithful to the Python engine, its parity gates, the worker sweeps and the learned lane in the browser |
| [04 The web app](architecture/04_web-app.md) | The routes, the workbench loop, the views, the focus route, the content pages and the architecture modal, with their gates |
| [05 Release and deployment](architecture/05_release-and-deployment.md) | CI, the branch flow, the GitHub Pages build, the VPS service and how a release is checked from outside |

The same material, drawn, is the in-app architecture modal (the header's information button); its
five diagrams live in `frontend/public/svg/tech/` and carry both languages in one file.
