# Vite, TypeScript and Vitest: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../11_vite.md](../11_vite.md).

## The pins

`frontend/package.json` (devDependencies, exact versions):

```json
"@vitejs/plugin-react": "6.1.1",
"typescript": "7.0.2",
"vite": "8.2.2",
"vitest": "5.0.0"
```

with `@types/node` and `@types/react` for the type checker and `playwright` for the gate
([14](../14_playwright.md)). Node 20 or later is required (`engines`); CI, Pages and the VPS build with
Node 22.

## Installing

```powershell
cd frontend
npm ci
```

`npm ci` installs exactly `package-lock.json`; use `npm install <package>@<version>` only to change a
pin, and commit the lock file with it.

## The scripts

| Script | Does |
|---|---|
| `npm run dev` | `copy-data.mjs`, then the dev server on `127.0.0.1:5914` (`--strictPort`: it fails rather than move) |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `vite.config.ts` |
| `npm run test` | `vitest run`, once, in Node |
| `npm run build` | typecheck, `copy-data.mjs`, `vite build` into `frontend/dist` |
| `npm run preview` | serves `frontend/dist` on `127.0.0.1:4914`, where the gate expects it |
| `npm run gate` | `node gate.mjs` against the served build ([14](../14_playwright.md)) |

`VITE_BASE_PATH=/CAOS_OreFlow/` before `npm run build` makes the Pages build; without it the site is
built for the root, as the VPS serves it.

## TypeScript settings (`frontend/tsconfig.json`)

`strict`, `noEmit` (Vite compiles; TypeScript only checks), `moduleResolution: "Bundler"`,
`resolveJsonModule` (the port imports the Python engine's JSON files), `jsx: "react-jsx"` and the
`vite/client` and `node` types (for `import.meta.env`, `?raw` imports and the test files' use of
`node:fs`).
