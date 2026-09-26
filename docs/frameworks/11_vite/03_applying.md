# Vite, TypeScript and Vitest: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.

## Adding a frontend test

Tests live in `frontend/src/test/` and run in Node. A test that checks a committed record reads it the
way the others do:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Optimization = Record<string, Record<string, { status: string }>>;   // case -> variant -> record
const benchmark = JSON.parse(readFileSync(fileURLToPath(new URL('../../../data/derived/benchmark.json', import.meta.url)), 'utf-8')) as { optimization: Optimization };

describe('the Benchmark page', () => {
  it('states how many variants the optimizer solved', () => {
    const records = Object.values(benchmark.optimization).flatMap(variants => Object.values(variants));
    expect(records).toHaveLength(72);
    expect(records.filter(r => r.status === 'optimal')).toHaveLength(70);     // the page says 70 of the 72
  });
});
```

The claims tests follow exactly this shape (`benchmark-claims.test.ts` makes this very check, and names
the two magnetite variants that fail): the page's sentence and the record meet in one assertion, so a
re-bake that changes the number fails the test until the sentence is corrected.

A test of a component draws nothing: the views export the functions that build their chart elements,
and `trace-curves.test.ts` inspects those, mocking `uplot` itself (`vi.mock('uplot', ...)`), which needs a
canvas Node does not have.

## Changing where the site is served

The base path is a build input, never a code change: `VITE_BASE_PATH=/some/path/ npm run build`. Then
check three things, which break together when the base is wrong:

1. artifact requests use `import.meta.env.BASE_URL` (`lib/artifacts.ts`), never an absolute `/data/...`;
2. the router's `basename` matches (see `main.tsx`);
3. the host answers deep links: GitHub Pages through the plugin's per-route `index.html`, a server
   through a fallback like the service's `SpaStaticFiles`.

Probe both `/route` and `/route/` on the real host: Pages redirects one to the other, and a relative URL
that works on one breaks on the other.

## Traps of a static build

- **The browser caches `index.html` and the data.** Every artifact request carries the version and
  `cache: 'no-store'`, so a deployment cannot pair a new page with an old record.
- **`public/` is copied, not processed.** Anything placed there ships as it is and is served at the root
  of the base path; that is why the overlay empties it first.
- **Importing outside `frontend/`** (the engine's JSON files, the `VERSION` file) works in the dev server
  because `vite.config.ts` sets `server.fs.allow` to the repository root and nothing wider: those files
  are served, and a file outside the repository is refused with `403 Restricted` (checked both ways).
  The build is not affected by the setting; the dev server is.
- **The type check is part of the build.** `npm run build` runs `tsc --noEmit` first; a build that skips it
  can ship a type error that Vite's transpiler ignores.
