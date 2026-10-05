# 10 Conservation audit

![Each unit is balanced on its own streams, and the circuit as a whole from feed to products.](../svg/10-audit.svg)

*Each unit is balanced on its own streams, and the circuit as a whole from feed to products.*

A balance that is computed as `R + (1 - R)` closes by construction and proves nothing; the 0.04.000
engine reported exactly that as "100% metal-balance closure". The rebuilt engine audits conservation
from the named streams alone.

## Implementation

`balance.audit` receives, for every unit, its input streams, output streams and any water added, and
re-sums from the stream vectors:

- the solids of every mineral, and, at every unit where no breakage acts, every size class of every mineral, against
  that mineral's flow through the unit;
- every reported element and oxide (from mineral masses and contents);
- water.

A breakage operator is audited by its own steady state instead: the mill by the residual of
$T^{-1}(e)\,p = m$ per class and mineral ($p$ the mill discharge, $m$ the mill feed), the regrind by the same residual
of its operator, each against the feed's flow (`mill_equation`, `regrind_equation` in the report). The largest
relative error is reported as `balance_max_relative_error`, and above 1e-9 (`numerics.balance_tolerance`) the state
carries `balance_not_closed`. A separate check rebuilds the mineral overflow from the particle-class overflow
(`species_consistency_error`, each mineral against its own overflow), and a class mass below minus 1e-9 of its own
mineral's flow in the stream raises `negative_mass`.

What the audit can and cannot catch. The units audited are the crusher, the mill-feed junction, the mill, the sump,
the cyclone, the underflow return or gravity split, the desliming cyclone, the flotation links and junctions, every
flotation bank, the regrind, the dilution points, the LIMS drums, and the whole circuit from crusher feed to products.
Many of them define one output as the feed less the others, so their closure is an identity of the code: the sump,
the cyclone, the underflow return, the gravity split, the mill-feed junction (its water addition is defined as the
difference), the desliming cyclone, both LIMS drums, every flotation bank and the recleaner dilution, and the water of
the flotation link. Their closure is reported, but it can only fail by a defect in the code that writes the streams.
The closures that test the engine are the crusher, the mill and regrind equations (the breakage operators and the
linear solve), the flotation and LIMS links (the particle-class rebuild), the rougher and cleaner junctions (the
recycle's convergence) and the whole circuit. The species check is the image of the mineral check under the fixed
composition table, so it cannot fail where the mineral check passes. Until 0.09.000 the audit summed each mineral over
its size classes, so a stream shifted between classes passed at 1e-13, the breakage operators were audited by mass
only, no flag fired on a failed audit, and the negative-mass check was scaled by the throughput, blind to a trace
mineral (review of 2026-10-04, K-01 and K-10).

## Verification

`tests/test_engine_balances.py::test_unit_and_circuit_closure_all_variants` (PE-02) requires every
unit of every baked variant to close within 1e-9 relative; in practice the errors are at the level
of floating-point round-off (1e-12 to 1e-16, the mill and regrind residuals 1e-17 to 2e-16).
`scripts/check_artifacts.py` re-audits the shipped artifacts. `test_the_audit_sees_a_size_class_error` shifts the
cyclone overflow's host by one size class and requires the audit to fail (above 1e-3);
`test_the_breakage_equations_are_audited` and `test_negative_mass_is_judged_against_the_mineral_own_flow` cover the
residuals and the per-mineral tolerance, and the browser repeats the first two (`frontend/src/test/audit.test.ts`).

The audit also covers the whole operating envelope, not only the baked variants:
`tests/test_contract.py::test_engine_solves_the_envelope` requires the same closure, and a
particle-class consistency within 1e-9, at the corners, the single-input bounds and seeded interior
states of every case (data contract page 01).
