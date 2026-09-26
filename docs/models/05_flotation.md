# 05 Flotation

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

with a width $w$ that differs below and above the optimum size, collector dose $D$ (g/t) and half-dose
$K_s$. A composite floats on its exposed valuable surface, $P_{comp} = P_V c^{2/3}$. Gangue saturates
at a higher dose than the valuable mineral, so beyond the valuable saturation dose more collector
buys little recovery and floats gangue and poorly liberated particles, lowering grade, which is what
plant practice reports for xanthate (critical review, PMC9572913).

**Entrainment.** Fine free gangue reports to the concentrate with the water. Savassi et al. (1998)
describe the degree of entrainment (Minerals Engineering 11(3):243-256,
doi:10.1016/S0892-6875(98)00003-X; as typeset in Hoang et al. 2019, doi:10.1016/j.cherd.2018.11.036):

$$ENT_i = \frac{2}{\exp\!\left(2.292\,(d_i/\xi)^{adj}\right) + \exp\!\left(-2.292\,(d_i/\xi)^{adj}\right)},\qquad adj = 1 - \frac{\ln(1/\delta)}{\exp(d_i/\xi)},$$

where $\xi$ is the size at which $ENT = 0.2$ and $\delta$ the drainage parameter.

**Cells in series.** Banks of mechanical cells behave as perfect mixers in series. Per cell, with
residence $\tau$, water recovery $r_w$ and $w = r_w/(1 - r_w)$, the recovery of a class is

$$r = \frac{k\tau + ENT\,w}{1 + k\tau + ENT\,w},\qquad R_{bank} = 1 - (1 - r)^N.$$

Without entrainment this is the tanks-in-series result $1 - (N/(N + k\tau_{bank}))^N$; for water
($k = 0$, $ENT = 1$) it returns $r_w$. The derivation is a steady-state balance on one perfectly
mixed cell in which the tail carries the pulp composition and the concentrate carries the floated
mass plus entrained solids at $ENT$ times their concentration per unit of water.

## Circuit

Rougher, optional regrind of the rougher concentrate, cleaner, optional recleaner. Cleaner tails
return to the rougher feed and recleaner tails to the cleaner feed. Residence follows from cell
volume, gas holdup and pulp flow, so a higher feed rate or a larger recycle shortens it. Feed streams
are diluted to a declared solids fraction where a stage requires it (cleaner feed; a deslimed rougher
feed), and the added water is audited. The regrind is the open-circuit population balance of page
03 at a declared specific energy; its product is split into particle classes again because it is a
product of breakage. The circuit is solved by fixed-point iteration to a residual below
1e-10 t/h.

## Outputs

Final concentrate and tails by mineral and size; grades from element contents; overall recovery
against the circuit feed and stage recoveries against each stage's own feed (so upstream losses in
gravity and desliming circuits make them differ); mass pulls; water recoveries; the entrained share
of gangue; a cell-by-cell grade-recovery profile of the rougher; recovery by size.

## Parameters

| Parameter | Typical value | Unit | Source |
|---|---|---|---|
| $J_g$ | 1.3 to 1.4 (control) | cm/s | gas-dispersion literature range 0.5 to 2.5 |
| $D_{32}$ | 0.8 + 0.45 $J_g$ | mm | declared linear form of the reported increase |
| $P$ sulphide, liberated | 1.8e-4 to 3.2e-4 | 1 | authored per case so nominal KPIs fall in literature ranges |
| $x_{opt}$, fine and coarse widths | 30 to 70 um, 1.1 to 1.6, 0.6 to 0.8 | um, ln units | authored within Trahar's size behaviour |
| $K$ valuable, gangue | 12 to 60, 40 to 1500 | g/t | authored; gangue saturates later |
| $\xi$, $\delta$ | 30 to 60 um, 1 | um, 1 | inside the Savassi and Hoang fits |
| water floatability | 2e-6 | 1 | gives 13 to 20% rougher water recovery |
| cleaner and recleaner wash | 0.3 and 0.15 of rougher ENT | 1 | authored froth washing |

## Verification

- `tests/test_flotation.py::test_bank_reduces_to_tanks_in_series` (PE-13)
- `tests/test_flotation.py::test_rate_follows_bubble_surface_flux` (PE-14)
- `tests/test_flotation.py::test_savassi_entrainment` (PE-15)
- `tests/test_flotation.py::test_cleaner_recycle_converges` (PE-16)
- `tests/test_flotation.py::test_stage_and_overall_recovery_are_distinct` (PE-17)
- `tests/test_directions.py::test_collector_trades_grade_for_recovery` (PE-21) and
  `test_aeration_raises_entrainment` (PE-24)

## What it is not

No froth model beyond the recovery factor folded into $P$, no pulp chemistry (pH, Eh, depressants are
represented only by the authored floatabilities, for example lime-depressed pyrite), no cell-by-cell
change in residence, and no collector adsorption balance. The lumped kinetic models of page 11 are
comparisons fitted to this engine, not alternative engines.
