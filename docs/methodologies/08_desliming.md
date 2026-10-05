# 08 Desliming

![The desliming cyclone sends the slimes to tailings and the deslimed underflow, repulped, to the rougher.](../svg/08-desliming.svg)

*The desliming cyclone sends the slimes to tailings and the deslimed underflow, repulped, to the rougher.*

## Theory

Phosphate flowsheets deslime ahead of flotation to discard the clay minerals and remove the detrimental effect of
slimes on the flotation that follows; amine collectors in particular are sensitive to slimes, and long-chain fatty
acids are the common anionic collectors (Ruan, He and Chi 2019, *Review on beneficiation techniques and reagents used
for phosphate ores*, Minerals 9(4):253, doi:10.3390/min9040253, read in full on 2026-10-03). Fine particles also
entrain into the froth (Hoang et al. 2019, doi:10.1016/j.cherd.2018.11.036). The price is the apatite lost with the
slimes. The review gives no desliming size, so the engine's 20 um cut is authored; the 0.07 pages' "below about
20 um" and "about 35% P2O5" came from a search summary and are not in the review, which asks the wet phosphoric-acid
process for a concentrate above 30% P2O5. A coarser desliming cut sends less clay to flotation and loses more phosphate.
A coarser grind makes fewer slimes, which is why overgrinding a desliming feed costs recovery.

## Implementation

A desliming cyclone on the grinding overflow partitions each particle class with the Rosin-Rammler
form of page 04 and a declared sharpness. Its cut, an operating control (`deslime_cut_um`), is the corrected
(bypass-free) cut of the host quartz; every other class is cut at its density-corrected size, as in the grinding
cyclone (apatite at 0.87 of the control, 17.4 um at the nominal 20 um; kaolinite at 1.01 of it; declared grains with
the fitted GRG exponent of page 06), and the bypass sends the same share of every class to the underflow, so no
partition falls below it.

Like the grinding cyclone it has a declared underflow density $s_u$, and its water split, which is also the bypass
$R_f$, follows the solids it sends down. With $W$ the feed water, $X$ the feed solids and $Y = \sum_k y_k x_k$ the
solids the corrected partition sends down, $R_f W = U (1 - s_u)/s_u$ and $U = R_f X + (1 - R_f) Y$ give

$$R_f = \frac{k\,Y}{1 - k X + k Y},\qquad k = \frac{1 - s_u}{s_u W},$$

a closed form; $R_f$ is capped at 1 with `deslime_water_short` when the feed water cannot carry the solids at that
density (no contract state does). Until 0.09.000 the split was a fixed 12% of the feed water whatever the solids,
and at the contract's 1 m3/t the underflow reached 84 to 88% w/w, 66 to 73% by volume, more than a flowing underflow
can hold (review of 2026-10-04, P-04). The declared 70% w/w is the underflow density that model gave at the nominal
state (45.6% by volume), so the nominal is kept and the low-water states are physical. The overflow reports to
tailings as slimes. The underflow is repulped to a declared solids fraction
before the rougher; the dilution water is audited. Apatite is softer than quartz (relative
grindability 1.4) and clay is very soft (4.0), so fines, and the P2O5 they carry, emerge from the
grinding balance rather than being assumed.

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| desliming cut | 20 nominal (control) | um | authored; the review gives no size |
| sharpness | 2.5 | 1 | authored |
| underflow solids | 70 | % w/w | authored: the nominal underflow density of the 0.08 model (the water split follows) |
| rougher feed solids after repulping | 33 | % w/w | authored |

## Verification

- `tests/test_separation.py::test_deslime_cut_tradeoff` (PE-20): slimes loss rises monotonically
  as the cut coarsens from 12 to 40 um.
- `tests/test_directions.py::test_desliming_coarser_product_reduces_slimes_loss` (PE-22b).
- `tests/test_separation.py::test_deslime_underflow_leaves_at_its_declared_density` (P-04), at the nominal state and
  at 1 and 4 m3/t; `test_deslime_classifies_declared_grains_with_the_grg_exponent` (L-1);
  `test_cut_mode_refuses_a_desliming_cut_above_half_the_achieved_product` (K-02, page 01).

## What it is not

No slime-coating, collector-consumption or rheology model; clays act through mass, size and entrainment
only. The engine therefore shows what a coarser cut costs and not the benefit plants deslime for: from 8 to
45 um, recovery and concentrate grade fall together, and only the flotation-stage recovery, a ratio, rises
(`tests/test_case_premises.py`). Until 0.08.000 the phosphate case said the cut "trades lost P2O5 against a
cleaner flotation feed", which the engine never showed (review of 2026-10-02, E-03). Erwin et al. (2023),
citing Lima et al. (2020), states that slimes raise reagent consumption and lower froth stability and
selectivity, without a rate that could be parameterized; a sourced slime model is in the backlog.
