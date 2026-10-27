# Workbench shell and focus route: design

OreFlow is a workbench, not a link-only surface. Its app identity is declared in `product.json`. ADR-0070 therefore remains applicable: the selected case can be inspected at normal scale or opened in the shared shell's Focus stage. The app gate reads the identity, requires Focus, and rejects arguments that move its measurement away from `/app`. The only supported waiver is an explicit, reasoned waiver by a surface product.

The runtime route is implemented by `frontend/src/workbench/FocusWorkbench.tsx` and the shell's Focus primitive. Return navigation is stateful: case, variant, and live controls remain in the workbench store. The release browser gate checks entry, stage size, return state, and all supported app configurations.

WB-016 adds a playback control to the flowsheet stage in Focus mode. Its ordered steps come from the active trace topology, omit junction/recycle bookkeeping, and highlight the matching unit in the diagram. The rail reports that unit's solved stream quantities, payable grades and independently audited balance closure. Previous/next and autoplay/pause select the same unit; the interval changes presentation pacing only. Case, variant and measured-sample changes remount the sequence at its first operation. The sequence is a guided inspection of one steady-state solution, not a time-domain plant simulation.
