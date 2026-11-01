# The CAOS app shell: installation

Read order: **you are on 01**, then [02 Usage](02_usage.md) and [03 Applying](03_applying.md).
Return to [15 The CAOS app shell](../15_caos-app-shell.md).

## The exact npm pin

The dependency entries in `frontend/package.json` are:

```json
"@fasl-work/caos-app-shell": "0.19.11",
"lucide-react": "1.43.0"
```

The installed shell's package version is `0.19.11`; its `VERSION` file says `0.19.011`, corresponding
to release `v0.19.011`. The dependency has no caret or tilde. `frontend/package-lock.json` records
version `0.19.11`, the resolved registry tarball
`https://registry.npmjs.org/@fasl-work/caos-app-shell/-/caos-app-shell-0.19.11.tgz`, and its SHA-512
integrity value. The lockfile is part of the installation contract.

From `frontend/`, install the locked dependency graph with:

```powershell
npm ci
```

`npm ci` requires agreement between the manifest and lockfile, installs the locked graph and verifies
package integrity. It does not select a newer shell release. Updating the pin and lockfile is a
separate adoption step, described in [03 Applying](03_applying.md).

## Stylesheet and peers

`frontend/src/main.tsx` imports the shared stylesheet before either product stylesheet:

```ts
import "@fasl-work/caos-app-shell/styles.css";
import "./workbench/workbench.css";
import "./content/content.css";
```

The public stylesheet resolves to the package-root `styles.css`; the JavaScript and TypeScript
entry points resolve to `dist/index.js` and `dist/index.d.ts`. Read these installed files when
checking an API or a claimed defect. Later product styles participate in the normal cascade;
source order alone does not defeat a more specific rule or an `!important` declaration.

The installed peer ranges are React and react-dom 18 or 19, react-router 6 to 8, zustand 4 or 5,
KaTeX 0.16 to 0.19, and lucide-react at least 0.400. Playwright at least 1.40 and uPlot `^1.6.30`
are optional peers. OreFlow declares these packages itself. `frontend/vite.config.ts` deduplicates
React, react-dom, react-router and zustand so the product and shell share their instances.
