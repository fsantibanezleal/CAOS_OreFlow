# 05 Flotation

![The rougher bank, the optional regrind, the cleaner and the optional recleaner; the cleaner tail returns to the rougher feed and the recleaner tail to the cleaner feed.](../svg/05-flotation.svg)

*The rougher bank, the optional regrind, the cleaner and the optional recleaner; the cleaner tail returns to the rougher feed and the recleaner tail to the cleaner feed.*

## Theory

**Rate from bubble surface area flux.** Gorain, Franzidis and Manlapig showed in industrial cells
that the flotation rate constant is not governed by gas velocity, bubble size or gas holdup
separately but by their combination in the bubble surface area flux, $k = P\,S_b\,R_f$ with
$S_b = 6 J_g / D_{32}$ (Minerals Engineering 10(4):367-379, 1997, doi:10.1016/S0892-6875(97)00014-9;
12(3):309-322, 1999, doi:10.1016/S0892-6875(99)00008-4). $P$ is a floatability of the particle class
and $R_f$ a froth recovery factor, folded into $P$ here. The Sauter bubble size grows with gas
velocity (Nesset et al. 2006, Minerals Engineering 19:807-815), so $S_b$ saturates at high air.

**Size, liberation and collector.** Recovery falls at fine and coarse sizes (Trahar 1981, Int. J.
Miner. Process. 8(4):289-327, doi:10.1016/0301-7516(81)90019-3). Each class's rate is

$$k_{s,i} = 60\,P_s\,S_b\;\exp\!\left(-\tfrac12\left[\ln(d_i/x_{opt})/w\right]^2\right)\;\left[u + (1-u)\frac{D}{D + K_s}\right]\ \ \mathrm{min}^{-1},$$

with a width $w$ that differs below and above the optimum size, an unresponsive share $u$ (a natural
floatability), collector dose $D$ (g/t) and half-dose $K_s$. A composite floats on its exposed valuable surface,
which goes as the two-thirds power of the valuable's volume share in the particle:

$$P_{comp} = P_V\,\varphi^{2/3},\qquad \varphi = \frac{c/\rho_V}{c/\rho_V + (1 - c)/\rho_{host}},$$

with $c$ the declared mass content. Until 0.09.000 the mass content itself was raised to 2/3, which made composites
float 7% (fluorapatite) to 47% (arsenopyrite) too fast and nominal recoveries 0.24 to 2.71 points too high (review of
2026-10-04, F-01). In the sulphide cases the gangue saturates at a higher dose than the valuable mineral (pyrite at 40
g/t and quartz at 150 g/t against 12 to 25 g/t), so beyond the valuable saturation dose more collector buys little
recovery and floats gangue and poorly liberated particles, lowering grade. In the phosphate and oxide copper cases the
valuable minerals need more collector (fluorapatite 250 g/t, chrysocolla 200 g/t) than quartz, the least floatable
gangue, while the clays and calcite saturate later still (300 to 1500 g/t). The form is authored. The
chalcopyrite/pyrite review of Castellón et al. (2022, Materials 15(19):6536, doi:10.3390/ma15196536) supports its
direction: collectors are not selective enough, so a significant portion adheres to pyrite and other gangue, and an
appropriate dose gives the best performance while an excess may lower recovery, which the model does not represent.

**Entrainment.** Fine free gangue reports to the concentrate with the water. Savassi et al. (1998)
describe the degree of entrainment (Minerals Engineering 11(3):243-256,
doi:10.1016/S0892-6875(98)00003-X; as typeset in Hoang et al. 2019, doi:10.1016/j.cherd.2018.11.036):

$$ENT_i = \frac{2}{\exp\!\left(2.292\,(d_i/\xi)^{adj}\right) + \exp\!\left(-2.292\,(d_i/\xi)^{adj}\right)},\qquad adj = 1 - \frac{\ln(1/\delta)}{\exp(d_i/\xi)},$$

where $\xi$ is the size at which $ENT = 0.2$ and $\delta$ the drainage parameter.

**Water.** Water reports to the froth as if it floated at first order, with a water floatability $P_w$ on the same
bubble surface area flux:

$$k_w = 60\,P_w\,S_b,\qquad r_w = \frac{k_w\tau}{1 + k_w\tau},\qquad w = \frac{r_w}{1 - r_w} = k_w\tau.$$

This form is authored (no published water-recovery law of it was found); it makes water recovery rise with $S_b$ and
with residence, and the one constant $P_w$ = 2e-6 gives 14 to 21% rougher water recovery on the nominal states.

**Cells in series.** Banks of mechanical cells behave as perfect mixers in series. Per cell, with
residence $\tau$ and $w$ above, the recovery of a class is

$$r = \frac{k\tau + ENT\,w}{1 + k\tau + ENT\,w},\qquad R_{bank} = 1 - \prod_{j=1}^{N} (1 - r_j).$$

The derivation is a steady-state balance on one perfectly mixed cell in which the tail carries the pulp composition
and the concentrate carries the floated mass plus entrained solids at $ENT$ times their concentration per unit of
water. The tail carrying the pulp composition makes the residence the cell's pulp volume over its own tail flow,

$$\tau_j = \frac{V (1 - \varepsilon_g)}{Q_{tail,j}},$$

and the tail flow depends on what the cell recovers, so each cell is a scalar fixed point on $Q_{tail}$ (solved by
secant from the feed flow, within a relative 1e-13), and the cells are solved in series, each fed the tail of the one
before. Without entrainment and with a negligible pull this is the tanks-in-series result
$1 - (N/(N + k\tau_{bank}))^N$; for water ($k = 0$, $ENT = 1$) a cell returns $r_w$. Until 0.09.000 every cell took
the bank feed's flow, which understated the residence by the volume sent to the concentrate: final recovery was 0.3 to
1.0 points low and grade 0.1 to 0.6 units high (review of 2026-10-04, F-02).

## Circuit

Rougher, optional regrind of the rougher concentrate, cleaner, optional recleaner. Cleaner tails
return to the rougher feed and recleaner tails to the cleaner feed. Residence follows from cell
volume, gas holdup and each cell's tail flow, so a higher feed rate or a larger recycle shortens it. Feed streams
are diluted to a declared solids fraction where a stage requires it (cleaner feed; a deslimed rougher
feed), and the added water is audited. The regrind is the open-circuit population balance of page
03 at a declared specific energy; its product is split into particle classes again because it is a
product of breakage. The circuit is solved by fixed-point iteration until the largest change
between passes is below 1e-10 t/h and the largest change of any particle class, relative to that
class's own flow, is below 1e-12. The relative criterion matters for trace minerals: with the
absolute one alone, gold at 1e-4 t/h stopped 1.8e-9 out of balance at the rougher junction of the
free-milling gold case, which the operating-envelope gate caught.

## Outputs

Final concentrate and tails by mineral and size; grades from element contents; overall recovery
against the circuit feed and stage recoveries against each stage's own feed (so upstream losses in
gravity and desliming circuits make them differ); the overall mass pull against the circuit feed and the rougher's
against its own feed (fresh feed plus the cleaner recycle, the basis of its recovery; until 0.09.000 it was against the
fresh flotation feed, 7 to 17% higher, review F-05); water recoveries; the entrained share of gangue, defined as the
share of the rougher concentrate's free gangue that the rougher recovered by entrainment,
$\sum x\,R\,s / \sum x\,R$ over the free gangue classes, with $s$ each class's entrained share of what the bank
recovers (until 0.09.000 an undefined mix of the final concentrate and the rougher's share, review F-04 and K-08); a
cell-by-cell grade-recovery profile of the rougher; recovery by size.

## Parameters

The ranges are the values the twelve cases run (review of 2026-10-04, F-06: the table had stated narrower ones).

| Parameter | Value in the cases | Unit | Source |
|---|---|---|---|
| $J_g$ | 1.2 to 1.4 at the nominal states (control) | cm/s | gas-dispersion literature range 0.5 to 2.5 |
| $D_{32}$ | 0.8 + 0.45 $J_g$ | mm | declared linear form of the reported increase |
| $P$ valuable sulphide, liberated | 1.2e-4 (arsenopyrite) to 3.2e-4 (chalcopyrite) | 1 | authored per case so nominal KPIs fall in their plausibility ranges (cited or authored) |
| $P$ valuable non-sulphide | electrum 2.5e-4, fluorapatite 1.8e-4, malachite 3.5e-4, chrysocolla 1e-5 | 1 | authored, as above |
| $P$ gangue | 6e-7 (lizardite) to 7e-5 (the oxide copper's kaolinite) | 1 | authored, as above |
| $x_{opt}$, fine and coarse widths | valuable 35 to 70 um, gangue 15 to 60 um; 1.1 to 1.6; 0.6 to 0.8 | um, ln units | authored within Trahar's size behaviour |
| $K$ valuable | sulphides 12 to 25, malachite 60, chrysocolla 200, fluorapatite 250 | g/t | authored |
| $K$ gangue | 30 (pyrrhotite) to 1500 (the clays) | g/t | authored |
| $u$ | 0.05 for sulphides, 0.6 molybdenite, 0.02 fluorapatite, 0 for oxides and gangue | 1 | authored natural floatability |
| $\xi$, $\delta$ | 30 to 60 um, 1 | um, 1 | inside the Savassi and Hoang fits |
| water floatability $P_w$ | 2e-6 | 1 | authored; gives 14 to 21% rougher water recovery |
| cleaner and recleaner wash | 0.3 and 0.15 of rougher ENT (oxide copper 0.6 and 0.45) | 1 | authored froth washing |

## Verification

- `tests/test_flotation.py::test_bank_reduces_to_tanks_in_series` (PE-13)
- `tests/test_flotation.py::test_a_cell_takes_its_residence_on_its_own_tail_flow` and
  `test_a_bank_is_its_cells_in_series` (F-02); `test_composite_rate_goes_with_the_valuable_volume_share` (F-01);
  `test_rougher_metrics_share_the_rougher_basis` (F-04, F-05)
- `tests/test_flotation.py::test_rate_follows_bubble_surface_flux` (PE-14)
- `tests/test_flotation.py::test_savassi_entrainment` (PE-15)
- `tests/test_flotation.py::test_cleaner_recycle_converges` (PE-16)
- `tests/test_flotation.py::test_stage_and_overall_recovery_are_distinct` (PE-17)
- `tests/test_directions.py::test_collector_trades_grade_for_recovery` (PE-21) and
  `test_aeration_raises_entrainment` (PE-24)

## What it is not

No froth model beyond the recovery factor folded into $P$, no pulp chemistry (pH, Eh, depressants are
represented only by the authored floatabilities, for example lime-depressed pyrite), no cell-by-cell
change in gas holdup or aeration, and no collector adsorption balance. The lumped kinetic models of page 11 are
comparisons fitted to this engine, not alternative engines.

The cleaner and recleaner volumes are fixed, so a richer feed, which sends more mass to them, shortens their residence: between each case's head-grade bounds recovery falls in nine cases (by up to 6.3 points in the zinc case), stays flat in the two gold cases and rises in the magnetite case, where the silicate's iron is a smaller share of a richer head. A nearly constant tail, which would make recovery rise with the head, is reported for sulphide copper plants by a secondary source only, so it is stated here and not tested. The direction counts are a test, `tests/test_directions.py::test_head_grade_direction`.
