# The CAOS app shell: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../15_caos-app-shell.md](../15_caos-app-shell.md).

## The pin

```json
"@fasl-work/caos-app-shell": "github:fsantibanezleal/CAOS_APP_SHELL#v0.06.011",
"lucide-react": "1.43.0"
```

The shell is installed from its Git repository at a release tag, not from the npm registry: the tag names
an exact, reviewed release (package version 0.6.11), and `package-lock.json` records the commit it
resolved to. `npm ci` fetches it like any other dependency; the repository is public.

## Stylesheet and peers

```ts
import "@fasl-work/caos-app-shell/styles.css";
```

is imported once, first, in `main.tsx`; OreFlow's own stylesheets (`workbench/workbench.css`,
`content/content.css`) come after it, so an override placed there wins by order, not by specificity.

The shell declares React, react-dom, react-router, zustand, KaTeX and lucide-react as peer dependencies;
the product pins each, and `vite.config.ts` dedupes React, react-dom, react-router and zustand so the shell
and the product use one copy.
