# React: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../10_react.md](../10_react.md).

## The pins

`frontend/package.json` (dependencies, exact versions):

```json
"react": "19.3.0",
"react-dom": "19.3.0",
"react-router": "8.3.1",
"zustand": "5.0.15"
```

The shared shell declares React 18 or 19, react-router 6 to 8 and zustand 4 or 5 as peer dependencies,
so the product's pins are the ones used; `vite.config.ts` dedupes `react`, `react-dom`, `react-router` and
`zustand`, so the shell and the product resolve one copy of each (two copies of React in one page break
its hooks).

## Installing and running

Node 22 (the CI and the VPS use 22; `package.json` requires 20 or later):

```powershell
cd frontend
npm ci                   # exactly what package-lock.json records
npm run dev              # copies the baked data, then Vite on http://127.0.0.1:5914
```

`npm run dev` first runs `copy-data.mjs` ([11 Vite](../11_vite.md)); without a bake in `data/derived/`
it stops with a message instead of starting a site that loads nothing. `scripts/dev.ps1` does the same
from the repository root.
