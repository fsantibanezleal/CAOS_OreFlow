# 11 Vite, TypeScript and Vitest

Vite builds and serves OreFlow's interface; TypeScript is the language of the interface and of the
browser port of the engine; Vitest runs the frontend's 147 tests, the parity of the port with the
Python engine first among them. Vite also carries three things specific to OreFlow: the data overlay
that puts the committed artifacts next to the site, the build condition that serves the ONNX runtime
once, and the plugin that writes an `index.html` for every route GitHub Pages must answer.

## At a glance

| | |
|---|---|
| Packages | `vite`, `@vitejs/plugin-react`, `typescript`, `vitest` |
| Versions | 8.2.2, 6.1.1, 7.0.2, 5.0.0 |
| Licences | MIT, MIT, Apache-2.0, MIT |
| Declared in | `frontend/package.json` (devDependencies) |
| Configuration | `frontend/vite.config.ts` (build, dev server, test environment), `frontend/tsconfig.json` |
| Scripts | `dev` (127.0.0.1:5914), `typecheck`, `test`, `build`, `preview` (127.0.0.1:4914), `gate` |
| Tests | 11 files, 147 tests, about 4 s |

## Read in order

1. [Installation](11_vite/01_installation.md): the pins, Node, and the npm scripts.
2. [Usage in OreFlow](11_vite/02_usage.md): the data overlay, the build condition, the Pages plugin, the
   imports that tie the port to the Python engine's files, the worker, and the test suites.
3. [Applying it](11_vite/03_applying.md): adding a test, changing the base path, and the traps of a
   static build.

This node has no `example.py`; its runnable companion is `npm run test`.

Related: [10 React](10_react.md), [06 ONNX](06_onnx.md), [architecture 03](../architecture/03_browser-engine.md)
and [04](../architecture/04_web-app.md).
