# React: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## Routes and lazy pages (`frontend/src/main.tsx`)

```tsx
const FocusWorkbench = React.lazy(() => import("./workbench/FocusWorkbench"));
const Introduction = React.lazy(() => import("./pages/Introduction"));
...
createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL === '/CAOS_OreFlow/' ? '/CAOS_OreFlow' : undefined}>
    <Citations><AppRoutes /></Citations>
  </BrowserRouter>,
);
```

- The workbench is the landing route and loads with the app; the focus route and the five content
  pages are split into their own chunks and load on first visit, under one `Suspense` boundary with a
  bilingual loading line.
- The router takes the Pages base only when the build was made for Pages.
- `/focus/:caseId` renders outside the `AppShell` (the focus layout has no site header); every other
  route renders inside it, and `DocumentLanguage` keeps `<html lang>` in step on both.
- `Citations` wraps the shell's `CitationsProvider` and hands it the list in the interface language
  (`localizeCitations` in `content/citations.ts`): in Spanish an author pair is joined with *y* and a
  descriptive label is translated, while each bibliographic record stays verbatim.
- An unknown path renders the workbench instead of an error page.

## The workbench loop in hooks (`frontend/src/workbench/Workbench.tsx`)

`useLoaded` fetches the index, the contract and the benchmark once. `useCaseState` owns the loop:

```tsx
useEffect(() => {
  if (!caseId) return;
  let live = true;
  loadCase(caseId).then(next => {
    if (!live) return;              // the user has already moved to another case
    ...
  });
  return () => { live = false; };
}, [caseId, setVariant, setPoint]);
```

Every asynchronous effect follows that shape: a flag set when the effect is cleaned up, checked before
any state is written, so a reply that arrives after the user has moved on is dropped instead of
overwriting the newer state. The evaluation effect validates the point with the contract first, then
calls `evaluateInWorker`; the worker client rejects a superseded evaluation with `superseded`, which the
effect ignores, so a dragged slider leaves only the newest trace on screen.

## The store and the URL (`frontend/src/workbench/state.ts`)

A zustand store holds the case, the variant, the variant's own point (`base`), the point the engine runs
(`point`), the view, the rail section, the selected unit and the basic or advanced control set. The URL
holds what makes a state shareable: `?case=`, `?variant=`, `?view=` and `?set=` with only the inputs that
differ from the variant's point, as `name:value` pairs. The page applies the URL once when it opens and
from then on writes it with `replace`, so the back button leaves the page rather than stepping through
slider positions. Entering the focus route carries the same query, and leaving it returns to the same
state: the gate clicks through that round trip on every run.

## Views are functions of the trace

Each view receives the trace, the case definition and the language, and draws. Selections that only
make sense within one case (an input to sweep, a factor, a unit) live in a component keyed by the case
(`key={artifact.case_id}`), so React discards them when the case changes instead of carrying a
flotation input into the magnetite circuit. `grindingCharts` and `separationCharts` are plain functions
that build the chart elements, so the views and the focus route draw the same objects, and
`trace-curves.test.ts` can inspect them without rendering.

## The content pages

A page is a `DocPage` with `TopicGroups`; a topic is data (`frontend/src/content/doc.tsx`). Results come
from `useArtifact(loader)`, which loads once per mount and drops a reply that arrives after unmounting,
and `Loaded`, which renders a status while loading and an alert if a load failed. The artifact loaders
are memoized per file, so pages that read the same record share one request.
