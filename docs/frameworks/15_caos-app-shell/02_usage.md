# The CAOS app shell: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## The configuration (`frontend/src/main.tsx`)

```tsx
const config: ShellConfig = {
  product: { name: "OreFlow", mark: <Pickaxe size={18} /> },
  version: APP_VERSION,                       // the root VERSION file
  fixedRoutes: ["/"],                         // only the workbench is a viewport-sized surface (ADR-0071)
  architecture: ARCHITECTURE,                 // the modal's five tabs (ADR-0058)
  routes: [{ path: "/", en: "Workbench", es: "Laboratorio" }, ...],
  links: { github: "https://github.com/fsantibanezleal/CAOS_OreFlow" },
  footer: { attribution, license, provenance, disclaimer },   // each in both languages
};
```

`applyTheme(readTheme())` runs before the first render, so the page paints in the stored theme, and
`CitationsProvider` supplies the reference list the `Refs` blocks cite from.

## The components used

| From the shell | Where |
|---|---|
| `AppShell`, `ShellConfig`, `applyTheme`, `readTheme`, `CitationsProvider` | `main.tsx` |
| `useShellLang`, `useThemeStore` | every component that prints text or picks colours |
| `CaseSelector` | the workbench rail |
| `FocusShell` | the focus route |
| `Tabs`, `SubTabs` | the content pages; `SubTabs` also in the Case and Methods views |
| `Equation`, `Callout`, `Figure`, `Refs` | the content topics and the Case view's context |
| `ArchitectureConfig`, `Citation`, `CaseDef` (types) | the modal, the citations, the selector |

## Overrides, each with its defect and its gate

| Shell behaviour | Override in OreFlow | Gate |
|---|---|---|
| Known defect 1: `html`, `body` and `#root` at height 100% with horizontal overflow hidden make `<body>` the scroll container; the document never scrolls and its height reads as the viewport's (open in 0.6.11) | `content/content.css`: `html, body, #root { height: auto; min-height: 100%; }` | every tall content page must move on `scrollTo`; heights read through `<body>` |
| Known defect 2: `Tabs` hides inactive panels with `hidden`, which any author `display` overrides | the workbench's own tab row renders only the active view; the sub-tab panels that fill a view re-hide inactive panels explicitly (`.subtabpanel[hidden] { display: none; }`, `workbench.css`) | one tab row, the view at least half the viewport |
| Known defect 3 (uPlot, same class): the live legend sits below the plot and a sized host clips it | `legend: { show: false }` and the reading reported to the readout row (`Chart.tsx`) | the gate's screenshots; the readout row in every view |
| Known defect 4: the interface language is never written to `<html lang>` | `DocumentLanguage`, rendered inside `AppShell` and on the focus route | `<html lang>` equals the interface language on every state |
| Known defect 5: `FocusShell`'s rail column, `clamp(300px, 20vw, 340px)`, leaves the stage 76.6% of a 1280x800 viewport, under ADR-0070's 80% floor | `clamp(248px, 19vw, 340px)` from 861 px up (`workbench.css`): 80.6%, 81% and 86.7% at the three gated viewports | the focus stage and its chart at least 80% |
| Known defect 6: `Tabs` and `SubTabs` keep their selection internally and report no change, so a view held in the URL cannot drive them | `workbench/ViewTabs.tsx`: a controlled tab row on the shell's own classes, with its keyboard behaviour | the focus round trip returns to the same view |
| Known defect 7: the case selector's labels lead with the case id, which crowds the rail with snake_case ids | short catalog codes (L1, C2, F3...) as the ids the selector shows (`Rail.tsx`) | the rail fits without scrolling |
| Known defect 8 (not a shell defect; same class): a visually hidden `<table>` still lays out at its content width, and the body's clipping hides the overflow | the screen-reader table inside a hidden block, `<div className="of-sr-only"><table>` (`Chart.tsx`, `Heatmap.tsx`) | element boxes against the viewport (`OVERFLOW_PROBE`), not `scrollWidth` |
| The shell resets buttons but not form controls | `input, select, textarea { font: inherit; }` | the screenshots |

Every override carries a comment naming what it answers, so nobody tidies it away.
