# Design

Use `@fasl-work/caos-app-shell` as the sole source of page chrome and design tokens. Retire the v0.01 hero/orbit and duplicate palette. The workbench remains the landing route, but the circuit visualization must carry process-specific state and direct manipulation, with a single fixed-height instrument area and a bounded control panel. A narrow display must expose the same functions through one-row tabs and a Controls view rather than clipping them.

Document routes use a restrained page heading followed immediately by question/method tabs. The content owner scrolls; the document itself does not. Every long tab has a reachable reference end. All references and equations remain tied to their method or concept.

The workbench now has an explicit `process_family` contract because the old twelve-case display falsely reused one circuit. Rougher, gravity-plus-rougher, magnetic separation and desliming-plus-rougher are separate Python/browser branches with 72-variant parity tests. The magnetic family excludes classifier/flotation controls and marks their method records not applicable. The stage walkthrough is a sequenced inspection of calculated operations, not a physical-time simulation; it stops or resets on case changes. No glyph, animation or chart may imply measured plant performance. Computed values must come from metrics, parameters or explicit artifact arrays, and authored equipment response curves must say they are uncalibrated. The branch is not a production release until the visual and interaction walkthrough is recorded.

Risks: the shared shell's mobile header can occupy two rows; hardcoded colors remain in legacy CSS/SVG; a fixed viewport can hide controls if the pane hierarchy is wrong. These are release blockers, not acceptable caveats.
