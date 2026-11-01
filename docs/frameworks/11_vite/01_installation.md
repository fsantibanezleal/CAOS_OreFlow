# Vite, TypeScript and Vitest: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../11_vite.md](../11_vite.md).

## The pins

`frontend/package.json` (devDependencies, exact versions):

```json
"@vitejs/plugin-react": "6.1.1",
"typescript": "7.0.2",
"vite": "8.3.5",
"vitest": "5.0.5"
```

with `@types/node` and `@types/react` for the type checker and `playwright` for the gate
([14](../14_playwright.md)). The product declares Node 20 or later (`engines`); CI and the VPS build with
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
| `npm run preview` | serves `frontend/dist` on `127.0.0.1:4914` while developing; a release gate runs against the service on the same port ([14](../14_playwright.md)) |
| `npm run gate` | `node scripts/gate.mjs`, the installed shared-shell gate against the build |
| `npm run gate:oreflow` | `node gate.mjs`, the product's process and interaction matrix against the served build ([14](../14_playwright.md)) |

The site is built for the root, as its one host, the VPS, serves it.

## TypeScript settings (`frontend/tsconfig.json`)

`strict`, `noEmit` (Vite compiles; TypeScript only checks), `moduleResolution: "Bundler"`,
`resolveJsonModule` (the port imports the Python engine's JSON files), `jsx: "react-jsx"` and the
`vite/client` and `node` types (for `import.meta.env`, `?raw` imports and the test files' use of
`node:fs`).
