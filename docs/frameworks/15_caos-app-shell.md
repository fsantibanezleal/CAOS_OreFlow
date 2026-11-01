# 15 The CAOS app shell

`@fasl-work/caos-app-shell` supplies OreFlow's shared header, navigation, theme and language
controls, footer, architecture modal, workbench layout, focus surface and content primitives.
The shell also owns document language, navigation overflow fades and architecture-toggle theming.
OreFlow composes these with its process controls, views and engine state. lucide-react supplies the
Pickaxe product mark. The guide describes the installed release and the current product source.

## At a glance

| | |
|---|---|
| Packages | `@fasl-work/caos-app-shell`, `lucide-react` |
| Versions | npm `0.19.11` (release `v0.19.011`), `1.43.0` |
| Licences | MIT, ISC |
| Declared in | `frontend/package.json`, exact npm pin `"@fasl-work/caos-app-shell": "0.19.11"` |
| Locked in | `frontend/package-lock.json`, registry tarball URL and SHA-512 integrity |
| Configured in | `frontend/src/main.tsx`, `frontend/src/content/architecture.ts` |
| Layout and focus | `WorkbenchLayout`, `FocusShell`, `useFocusMode` |
| Styles | shared `styles.css`, then `workbench/workbench.css` and `frontend/src/content/content.css` |

## Read in order

1. [Installation](15_caos-app-shell/01_installation.md): the npm pin, lockfile, stylesheet and peers.
2. [Usage in OreFlow](15_caos-app-shell/02_usage.md): containment, routes, composition, citations and
   the customizations actually present.
3. [Applying it](15_caos-app-shell/03_applying.md): adopting another release and checking the result.

Related: [all frameworks](../frameworks.md), [10 React](10_react.md), [12 uPlot](12_uplot.md),
[13 KaTeX](13_katex.md), [14 Playwright](14_playwright.md),
[architecture 04](../architecture/04_web-app.md).
