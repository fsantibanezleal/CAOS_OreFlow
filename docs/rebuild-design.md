# OreFlow rebuild design: 2026-09-23

## Product boundary

OreFlow is an inspectable *mineral-processing* teaching and research instrument. It is not a mining-wide operational platform and does not estimate plant set-points. The twelve cases are authored operating scenarios. The HZDR particle data is an independently sourced feature example, not a plant recovery label. Learned models approximate the authored simulator; their held-out scores measure interpolation in that design, not cross-mine transfer.

## Question and causal chain

The primary question is: **how do a grind-size choice, classification split and rougher residence/dose interact in a one-pass circuit, and which parts of that conclusion survive comparison against baked variants?** Every displayed stream is a mass fraction on a declared basis. A cumulative size distribution must be monotone. A classifier partition acts on size-bin masses, not on cumulative ordinates. Overall recovery is conditional flotation recovery multiplied by valuable material reaching the rougher under the stated uniform-grade assumption. Every state change must recalculate both visible results and any live classical method readout, or show the baked learned result as stale.

## Screen contract

The App opens on the instrument. No hero. A persistent compact case/variant/status row precedes a single-row view selector. The main viewport contains one of five question-driven views:

1. **Circuit:** quantitative stream diagram, selected-stage readout, stage-specific controls.
2. **Response:** size distribution or time-recovery chart with cursor values and a metric strip.
3. **Decision surface:** grind × collector sweep of the same live circuit, selectable operating points, rotateable 3D projection. Angle step changes the *view rotation*, never process physics.
4. **Methods:** one method at a time with correct unit, domain, assumptions and live/replay provenance. Incompatible units are never drawn on one bar scale.
5. **Compare:** one metric at a time across all six precomputed variants; clicking a variant loads it.

Desktop keeps a compact three-group control rail visible. Mobile places controls in a dedicated view without forcing a scroll to reach a slider. Long documentation lives in an explicitly scrollable page container; its tab row does not wrap. Document height/width equal viewport. Shell remains shared.

## Visual language

Use a restrained mineral-workflow palette: limestone surfaces, dark slate text, oxidized copper for material/energy, blue-green for water and separation, and a distinct violet for model/uncertainty. The colors encode process roles, not decoration. Type uses the platform UI font and tabular numerals for measured values. Avoid oversized branding, orbits, slogans, meaningless particle animation and unlabeled “index” values.

## Acceptance gates

- At 628×748, 1280×800, 1600×900 and 2560×1440 in both themes: document equals viewport; no horizontal overflow; no clipped tabs or controls; primary visualization occupies the majority of the App working area.
- A person can click from App to every route and every view, change every control, and see a relevant value change or an explicit display-only explanation.
- Classification CDF is monotone and terminates at 1; classifier cut changes overflow mass and overall recovery; Python and browser live engines agree within numeric tolerance on representative cases.
- Baked case artifacts, model scores and labels are regenerated after a model change and checked for all 12×6 variants; learned output is never represented as a live recomputation unless it is actually executed.
- No release before desktop/mobile screenshots and interaction paths, EN/ES and light/dark inspection, CI, Pages, VPS TLS/SNI and direct-route checks. User acceptance remains separate from engineering verification.
