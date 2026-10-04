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
    nearest the target-mode energy, and the record flags `cut_mode_multiple_roots`. Dropped after T1: the power was
    monotone in the energy in all 60 measured series, so the flag was never implemented (review of 0.07.000, W-48); CM-09 (0.08.000)
    refuses a cut with no steady state instead.
  - If no root lies inside the bracket, the state is flagged `power_unreachable_at_cut` and runs at the bracket
    end nearest the power.
- **The water bypass follows the achieved load.** In the target mode the underflow water, and with it the
  bypass `R_f`, is set from the design circulating load, which the cut then holds. In the cut mode the load is a
  result, so `R_f` must be consistent with it:
  - at each energy, a fixed point on `C`: the underflow water is `C F (1 - s_u) / s_u`, then
    `R_f = W_u / (W_u + W_o)`, then `C` from the pass;
  - T1 measures its convergence over every case (`cutmode_measure`) before the solver relies on it.
- **Outputs.** The same `GrindingResult`: the P80 is read from the overflow, the circulating load from the
  underflow, and the power from `e (1 + C) F`. The trace records the `cut_mode` metric (1 in the cut mode, 0 in the target mode); in the cut mode the
  achieved P80 and load take the targets' place.
- **Contract. Changed during T2.** The mode is the cut itself: `d50c_um = 0`, the nominal of every case, is the
  target mode, and a positive cut is the cut mode. Its per-case bounds are 0.8 and 1.6 times the cut the target mode
  solves at the nominal state (`catalog.nominal_cut`, computed by the engine when the contract is built), rounded to
  12 significant digits as the relative bounds are, and the entry declares `off: 0`. The planned design, an
  enumerated `grinding_mode` and a rule rejecting the target inputs when they are given in the cut mode, was
  dropped, for two reasons. Every point in both languages is numeric (the URL state, the sweeps and the validators
  read numbers). And every internal caller validates a complete point (the optimizer, the learned lane's design,
  the uncertainty design), so a rule on which inputs are given would reject them. In the cut mode the engine ignores
  `target_p80_um` and `circulating_load`, and the trace reports the achieved P80 in the target's place, with the
  `cut_mode` metric set.
- **What the cut mode changes elsewhere.**
  - The learned lane keeps sampling the target mode: an input with an off value keeps it, so the design is the
    one of 0.06.
  - The optimizer's grind decision becomes the cut, and its search runs without the screen, because the lane's
    features are the target and the design load, which the cut mode makes results. The record says so
    (`unscreened_reason: cut_mode`).
  - The rail's classification section gets a mode switch: the cut mode starts at the nominal cut, and the target
    and load controls stay visible and disabled, as quantities that follow.
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
- **Measured on 2026-09-30 with the implemented solver** (`tests/test_grinding.py`):
  - CM-04: at its own solved cut and drawn power, the cut mode reproduces every nominal target state's P80 within
    1.1e-13 and its circulating load within 1.9e-13, relative. The test holds 1e-9, far inside the requirement's 0.5%.
  - At installed power and the nominal cut, the nominal states grind finer (the soft porphyry 135.6 um against its
    150 um target) at a lower load (143 to 236%), because the nominal states draw less than installed power.
  - At 0.8 of the cut, the loads are 216 to 412%. The hard porphyry, at 412%, is flagged
    `circulating_load_out_of_range`, and most states at that cut flag the cyclone pressure window.
- **Parity.** The TypeScript `grinding.ts` gains the same branch. The two engines already share the Illinois
  implementation (`roots`).
