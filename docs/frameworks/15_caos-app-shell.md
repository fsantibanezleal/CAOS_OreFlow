# 15 The CAOS app shell

`@fasl-work/caos-app-shell` is the design system every public app of the CAOS line shares: the header
and navigation, the theme and language toggles, the footer, the page body, tabs and sub-tabs, the case
selector, the focus layout, the architecture modal, and the equation, callout, figure and reference
blocks. OreFlow adopts it whole and builds nothing the shell provides. Where the shell has a defect,
OreFlow applies the override the line's shared register prescribes, names the defect next to the
override, and a gate checks it. lucide-react supplies the product mark in the header.

## At a glance

| | |
|---|---|
| Packages | `@fasl-work/caos-app-shell`, `lucide-react` |
| Versions | 0.6.11 (the Git tag `v0.06.011`), 1.43.0 |
| Licences | MIT, ISC |
| Declared in | `frontend/package.json`: `"@fasl-work/caos-app-shell": "github:fsantibanezleal/CAOS_APP_SHELL#v0.06.011"` |
| Configured in | `frontend/src/main.tsx` (the `ShellConfig`), `frontend/src/content/architecture.ts` (the modal) |
| Peers it expects | React 18 or 19, react-router 6 to 8, zustand 4 or 5, KaTeX 0.16, lucide-react 0.400 or later |
| Defect register | `conventions/shell-known-defects.md` in the management repository |

## Read in order

1. [Installation](15_caos-app-shell/01_installation.md): the Git pin, the stylesheet, the peers.
2. [Usage in OreFlow](15_caos-app-shell/02_usage.md): the configuration, the components used, and every
   override with the defect it answers and the gate that checks it.
3. [Applying it](15_caos-app-shell/03_applying.md): upgrading the pin, and what to do on finding a new
   shell defect.

Related: [10 React](10_react.md), [12 uPlot](12_uplot.md), [13 KaTeX](13_katex.md),
[14 Playwright](14_playwright.md), [architecture 04](../architecture/04_web-app.md).
