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
- **The water bypass follows the achieved load.** In the target mode the underflow water, and with it the
  bypass `R_f`, is set from the design circulating load, which the cut then holds. In the cut mode the load is a
  result, so `R_f` must be consistent with it:
  - at each energy, a fixed point on `C`: the underflow water is `C F (1 - s_u) / s_u`, then
    `R_f = W_u / (W_u + W_o)`, then `C` from the pass;
  - T1 measures its convergence over every case (`cutmode_measure`) before the solver relies on it.
- **Outputs.** The same `GrindingResult`: the P80 is read from the overflow, the circulating load from the
  underflow, and the power from `e (1 + C) F`. The trace records `grinding.mode` and which quantities were set.
- **Contract.** `grinding_mode` is an enumerated input and `d50c_um` a bounded one, both per case. The
  cross-field rule makes the target inputs and `d50c_um` mutually exclusive by mode. The per-case bounds of
  `d50c_um` are the nominal state's solved cut times [0.8, 1.6], from the measurement below.
- **Measured on 2026-09-28** (`measurements/cutmode_measure.py` and its JSON), over the 12 nominal states at cut
  factors 0.6, 0.8, 1, 1.25 and 1.6 and 17 energies from a quarter to four times the nominal energy per pass:
  - the mill power `e (1 + C) F` rises monotonically with the energy in all 60 series, so the power root is
    unique where it exists;
  - the bypass fixed point converges to 1e-12 at all 1,020 points, in at most 20 iterations;
  - at the installed-power root, the circulating load is about 2.2 to 2.7 at the nominal cut (3.7 for the hard
    porphyry, whose installed power binds), 1.0 to 1.2 at 1.6 times the cut, and 7 to 9.5 at 0.6 times, where
    the hard porphyry has no root at all. These are log-linear estimates between the series' ends; T1 computes
    them exactly. Hence the lower bound of 0.8.
  - The fixed point converges linearly. Each cut-mode evaluation costs up to 20 passes per energy iterate,
    against about 10 in the target mode's inner solve. A secant step on `C` is the first thing to try if the
    browser's timing needs it.
- **Parity.** The TypeScript `grinding.ts` gains the same branch. The two engines already share the Illinois
  implementation (`roots`).
