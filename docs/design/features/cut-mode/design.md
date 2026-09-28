# Classifier-cut mode design

- **Target mode (0.06).** Two nested Illinois solves: the outer solve finds the energy per pass whose overflow
  P80 meets the target, and the inner one the host cut whose circulating load meets the design value
  (`grinding.py`: `solve`, `overflow_p80` and `solve_cut`). Above installed power, the energy is fixed at the
  installed power and the cut still holds the load.
- **Cut mode.** One Illinois solve in `log e` over `grinding.energy_bracket_kwh_t`, of
  `g(e) = log(e (1 + C(e, d50c)) F) - log(P)`, where `C` comes from `run(e, d50c)` at the given cut.
  - Raising `e` makes the product finer, so less reports to the underflow and `C` falls. The product
    `e (1 + C)` is expected to rise with `e`.
  - T1 measures that over every case on a grid of cuts. If a case is not monotone, the solve keeps the root
    nearest the target-mode energy, and the record flags `cut_mode_multiple_roots`.
  - If no root lies inside the bracket, the state is flagged `power_unreachable_at_cut` and runs at the bracket
    end nearest the power.
- **Outputs.** The same `GrindingResult`: the P80 is read from the overflow, the circulating load from the
  underflow, and the power from `e (1 + C) F`. The trace records `grinding.mode` and which quantities were set.
- **Contract.** `grinding_mode` is an enumerated input and `d50c_um` a bounded one, both per case. The
  cross-field rule makes the target inputs and `d50c_um` mutually exclusive by mode. The per-case bounds of
  `d50c_um` are the nominal state's solved cut times [0.6, 1.6]: T1 measures the range over which the circulating
  load stays within the Plitt model's plausible 1 to 6 before the bounds are fixed.
- **Parity.** The TypeScript `grinding.ts` gains the same branch. The two engines already share the Illinois
  implementation (`roots`).
