# Workbench shell and focus route: design

OreFlow is a workbench, not a link-only surface. Its app identity is declared in `product.json`. ADR-0070 therefore remains applicable: the selected case can be inspected at normal scale or opened in the shared shell's Focus stage. The app gate reads the identity, requires Focus, and rejects arguments that move its measurement away from `/app`. The only supported waiver is an explicit, reasoned waiver by a surface product.

The runtime route is implemented by `frontend/src/workbench/FocusWorkbench.tsx` and the shell's Focus primitive. Return navigation is stateful: case, variant, and live controls remain in the workbench store. The release browser gate checks entry, stage size, return state, and all supported app configurations.

WB-016 adds a playback control to the flowsheet stage in Focus mode. Its ordered steps come from the active trace topology, omit junction/recycle bookkeeping, and highlight the matching unit in the diagram. The rail reports that unit's solved stream quantities, payable grades and independently audited balance closure. Previous/next and autoplay/pause select the same unit; the interval changes presentation pacing only. Case, variant and measured-sample changes remount the sequence at its first operation. The sequence is a guided inspection of one steady-state solution, not a time-domain plant simulation.

## Introduction reader: WB-017 to WB-019

Reviewed before implementation, 2026-11-01: retain `SurfacePage document` as the sole document root,
with Executive then Technical tabs. Executive owns only the installed `ExecutiveView` backed by
`content/executive.json`; Technical owns the report links and existing `TopicGroups`. Both tab
definitions opt into shared Focus. The shell owns scrolling, page framing, tab keyboard handling,
query parameters, nested selection memory and Focus return. The product supplies content and links,
never a duplicate executive renderer, nested page-body or CSS override.

The executive onward link must also work inside Focus, where there is no sibling outer tab button.
Use the shell's exported `useUrlView` for the two view ids, pass its value/onChange to SurfacePage,
and supply ExecutiveView's documented `onOpenTechnical` callback. This preserves the same shared
URL and Focus machinery while making the product's destination explicit in either presentation.

The observed 46 ADR-0017.2 failures require a source/visibility diagnosis, not shorter filler.
The current executive JSON contains the required rows. On desktop the installed surface bounds
its document root to the viewport while its long tab panel scrolls; the installed gate measures
readability against that short root. Record any resulting upstream measurement gap separately
from genuinely unreachable content. A field in a hidden pane does not prove reader access:
browser checks must activate each section/topic, scroll each field/source into view, turn flip
cards where required, and test actual controls. Do not weaken the gate or change installed shell files.

Regression oracles are the existing bilingual source, installed executive validator and actual
shared rendering. Source/SSR checks protect Executive-only ownership, both Focus opt-ins and
technical area depth. The browser matrix covers eight size/theme/language combinations, keyboard
tabs, both Focus views, retained nested selection, source destinations and direct URLs. The exact
installed gate runs on an external candidate build; main owns canonical dist, full gates and release.

Development inference uses the same copied `/ort/` runtime as production. Vite adds an `import`
query marker to the runtime's dynamic module import; its public-file middleware skips such requests
and the source transformer rejects the public module. A development-only middleware removes that
marker for the single declared `ort-wasm-simd-threaded.mjs` asset and delegates serving to Vite's
existing public-file middleware. Other requests and production bundling retain their normal paths.
No runtime, model or scientific-engine bytes are modified. The regression starts the actual Vite
server with the actual copied SDK bytes and checks response bytes, module content type and the
normal rejection of an unrelated public module.

References: [Vite import analysis](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/importAnalysis.ts),
[ONNX runtime module loading](https://github.com/microsoft/onnxruntime/blob/main/js/web/lib/wasm/wasm-utils-import.ts)
and [the public directory](https://vite.dev/guide/assets#the-public-directory).

## Pending document artifacts (WB-021)

Artifact-backed document panels use `useArtifact` and `Loaded` from `frontend/src/content/data.tsx`.
The pending branch declares `data-state="loading"` on its existing accessible status surface.
Each panel retains that declaration until its actual required data resolves; a mounted shell or
another completed panel does not establish that this panel is ready. The successful branch removes
the pending surface when rendering real children. A failed request replaces it with the existing
localized alert and reason, without drawing fabricated values or remaining indefinitely pending.
The installed shell's readiness protocol and idle thresholds remain unchanged.

The regression serves the actual React hook/component through a private Vite fixture, holds two
independent HTTP artifact responses, and invokes the installed shell's real in-page readiness
function in Chromium. It checks both languages, partial arrival, complete arrival and failure with
another request still pending. Fixtures/cache remain external; no production build or dist writes
are involved. Full public idle/cancellation gates remain release integration checks.
