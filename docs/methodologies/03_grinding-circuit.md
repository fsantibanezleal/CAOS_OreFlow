# 03 Grinding circuit

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

**Closed circuit.** With the cyclone sending fraction $C_i$ of the mill product to the underflow and
the underflow returning to the mill, the mill feed is $m = f + C p$ and $T^{-1} p = m$, so

$$\left(T^{-1}(e) - \mathrm{diag}(C)\right) p = f.$$

This is one lower-triangular solve per evaluation. At steady state the overflow carries exactly the
new feed of every mineral.

## Implementation

`grinding.GrindingCircuit` builds $D$, $D^2$ and $D^3$ once per mineral, with selection
$S^E_i(L_i g_V + 1 - L_i)$ for a valuable mineral (liberated grains break at their own relative
grindability $g_V$, composites at the ore rate) and $S^E_i g_G$ for gangue. The ore work index scales
$\alpha_0$ by $W_{i,ref}/W_i$. Valuable minerals are solved first; the host gangue locked in their
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

The specific energy per tonne of new feed is $E = e(1 + CL)$ and the mill power is $E\,F$. If that
exceeds the installed power, the circuit runs at installed power ($E = P_{inst}/F$), the cut is solved
again for the design circulating load, and the coarser achieved P80 is reported with
`power_limited`. This is how a harder ore or a higher feed rate coarsens a real, power-limited circuit.

**Water.** Overflow water is $F w$ ($w$ in m3/t), underflow water $U(1 - s_u)/s_u$, and the cyclone
bypass is the underflow water split $R_f = W_u/(W_u + W_o)$. The mill discharge density fixes the
water added at the mill and at the sump; a negative addition is flagged.

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| $\alpha_0, \alpha_1, \alpha_2$ | 0.0091, 0.651, 2.5 | t/kWh (sizes in um), 1, 1 | Moly-Cop BallParam_Direct defaults |
| $d_{crit}$ | 6514 | um | Moly-Cop default |
| $\beta_0, \beta_1, \beta_2$ | 0.4, 0.65, 4.02 | 1 | Moly-Cop documented alternative set |
| reference work index | 12 | kWh/t | declared for the $\alpha_0$ scaling |
| mixer fractions | 0.70, 0.15, 0.15 | 1 | Austin structure; values declared |
| design circulating load | 250% nominal (control) | % | operating control |
| mill discharge solids | 72 | % w/w | Moly-Cop base case |
| installed power | 1.12 times nominal requirement (hard porphyry 1.02) | kW | authored sizing |

## Verification

- `tests/test_grinding.py::test_target_and_circulating_load_met` (PE-05): P80 and circulating load
  within 0.5% on every nominal case.
- `tests/test_grinding.py::test_overflow_equals_new_feed_by_mineral` (PE-06).
- `tests/test_grinding.py::test_power_limited_mode` (PE-07).
- `tests/test_grinding.py::test_host_limited_composites`: a 39.75% Fe magnetite feed at a 120 um
  target limits the composites of the coarse classes, keeps every class mass non-negative beyond
  round-off, and keeps the particle-class split consistent within 1e-12; the nominal case has
  $s = 1$ in every class.
- `tests/test_oracles.py::test_molycop_base_case` (PE-08): with the Moly-Cop defaults and base-case
  inputs (504 t/h, F80 6913 um, P80 169.4 um, 277% circulating load), the specific energy lands
  within 20% of the reported 8.56 kWh/t. The engine gives 9.13 kWh/t with the Rosin-Rammler feed
  slope of 0.9 used by the test, and 8.86 to 9.30 kWh/t for slopes 0.7 to 1.1; the published example
  does not state its feed shape.

## What it is not

A single breakage parameter set per ore, with hardness entering only through the work index; no ball
size, filling or speed effects; no slurry rheology; the mixer fractions are declared, not fitted.
