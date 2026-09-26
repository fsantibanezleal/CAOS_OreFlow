# Vite, TypeScript and Vitest: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The data overlay (`frontend/copy-data.mjs`)

Before the dev server and before every build, the script empties and refills three folders under
`frontend/public/`, which Vite serves as they are:

- `data/` from `data/derived/` (the contract, the case artifacts, the manifests and the index, the
  learning record, the benchmark, the validation record and the measured lanes);
- `models/` with the `.onnx` networks and their `.json` scalers;
- `ort/` with the onnxruntime-web WebAssembly runtime.

Emptying first means a file the bake no longer writes cannot ship from an older copy. The folders are
ignored by git: the committed copies live in `data/derived/` and `models/` only.

## Imports that tie the port to the Python engine

The TypeScript engine does not keep copies of the Python engine's data; it imports the same files at
build time:

```ts
import constantsDoc from '../../../data-pipeline/pipeline/engine/data/constants.json';
import atomicDoc from '../../../data-pipeline/pipeline/engine/data/atomic_weights.json';
import mineralsDoc from '../../../data-pipeline/pipeline/engine/data/minerals.json';
import laguerre from '../../../data/derived/contract/operating_contract.json';     // the quadrature table
```

and the release version the same way (`lib/version.ts`):

```ts
import version from '../../../VERSION?raw';
```

A constant changed in the Python engine is therefore changed in the browser at the next build, and the
parity test says whether the two still agree. For the dev server to serve these files from outside
`frontend/`, `vite.config.ts` allows it the repository root (`server.fs.allow`), and nothing wider.

## The engine in a worker

```ts
worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
```

Vite recognizes the `new URL(..., import.meta.url)` pattern and bundles `engine/worker.ts` and the
whole engine into their own module (`worker-*.js`, about 94 KB), loaded on the first evaluation.

## The build condition for the ONNX runtime (`vite.config.ts`)

```ts
resolve: {
  dedupe: ['react', 'react-dom', 'react-router', 'zustand'],
  conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
},
```

The condition selects onnxruntime-web's build that loads its WebAssembly from `ort/` (served by the
overlay) instead of embedding a second, hashed 14 MB copy in the bundle.

## The Pages plugin (`spa-pages-fallback`)

GitHub Pages answers a deep link with a page only where a file exists. After the bundle is written, the
plugin copies `index.html` to `404.html` and to `<route>/index.html` for each content page and for the
focus route of every baked case (read from `data/derived/manifests/index.json`), so
`/methodology` and `/focus/copper_porphyry_soft` load the app with status 200. The Pages workflow checks
that those files exist before it publishes.

## Code splitting

The content pages and the focus route are separate chunks (React's `lazy`), and so are the worker and
the ONNX runtime loader. The main chunk (the shell, React, the workbench, uPlot, KaTeX) is about 780 KB,
250 KB compressed, which is why Vite prints its chunk-size notice; the workbench needs all of it on
first paint.

## The test suites (Vitest, `environment: 'node'`)

| File | Tests | Verifies |
|---|---|---|
| `parity.test.ts` | 72 | PE-31: every baked variant re-simulated by the port matches within 1e-6 relative |
| `surrogate.test.ts` | 13 | PE-39: features, predictions and the guard's verdict against the bake's reference |
| `trace-curves.test.ts` | 12 | PE-36: every plotted value of the grinding and separation charts is a trace number |
| `flowsheet.test.ts` | 24 | PE-37: per case, on every variant, each unit of the trace in its own cell, each product a terminal, each recycle the circuit has drawn as a recycle edge, a record behind every labelled stream, and no two streams along a shared stretch of line; and ADR-0071: on seven stages from a phone to 4K, with and without the focus overlay inset, the drawing spans its frame on the limiting axis, stays inside it and centred, and never shrinks its text (with the scale pinned to 1 all twelve cases fail: the copper circuits span 76.3% of the 2560 stage's width, the gold and magnetite circuits 97.7% of a 1300 by 700 one) |
| `case-claims.test.ts` | 10 | the case contexts' stated numbers against the artifacts |
| `experiments-claims.test.ts` | 8 | the Experiments page's statements against the records |
| `benchmark-claims.test.ts` | 6 | the Benchmark page's statements against the records |
| `locale.test.ts` | 9 | PE-35: number formatting, the authored-value and TeX localization, chemical formulas with subscripts, the citations' Spanish labels with every record kept verbatim, and the provenance of every case record in Spanish |
| `tex-language.test.ts` | 3 | every formula of the pages and the Case view: one written once carries no word, one written twice differs between the languages |
| `worker-sweeps.test.ts` | 4 | PE-38: sweeps stream, cancel and supersede in the worker module |
| `sweep.test.ts` | 2 | the sweep grid validates every state and never simulates a rejected one |
| `contract.test.ts` | 2 | PE-30: the browser validator replays all 719 probe verdicts |

They read the committed files directly (`node:fs` and JSON imports), so the suite needs no server and
no browser; the whole run takes about 4 seconds.
