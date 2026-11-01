# Validation

| requirement | adversarial check | gate |
|---|---|---|
| WB-014 | Remove the workbench-kind declaration or try to move the Focus check to another route; the design guard must identify invalid product metadata or reject the redirected measurement. | `tests/adversarial/test_app_kind.py::test_the_template_example_is_a_workbench_with_focus_and_passes` |
| WB-015 | Change the waiver reason in only one of the product metadata and ADR-0070 row, or attempt the waiver on a workbench; the design guard must reject the inconsistent or inapplicable waiver. | `tests/adversarial/test_app_kind.py::test_a_reason_that_differs_from_the_sdd_row_fails` |
| WB-016 | Remove the topology-driven sequence or replace its stream ledger with empty values; the browser gate must fail stepping, active-unit synchronization, computed streams, interval playback or the pause control. | `tests/adversarial/test_oreflow_requirements.py::test_adversarial_wb_016` |
| WB-017 | Remove executive content, linked sources or sole document ownership; the source/SSR regression must fail. Actual readability additionally requires reaching every field, card/flip face and source through the shared reader. | `frontend/src/test/introduction-claims.test.ts::adversarial: executive evidence cannot disappear from the shared reader`; installed shell ADR-0017.2 |
| WB-018 | Remove Technical's Focus opt-in or ExecutiveView's explicit onward callback; require regression failure. Actual Focus navigation/return and direct URLs are additionally exercised in the browser. | `frontend/src/test/introduction-claims.test.ts::adversarial: both introduction views retain Focus and onward navigation` |
| WB-019 | Remove the bilingual technical prose, equations, glossary, scope callout or ordered pipeline; require the registered floor regression to fail. Readability must additionally be verified through real scrolling. | `frontend/src/test/introduction-claims.test.ts::adversarial: technical areas retain their content floors in both languages`; installed shell ADR-0017.2 |
| WB-020 | Start the real development server with the copied SDK bytes; require both ordinary and runtime-import URLs to return those exact bytes with a JavaScript content type. A separate existing public module retains Vite's import rejection. The original configuration returns HTTP500 for the runtime-import URL. | `frontend/src/test/ort-dev-assets.test.ts::adversarial: the development server serves the copied ONNX module unchanged` |
| WB-021 | Hold two actual artifact HTTP responses while the real React hook/component is mounted and the installed shell readiness function runs in Chromium. Resolve only one request: readiness must stay busy; resolve both: actual children render and readiness clears. Fail one request while the other stays pending: retain a localized alert, no fabricated failed data, and independent loading until the other request completes. | `frontend/src/test/content-loading.test.ts::adversarial: pending document artifacts keep shared readiness busy in English and Spanish`; `frontend/src/test/content-loading.test.ts::adversarial: failed artifacts retain bilingual alerts and independent pending state` |

## Introduction bounded validation, 2026-11-01

Requirements/design were reviewed against the installed 0.19.10 API and existing content before
implementation. No replacement scientific content was needed. `npm --prefix frontend test --
src/test/introduction-claims.test.ts` passes all eight tests; `npm --prefix frontend run typecheck`
exits zero. The actual candidate was built to a separate temporary directory; the canonical
production bundle was not rebuilt for this bounded check.

The two language-specific technical assertions share one named adversarial test; all original
bilingual assertions remain. These source/SSR tests establish content and integration regressions;
the browser measurements below establish actual access.

The independent reader matrix covers 1280x800 and 390x844, EN/ES, light/dark: eight modes, zero
failures. Each checks all rendered executive field paths (including carousel cards and both flip
faces), source-link actionability, all six technical topics, mathematics glossary, scope callout,
pipeline steps and both Focus views. Separate real keyboard assertions pass End/Home/ArrowRight
on executive and technical nested tabs in all eight modes. Actual screenshots and machine-readable
measurements were inspected separately from the source assertions.

The unmodified installed shell gate was run on the actual candidate with `--routes /introduction
--sizes 1280x800,390x844 --themes light,dark --langs en,es`: exit 1, 110 states, 46 ADR-0017.2
failures, no other check failures. This is not a green shell gate. Read-only installed measurement
probes show that scrolling alone changes a figure from unreadable to readable, restores all six
source titles, and reveals the technical floors: four dense problem/principles paragraphs, ten
glossary items, one scope callout and four pipeline steps. Owner: CAOS_APP_SHELL document-surface
measurement walk (`gate/run.mjs` and `gate/inpage.mjs`), which currently clips against the short
document root without traversing its long scrollable panel. The fix belongs upstream, retaining
readability/hidden-pane checks; no local gate, installed package or CSS was changed.

The upstream defect is tracked as [shell issue170](https://github.com/fsantibanezleal/CAOS_APP_SHELL/issues/170).
This bounded validation does not establish a passed full release gate; the corrected shared gate
must be published, adopted and run against the complete production build.

## Published shell 0.19.11 verification


The preceding failure describes the initial 0.19.10 measurement. Shell issue170 is now closed and
0.19.11 is published and pinned exactly. Its unmodified complete installed gate passes 1,412 measured
states with zero failures on the production build, including actual document scrolling and restored
state. Captures were inspected. The separate application gate passes 1,346 desktop/default-small checks
and 76 additional checks for the remaining small-screen language/theme combinations: 1,422 checks in
total across all sixteen desktop and eight phone/tablet modes. Numerical, Focus, source-data and
interaction checks remain active. Public serving verification is recorded with the release.
