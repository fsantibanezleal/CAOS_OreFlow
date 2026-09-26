# React: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.

## Adding a workbench view

1. **Give it a name in the store**: extend `View` and `VIEWS` in `workbench/state.ts`, and its label in
   both languages in `lib/i18n.ts` (`UI.views`).
2. **Write it as a function of the trace**: `({ trace, lang, ... }) => ...`, in
   `workbench/views/<Name>View.tsx`. Everything it draws must be a number of the trace, of the case
   definition or of a baked method record. If it needs a quantity the trace does not hold, add it to the
   engine and its trace (both languages, under the parity test), not to the view.
3. **Size it to the stage.** The App route is a viewport-sized surface (ADR-0071): the view fills
   `.of-view-host` and scrolls inside itself if it must; the page never scrolls. Use the shared chart
   host ([12 uPlot](../12_uplot.md)), which sizes itself from its box.
4. **Report readings upward.** A chart's cursor reading goes to the readout row through the view's
   `onCursor`, not into a legend of its own.
5. **Key per-case state by the case**, so a choice that belongs to one circuit does not survive a case
   change.
6. **Add it to the gate.** `frontend/gate.mjs` walks its own `VIEWS` list, where each view's special
   handling is declared (a sweep to run, sub-tabs to walk), and fails its `view list` check when the tab
   bar has a view the list does not; add the view there and it is measured in every viewport, theme and
   language.

## Adding a content topic

A topic is an object, not a component (`content/doc.tsx`):

```ts
const MY_TOPIC: Topic = {
  id: 'my-topic',
  title: { en: '...', es: '...' },
  paragraphs: [{ en: '...', es: '...' }],
  equations: [{ tex: String.raw`...`, caption: { en: '...', es: '...' } }],
  limits: [{ en: '...', es: '...' }],
  table: { head: [...], rows: [...] },           // plain strings are values in the English convention
  figure: { caption: { en, es }, render: lang => <MyFigure lang={lang} /> },
  data: lang => <MyResultsTable lang={lang} />,  // reads a committed record with useArtifact
  refs: ['citation-key'],
};
```

Add it to a group of the page. Write the prose from the methodology page or the record it describes,
and if the prose states a number, add the claim to the page's claims test (`experiments-claims.test.ts`,
`benchmark-claims.test.ts`) so the text fails when the record changes.

## Rules that keep a component honest

- **No engine formula in a component.** `scripts/check_ui_formulas.py` rejects `Math.exp(`,
  `Math.pow(` and `**` in interface files unless the line says why it is not an engine quantity
  (`// not-engine: fractions shown in percent`), and rejects imports of the solver.
- **A sweep only from a click.** `sweepInWorker` may be called only inside a function named `compute`,
  used only as a click handler; the gate and the check both hold it.
- **Every string in both languages**, and numbers only through `lib/format.ts`, which formats in the
  interface's locale. Authored values in tables go through `localizeAuthored`, formulas through
  `localizeTex`.
- **Drop stale replies.** Any effect that awaits something checks, before writing state, that it has
  not been cleaned up.
