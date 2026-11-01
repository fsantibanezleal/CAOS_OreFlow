# The CAOS app shell: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).
Return to [15 The CAOS app shell](../15_caos-app-shell.md).

## Configuration, containment and routes

`frontend/src/main.tsx` configures `AppShell` with the OreFlow name, a `Pickaxe` mark, `APP_VERSION`,
public visibility, MIT licence, the architecture modal, the repository link and bilingual footer
attribution, provenance and research disclaimer. `applyTheme(readTheme())` runs before rendering.

The configuration sets both `contain: true` and `fixedRoutes: ["/app"]`. In installed shell `0.19.10`,
`contain: true` makes the shell contained on every route; `fixedRoutes` does not restrict containment
to the workbench. The shell owns the viewport and its main content scroll area. Its CSS gives document
pages internal vertical scrolling and has a narrow-screen fallback to page scrolling at 860 px.
The old product reset of `html`, `body` and `#root` heights is absent.

| URL | Current behavior |
|---|---|
| `/` without a query or hash | Redirects to `/introduction?view=executive` |
| `/` with a query or hash | Redirects to `/app`, preserving that query and hash |
| `/app` | Workbench; `focus=1` opens the focus surface within it |
| `/focus/<case-id>` | Compatibility redirect to `/app` with `case` and `focus=1`; preserves other query parameters |
| `/introduction`, `/methodology`, `/implementation`, `/experiments`, `/benchmark` | Content pages within `AppShell` |
| Any other path | Redirects to `/introduction?view=executive` |

The Introduction is imported eagerly for the landing view. The other content pages and workbench
load lazily behind a suspense boundary. Focus is not a separate mounted route outside `AppShell`.

The Introduction composes `SurfacePage` with `document`, retaining its tabs and Focus behavior. The shell owns
the full-column document framing, padding and lede. The product passes the lede as text and supplies no second
`page-body` wrapper or local framing override. This adopts the shared document mode released in `0.19.10`.

## Workbench and focus composition

`frontend/src/workbench/Workbench.tsx` uses `WorkbenchLayout` for the shared rail and instrument
structure. `Rail.tsx` supplies process controls through `CaseSelector` with `layout="select"`.
The selector's `id` and `selectedId` use canonical `case_id` values, with localized case titles and
categories; short catalog aliases are no longer substituted for IDs.

The product store and URL carry the case, variant, view, changed inputs and source selection.
`ViewTabs.tsx` stays product-owned because the installed shared `TabDef` has no `disabled` option.
For the measured-hour source, only the Case view is available: analytical views remain visible but
disabled, and arrow keys, Home and End skip them. The row uses roving tabindex, shares space with
process flags, and leaves rendering of the selected panel to `Workbench.tsx`. This bounded requirement
explains the product row. Both shared `Tabs` and `SubTabs` already support controlled selection through
`value` and `onChange`, and render only the active panel.

`useFocusMode({})` owns the `focus` query parameter, Escape handling, focus restoration and background
inertness. `Workbench.tsx` keeps the normal workbench mounted inside an inert wrapper during focus and adds
header inertness, initial exit-button focus and a Tab-key focus loop.
`FocusWorkbench.tsx` receives the existing loaded records and case state; it composes `FocusShell`
with `landmark={false}`, a stage, HUD, controls rail and localized exit control. Stage selection is
mirrored as `stage` in the query. Its exit handler calls `focusMode.setFocus(false)`.

The product supplies the flowsheet, grinding and separation charts, response sweep and walkthrough;
the shell supplies the focus frame. `OverlayInset` reserves room in charts for the focus overlays.

## Citations and content primitives

The `Citations` wrapper in `main.tsx` reads `useShellLang()`, memoizes
`localizeCitations(CONTENT_CITATIONS, lang)` and supplies `CitationsProvider`. In
`frontend/src/content/citations.ts`, Spanish descriptive short labels and author conjunctions are
localized while bibliographic records, DOIs and URLs remain verbatim. The installed `Citation` API
supports bilingual labels; this preprocessing is OreFlow's retained labeling policy.

Content pages compose shared primitives such as `Tabs`, `SubTabs`, `Equation`, `Callout`, `Figure`
and `Refs`; `architecture.ts` supplies the architecture modal configuration. Theme-aware product
styles use shell tokens for process views, figures, tables and controls.

## Customizations still present

These are source observations, not newly measured browser results. Historical defect comments in
product source are not proof that the same defect remains in `0.19.10`.

| Location | Current customization and scope |
|---|---|
| `workbench/workbench.css`: `.of-bench` | Sets `--rail-w: clamp(212px, 16vw, 320px)` on the normal workbench to allocate room to its instrument. The shell still owns the grid. The separate focus surface uses the shell's default `clamp(248px, 19vw, 340px)`; the old focus grid override is absent. |
| `workbench/workbench.css`: form controls | `input, select, textarea { font: inherit; }` extends the interface font to native controls across the product. |
| `workbench/workbench.css`: rail selector | `.of-rail .cs-select { max-width: none; }` and the product selector wrapper's padding rule tune the control within the compact rail. They are retained local styling, not a demonstrated upstream defect. |
| `workbench/workbench.css`: product sub-tabs | `.of-workbench-subtabpanel[hidden] { display: none; }` belongs to product panels. The shell already supplies `[hidden] { display: none !important; }`; no shell `.subtabpanel[hidden]` repair is present. |


Product figure and table scroll wrappers, chart sizing, readouts, process controls and focus overlay
insets describe domain content. They do not replace the shell's header, footer or layout. The installed
shell already colors `.dg-note` and `.dg-tick` with `--color-fg-subtle`; no active product rule changing
those shared classes remains.

## Responsibilities adopted from the shell

Installed `AppShell` writes the selected interface language to `<html lang>`. Its navigation uses the
shared `useOverflowFade` implementation to update overflow fades, reveal the active or focused link,
and observe scrolling and resizing. OreFlow has removed the former `DocumentLanguage.tsx` and
`NavOverflow.tsx` helpers and their imports and rendered instances from `main.tsx`.

The architecture modal uses the shell's themed `.caos-arch-toggle` rule. The product's obsolete
architecture-toggle CSS override and defect comments have been removed from `content.css`.
The shell also owns the diagram note and tick colors described above.

`main.tsx` no longer imports the unused `Landing` or `FocusWorkbench`. Its explicit redirects own the
landing behavior; `Workbench.tsx` still imports and composes the active `FocusWorkbench.tsx` component.
These removals adopt behavior already supplied by shell `0.19.9`.

## Verification entry points

From `frontend/`, `npm run gate` invokes `frontend/scripts/gate.mjs`, which validates the product declaration
and runs the installed shell gate against the build with the expected brand and required Focus mode.
`npm run gate:oreflow` invokes `gate.mjs` for the detailed process interactions and measurements.
`npm run gate:walkthrough` invokes the separate walkthrough gate. See [03 Applying](03_applying.md)
for commands. Documentation inspection alone does not establish that any browser gate passed.
