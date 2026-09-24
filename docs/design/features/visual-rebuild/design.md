# Design

Use `@fasl-work/caos-app-shell` as the sole source of page chrome and design tokens. Retire the v0.01 hero/orbit and duplicate palette. The workbench remains the landing route, but the circuit visualization must carry process-specific state and direct manipulation, with a single fixed-height instrument area and a bounded control panel. A narrow display must expose the same functions through one-row tabs and a Controls view rather than clipping them.

Document routes use a restrained page heading followed immediately by question/method tabs. The content owner scrolls; the document itself does not. Every long tab has a reachable reference end. All references and equations remain tied to their method or concept.

The existing artifact and live calculation contracts remain unchanged by visual work. No added glyph, animation or chart may imply measured plant performance. Computed values must be sourced from `Metrics`/`Params` or explicit artifact arrays; schematic elements must say they are schematic. The source branch is not a production release until the visual and interaction walkthrough is recorded.

Risks: the shared shell's mobile header can occupy two rows; hardcoded colors remain in legacy CSS/SVG; a fixed viewport can hide controls if the pane hierarchy is wrong. These are release blockers, not acceptable caveats.
