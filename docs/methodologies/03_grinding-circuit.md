# 03 Grinding circuit

![The mill as three mixers in closed circuit with the cyclones; the underflow returns to the mill.](../svg/03-grinding.svg)

*The mill as three mixers in closed circuit with the cyclones; the underflow returns to the mill.*

## Theory

**Population balance.** For size class $i$ with mass $M_i$, batch grinding follows

$$\frac{dM_i}{dt} = -S_i M_i + \sum_{j<i} b_{ij} S_j M_j,$$

with class 1 the coarsest, $S_i$ the specific rate of breakage and $b_{ij}$ the fraction of broken
class $j$ that reports to class $i$. (The 0.04.000 Methodology printed an extra $S_{i+1}M_{i+1}$ term;
it is not part of the balance.)

**Energy-specific breakage.** Herbst and Fuerstenau (1980) showed that $S_i = S_i^E P / H$, where $P$
is the net mill power, $H$ the mill holdup and $S_i^E$ an energy-specific rate (t/kWh) that is
invariant with mill size and power, which is what makes population-balance scale-up possible
(Int. J. Miner. Process. 7(1):1-31, doi:10.1016/0301-7516(80)90034-4). Then
$S_i\tau = S_i^E\,P/Q$, with $Q$ the mill solids feed rate: the breakage per pass depends on the
specific energy per tonne of mill feed. OreFlow uses the energy-specific form of the Moly-Cop Tools
ball-mill simulator,

$$S_i^E = \alpha_0 \frac{d_i^{\alpha_1}}{1 + (d_i/d_{crit})^{\alpha_2}},$$

and the cumulative breakage function

$$B_{ij} = \beta_0 \left(\frac{x_i}{x_{j+1}}\right)^{\beta_1} + (1 - \beta_0)\left(\frac{x_i}{x_{j+1}}\right)^{\beta_2},\qquad b_{ij} = B_{ij} - B_{i+1,j}.$$

**Residence.** Austin, Klimpel and Luckie (1984) represent a full-scale ball mill as one large perfect
mixer followed by two equal small ones; tracer studies of industrial overflow mills find about two to
three equivalent mixers. For per-pass specific energy $e$ and mixer volume fractions $f_k$, each mixer
satisfies $(I + e f_k D)\,p_k = p_{k-1}$ with $D = (I - b)\,\mathrm{diag}(S^E)$. The mixers share one
operator, so they commute and the mill transfer is

$$T^{-1}(e) = I + e\,D + c_2 e^2 D^2 + c_3 e^3 D^3,\qquad c_2 = \sum_{j<k} f_j f_k,\quad c_3 = f_1 f_2 f_3.$$

**Closed circuit.** With the cyclone sending fraction $r_i$ of the mill product to the underflow and
the underflow returning to the mill, the mill feed is $m = f + r p$ and $T^{-1} p = m$, so

$$\left(T^{-1}(e) - \mathrm{diag}(r)\right) p = f,\qquad r_i = R_f + (1 - R_f)\,y_i,$$

less the share a gravity unit on the underflow takes (page 06). This is one lower-triangular solve per evaluation.
At steady state the overflow carries exactly the new feed of every mineral, less what a gravity unit recovers.

## Implementation

`grinding.GrindingCircuit` builds $D$, $D^2$ and $D^3$ once per mineral, with selection
$(S^E_i/\bar g)(L_i g_V + (1 - L_i)\bar g)$ for a valuable mineral (liberated grains break at their own
relative grindability $g_V$, the valuable part of composites at the ore rate) and $(S^E_i/\bar g)\,g_G$ for gangue.
Breakage is tracked by mineral, so the host gangue locked in those composites breaks at the host's own
grindability: the two parts of one composite particle break at rates 0.82 to 1.08 of each other across the cases. A
particle-consistent rate needs the mill to carry composites as particles, whose locked share depends on the state;
the mineral-by-mineral breakage is a declared simplification (review of 2026-10-04, C-05). Gravity-recoverable gold
(page 06) enters the mill with its own sizes, having passed the crusher unchanged, and breaks at the ore's selection
divided by Banisi's slowdown, 6 at 75 um and 20 at 707 um. The ore work
index scales $\alpha_0$ by $W_{i,ref}/W_i$, and $\bar g = 1/\sum_k x_k/g_k$ is the ore's mass-weighted
harmonic mean grindability ($x_k$ the mass fraction of mineral $k$). A mineral's energy for a given
reduction goes as $1/g_k$ and the ore's specific energy, which the work index measures, is the
mass-weighted sum of those, so the ore breaks like one mineral of grindability $\bar g$. Dividing by
$\bar g$ lets the work index alone set the ore's hardness; the grindabilities only share the breakage
among the minerals (PE-07b). Before 0.06.000 the selection was not divided, so an ore whose bulk mineral
was declared soft (the serpentine of the nickel case, the clays of three others) broke faster than its
own work index allowed and its grinding energy was understated by up to 1.9 times. Valuable minerals are solved first; the host gangue locked in their
composites classifies with the composite density, which enters the host-gangue system as a known
source term, so every system stays linear.

**Host-limited composites.** The source term assumes that the host gangue in each size class can
supply the composites at the declared content $c$. A valuable-rich feed breaks that assumption: at
55% magnetite against 45% host, the coarse classes (where $L_i \to 0$) would lock more host than
they carry, and the host overflow would go negative. The circuit therefore applies the limit of the
particle-class split (page 01): the composite share of each class is scaled by
$s_i = \min\left(1,\ H_i \big/ \sum_V (1-L_{V,i})\, p_{V,i} (1-c_V)/c_V\right)$, with $H_i$ the host in
the mill product, and the rest of the valuable mineral classifies as liberated grains. Because
$H_i$ itself depends on the composites, $s$ is iterated to a fixed point (largest change below
1e-13); with enough host in every class, as in every nominal case, one pass is exact and $s = 1$.
Breakage rates keep the declared liberation: the limit changes how particles classify, not how fast
they break. The scale is reported as the `composite_scale` curve.

The solver meets two conditions:

1. For a per-pass energy $e$, the host-gangue cut $d_{50c}$ is found (Illinois root finder on
   $\ln d_{50c}$) so that the circulating load $U/F$ equals the design value.
2. The energy $e$ is found (Illinois on $\ln e$) so that the overflow P80 equals the target.

The mill draws its energy per pass on its own feed, the new feed plus what returns to it: $P = e\,m$, with
$m = F(1 + CL)$ without a gravity unit or with the unit on the mill discharge (the whole underflow returns), and
$m = F(1 + CL) - G$ with the unit on the underflow, $G$ its concentrate, which leaves the loop. The specific energy
per tonne of new feed is $E = P/F$. If the required power exceeds the installed power, the circuit runs at installed
power: $e = P_{inst}/m(e)$, a fixed point because the gravity unit's take moves with $e$ (without a gravity unit one
pass settles it), with the cut solved again for the design circulating load at each $e$, and the coarser achieved P80
is reported with `power_limited`. This is how a harder ore or a higher feed rate coarsens a real, power-limited
circuit. Until 0.09.000 the power was $e(1 + CL)F$ in every circuit, which counted the gravity concentrate as mill
feed: 7.2e-5 too much power on the gold case's nominal and 4.3e-4 at a bleed of 0.6 (review of 2026-10-04, C-03).

$P$ is a net (charge) power, as Herbst and Fuerstenau's selection is normalised by net power, and the installed power
a case declares is the power available to the charge, not a motor rating. Page 09 states what that means for the
operating work index.

**When a search fails.** The root search raises at its iteration cap, never returning an unconverged iterate as a
root. When the design load cannot be held, the cut stays at the bracket end on the side where the root lies (the
finest cut when the load stays below the design, the coarsest when it stays above), and when the target P80 cannot be
met the energy stays at the end nearest it. A zero load enters the cut search as a finite value on the low-load
side. The fixed points inside a search (host-limited composites, the cut mode's load) are flagged only when the pass
the trace reports did not settle, never at a trial point of the search. (Review of 2026-10-04, K-11 and C-10; none of
these paths is reached inside the contract.)

**Water.** Overflow water is $F w$ ($w$ in m3/t), underflow water $U(1 - s_u)/s_u$, and the cyclone
bypass is the underflow water split $R_f = W_u/(W_u + W_o)$. The mill discharge density fixes the
water added at the mill and at the sump; a negative addition is flagged.

### The cut mode (since 0.07.000)

In a plant the cyclone's cut is set by its hardware and its pressure, the mill draws its power, and the
product size and the circulating load follow. The target mode above solves the reverse, which is what a design
study asks. The cut mode is the plant's direction (CM-01 to CM-07; `docs/design/features/cut-mode/`):

- **Input.** The host gangue's corrected cut $d_{50c}$ (`d50c_um`), bounded per case by 0.8 to 1.6 times the cut
  the target mode solves at the nominal state. 0, every case's nominal, is the target mode itself. With a cut
  set, the engine ignores the grind target and the circulating load and reports them as results.
- **The power condition.** At the installed power $P_{inst}$ the energy per pass $e$ is the root of
  $$e\,m(e, d_{50c}) = P_{inst},$$
  with $m$ the mill feed of the pass, solved by Illinois on $\ln e$. The power rises monotonically with $e$ at every
  state the design measured (60 series over the 12 nominal states, cut factors 0.6 to 1.6, energies a quarter to
  four times nominal), so the root is unique where it exists. Where it does not, the mill cannot draw its installed
  power at that cut and the state is refused (E-01) as `power_unreachable_at_cut`; a state whose achieved load
  exceeds 600% is refused as `circulating_load_above_bound`. A refusal is no trace: the service answers 422 and the
  browser shows the reason. Of 368 accepted cut-mode states drawn uniformly over the contract, 90 (24.5%) are
  refused, every one genuinely: the drawn power stays 1.08 to 56 times the installed power over the whole energy
  bracket (review of 2026-10-04, K-05). No target-mode state is refused.
- **The water follows the load.** In the target mode the underflow water, and with it the bypass $R_f$, comes from
  the design load. In the cut mode the load is a result, so each energy is a fixed point on $C$:
  $$W_u = C\,F\,\frac{1 - s_u}{s_u},\qquad R_f = \frac{W_u}{W_u + W_o},\qquad C \leftarrow \frac{U(e, d_{50c}, R_f)}{F},$$
  iterated until two passes agree within $10^{-12}$ (measured to converge at all 1,020 states of the design
  measurement, in at most 20 passes).
- **Flags.** A load outside the 100 to 400% the target mode accepts as an input is flagged
  `circulating_load_out_of_range`; the trace reports the achieved P80 in the target's place and sets the
  `cut_mode` metric.
- **What else changes.** The learned lane keeps sampling the target mode, whose features are the target and the
  design load. The optimizer's grind decision becomes the cut, and its search runs without the screen, saying
  why (`unscreened_reason: cut_mode`).

The engine fix that came with it: the host-limited composite scale divided 0 by 0 in empty size classes, where
round-off leaves the host at about -4e-16 against no composite demand. The cut mode's finest grinds reached it
(the nickel and zinc envelope corners); the host is now clipped at 0 before it limits, in the circuit and in the
particle-class split, in both engines.

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| $\alpha_0, \alpha_1, \alpha_2$ | 0.0091, 0.651, 2.5 | t/kWh (sizes in um), 1, 1 | Moly-Cop BallParam_Direct defaults |
| $d_{crit}$ | 6514 | um | Moly-Cop default |
| $\beta_0, \beta_1, \beta_2$ | 0.4, 0.65, 4.02 | 1 | Moly-Cop documented alternative set |
| reference work index | 12 | kWh/t | declared for the $\alpha_0$ scaling |
| mixer fractions | 0.70, 0.15, 0.15 | 1 | Austin structure; values declared |
| design circulating load | 250% nominal (220% in the phosphate case) (control) | % | operating control |
| mill discharge solids | 72 | % w/w | Moly-Cop base case |
| installed power | 1.12 to 1.13 times the nominal requirement (hard porphyry 1.02, oxide copper 1.20) | kW | authored sizing; every +25% hardness or throughput variant is therefore power-limited |

## Verification

- `tests/test_grinding.py::test_target_and_circulating_load_met` (PE-05): P80 and circulating load
  within 0.5% on every nominal case.
- `tests/test_grinding.py::test_overflow_equals_new_feed_by_mineral` (PE-06).
- `tests/test_grinding.py::test_power_limited_mode` (PE-07).
- `tests/test_grinding.py::test_power_is_energy_times_mill_feed`, `test_power_limit_holds_installed_power_on_the_mill_feed`
  and `test_cut_mode_draws_installed_power_on_the_mill_feed` (C-03): the power is the energy per pass times the mill
  feed in the target mode, at the power limit and in the cut mode, gravity unit included; the browser repeats it
  (`frontend/src/test/grinding-power.test.ts`).
- `tests/test_grinding.py::test_reported_partition_is_the_applied_one` (P-02, page 04).
- `tests/test_roots.py` and `tests/test_grinding.py::test_solver_flags_come_from_the_reported_pass_only` (K-11).
- `tests/test_grinding.py::test_host_limited_composites`: a 39.75% Fe magnetite feed at a 120 um
  target limits the composites of the coarse classes, keeps every class mass non-negative beyond
  round-off, and keeps the particle-class split consistent within 1e-12; the nominal case has
  $s = 1$ in every class.
- `tests/test_grinding.py::test_cut_mode_meets_installed_power` (CM-02): at the nominal state's own cut the mill
  draws its installed power within 1e-9, and the underflow water is the achieved load's.
- `tests/test_grinding.py::test_cut_mode_reports_and_flags` (CM-03): a finer cut raises the load and fines the
  product; the out-of-range flag matches the load; the nominal state stays in the target mode.
- `tests/test_grinding.py::test_modes_agree_at_the_same_state` (CM-04): a target-mode state re-run in the cut mode
  at its own solved cut and drawn power gives back its P80 and load within 1e-9 (the requirement allows 0.5%;
  measured 1.1e-13 and 1.9e-13).
- `tests/test_engine_balances.py::test_cut_mode_closure` (CM-05): every unit and the circuit close within 1e-9 in
  the 24 cut-mode variants.
- `tests/test_oracles.py::test_molycop_base_case` and `test_molycop_feed_is_the_published_distribution` (PE-08,
  amended in 0.08.000): with the BallSim_Direct Data_File's own breakage parameters and every published input
  (504 t/h, the published feed size distribution with F80 6913 um, and the P80 of 169.4 um and the 277% circulating
  load as the solver's targets, so they are inputs, not results), the net specific energy is 7.30 kWh/t against the
  published 7.71, 5.2% below, inside the 20% tolerance set before the first run; the gross is 8.12 against 8.56.
  The Data_File's $\beta_2$ is read from a cell printed apart from its label (UNVERIFIED reading); 3.5 to 4.5 moves
  the net energy from 7.12 to 7.45 kWh/t. Until 0.07.000 the check compared a net engine energy with the gross
  published one, on a Rosin-Rammler feed of assumed slope.

## What it is not

The cut mode holds a corrected cut, not a cyclone's geometry and pressure: the Plitt sizing that follows it is a
report, not a constraint, and most states at 0.8 of the nominal cut flag the pressure window. A single breakage
parameter set per ore, with hardness entering only through the work index; no ball
size, filling or speed effects; no slurry rheology; the mixer fractions are declared, not fitted.
