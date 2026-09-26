# 10 Conservation audit

A balance that is computed as `R + (1 - R)` closes by construction and proves nothing; the 0.04.000
engine reported exactly that as "100% metal-balance closure". The rebuilt engine audits conservation
from the named streams alone.

## Implementation

`balance.audit` receives, for every unit, its input streams, output streams and any water added, and
re-sums from the stream vectors:

- the solids of every mineral,
- every reported element and oxide (from mineral masses and contents),
- water.

The units audited are the crusher, the mill-feed junction, the mill (mass per mineral is conserved
through breakage), the sump, the cyclone, the underflow return or gravity split, the desliming
cyclone, the flotation links and junctions, every flotation bank, the regrind, the dilution points,
the LIMS drums, and the whole circuit from crusher feed to products. The largest relative error is
reported as `balance_max_relative_error`. A separate check rebuilds the mineral overflow from the
particle-class overflow (`species_consistency_error`), and any negative class mass raises a flag.

## Verification

`tests/test_engine_balances.py::test_unit_and_circuit_closure_all_variants` (PE-02) requires every
unit of every baked variant to close within 1e-9 relative; in practice the errors are at the level
of floating-point round-off (1e-12 to 1e-16). `scripts/check_artifacts.py` re-audits the shipped
artifacts.
