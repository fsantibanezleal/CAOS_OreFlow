# 06 Gravity gold

![A fraction b of the underflow passes the gravity unit; its tail and the rest return to the mill. The engine can also place the unit on the mill discharge, as the published model does.](../svg/06-gravity.svg)

*A fraction b of the underflow passes the gravity unit; its tail and the rest return to the mill. The engine can also place the unit on the mill discharge, as the published model does.*

## Theory

Gravity-recoverable gold (GRG) is the gold a laboratory Knelson recovers from an ore ground in three stages
(Laplante, *A standardized test to determine gravity recoverable gold*): free gold above about 10 um, with its size
distribution and the grind at which it liberates. Across 38 samples GRG runs from 25 to 94% of the gold (mean 63%).
GRG is dense (electrum about 15.7 t/m3) and malleable. It breaks six times slower than the ore at 50 to 100 um and
twenty times slower at 500 to 1000 um (Banisi, cited by Vincent 1997), and cyclones send it to the underflow at sizes
several times finer than the gangue. It therefore builds up in the circulating load, and a gravity unit on part of the
circuit recovers it (Laplante and Staunton, *Gravity recovery of gold, an overview of recent developments*, AMIRA
P420B; Laplante and Gray 2005, Developments in Mineral Processing 15:280-307, doi:10.1016/S0167-4528(05)15013-3).

Laplante, Woodcock and Noaparast (1995) model this with the GRG vector alone. As Vincent (1997, McGill M.Eng. thesis,
Eq. 5.1) states it:

$$d = P R \left[I - H C (I - P R)\right]^{-1} f$$

Here $f$ is the GRG by size generated at the mill discharge from fresh ore, $P$ and $R$ the per-size recoveries of the
gravity units acting on the mill discharge, $C$ the GRG's per-size recovery to the cyclone underflow, and $H$ the GRG
grinding matrix. $H$'s columns sum to less than one because GRG turns into non-GRG by overgrinding, smearing and
flaking. Laplante's sensitivity analysis at Hemlo found the predicted recovery far more sensitive to the GRG vector
(amount and size) than to the unit's performance, the share of the circulating load treated or the grind, and least
sensitive to the GRG's grinding kinetics.

## Implementation

The engine follows that structure inside its own closed-circuit balance (page 03), so the GRG and the ore share one
steady state.

- **The GRG vector.** A mineral may declare grain sizes, as cumulative passing at a GRG test's sieves. It enters the
  mill liberated with those sizes, which the crusher passes unchanged. The gold case's GRG is electrum with Snip's
  measured vector (Vincent 1997, Table 5.1), which Vincent calls extremely fine; the test's -25 um class spreads
  log-uniformly down to 10 um. The rest of the gold is carried in pyrite and floats with it.
- **The partition.** GRG's corrected cut takes the density ratio to an exponent fitted to the measured GRG and solids
  partitions of Laplante and Staunton's Figure 9 (1.13 at Jundee, 0.87 at Marvel Loch):

  $$d_{50c}^{GRG} = d_{50c}^{host}\left(\frac{\rho_{host} - 1}{\rho_{Au} - 1}\right)^{n},\qquad n = 1.0$$

  Stokes' $n = 0.5$, which every other mineral keeps for want of a measurement of its own, puts the GRG cut three to
  four times too coarse at those plants.
- **Breakage.** GRG's selection is the ore's divided by Banisi's slowdown: 6 at 75 um and 20 at 707 um (the centres
  of his ranges), log-log between and constant outside. GRG ground fine leaves by the overflow, which is the engine's
  form of overgrinding into non-GRG.
- **The unit.** A share $b$ of the cyclone underflow, or of the mill discharge as in the model and its published
  example, passes a unit that recovers GRG with

  $$R(d) = R_{max}\left(1 - e^{-(d/x_g)^2}\right),$$

  locked gold with a small fixed recovery and gangue at a small mass yield. On the mill discharge, the GRG balance is
  the engine's form of Eq. 5.1, with $T(e)$ the mill operator at the energy per pass and $p$ the mill discharge:

  $$\left(T^{-1}(e) - \mathrm{diag}\big[C\,(1 - bR)\big]\right) p = f,\qquad d = b\,R\,p$$

  On the underflow the unit takes $bR$ of $Cp$ instead.

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| GRG in the gold case | 45% of the head gold | 1 | authored, inside the 25 to 94% of Laplante's 38 samples |
| GRG size distribution | Snip, second test: 83.7% below 150 um, 20.5% below 25 um | um | Vincent (1997), Table 5.1 |
| GRG lower size | 10 | um | the laboratory Knelson's lower limit (Laplante) |
| GRG density exponent $n$ | 1.0 | 1 | fitted to Laplante and Staunton Figure 9 (1.13 and 0.87) |
| GRG breakage slowdown | 6 at 75 um, 20 at 707 um | 1 | Banisi, cited by Vincent (1997) |
| $R_{max}$, $x_g$ | 0.70, 20 | 1, um | authored: 70% per pass at Camchib (Laplante); a slight drop below 37 um at Meston (Vincent 1997) |
| bleed $b$ | 0.10 of the underflow (control) | fraction | inside the 6 to 25% that practice and Vincent's simulations treat |

At the nominal state the gold case recovers 60.0% of its GRG by gravity, 27.0% of all its gold. That is below the two
thirds of the GRG that Laplante says no plant has reached. Its GRG circulates at 909% against the ore's 250%.

## Verification

- `tests/test_gravity_grg.py`:
  - the GRG enters with its declared sizes, and the oracle and the case declare the same vector;
  - Banisi's slowdown, and the fitted exponent in the partition;
  - on the mill discharge, every unit and the circuit close within 1e-9;
  - without a bleed, both positions agree;
  - the case sits in its sourced range.
- `tests/test_separation.py::test_bleed_response_and_gold_circulating_load` (PE-18): the GRG circulates above the ore
  without gravity and across the 5 to 25% of the stream that practice treats; gravity recovery rises with the bleed,
  with diminishing returns.
- `tests/test_oracles.py::test_laplante_like_for_like`: the published simulator example, like for like (below).

## The published example, like for like

Laplante and Staunton's simulator example (AMIRA P420B, Figures 10 and 11) is a 150 t/h, 2.0 g/t circuit ground to
80% passing 75 um at 250% circulating load. The unit treats 10 to 60% of its mill discharge, and the paper prints
the GRG recovery, the gold recovery and the GRG circulating load at each share; the ore holds 80.4% GRG. The oracle
runs those inputs with the unit on the mill discharge and fits the unit's $R_{max}$ at the 30% row. It compares the
other rows within tolerances set before the first run: 5 points on GRG recovery, 35% on the GRG circulating load.

- **The declared run, with Snip's GRG vector, misses.**
  - Even with the fit at its bound ($R_{max} = 1$), the GRG recovery is 69.5 to 90.7% against 79.8 to 95.9%, 10.3 to
    5.2 points low.
  - The GRG circulating load is 65 to 80% below the printed 2016 to 413%.
  - 9 to 31% of the GRG leaves by the overflow, almost all of it finer than about 37 um.
  - The one shape check agrees: 86.7 to 88.3% of the mill discharge's GRG lies below 150 um, against the printed
    87.7%.
- **The diagnosis.**
  - Without the GRG finer than 25 um, the fitted $R_{max}$ is 0.74. The GRG recovery returns within 1.1 points from
    the 20% row on (4.8 points low at 10%), while the circulating load stays 50 to 69% low.
  - The example's GRG vector is not printed, so the simulator's default ore most likely carries little GRG below
    25 um.
  - The paper does not define the basis of its circulating load. Its unit recovery falls as the feed rate rises (one
    Knelson XT30 at 53 t/h up to an XT70 at 315 t/h), which a single $R_{max}$ does not.
- **Without gravity**, the engine's GRG circulates at 2812% of its feed. The same paper's plant audit (Figure 12,
  another plant) gives an underflow-to-overflow gold grade ratio of 12.6 and 90% GRG in the underflow gold; the engine
  gives 9.3 and 97%.

Until 0.08.000 the gold rode the crushed rock and its liberation model and classified with Stokes' exponent. The
Benchmark set the gold case's recovery of all its gold (13.7 to 31.7%) beside the published GRG figures (review of
2026-10-02, E-11).

## What it is not

- The unit's response is authored, not a fitted Knelson or Falcon unit, and it does not fall with its feed rate.
- Smearing and flaking into non-GRG are not modelled; only overgrinding into the overflow is.
- GRG liberation in the mill is not modelled apart from the declared vector.
- The gravity concentrate is not upgraded further: intensive leaching is outside the scope.
