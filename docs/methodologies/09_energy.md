# 09 Energy

![The three laws agree at the reference reduction and diverge away from it; only Bond is reported as the energy.](../svg/09-energy.svg)

*The three laws agree at the reference reduction and diverge away from it; only Bond is reported as the energy.*

## Theory

**Bond.** The specific energy to reduce ore from F80 to P80 (um) is

$$W = W_i\left(\frac{10}{\sqrt{P_{80}}} - \frac{10}{\sqrt{F_{80}}}\right)\ \mathrm{kWh/t},$$

and an operating circuit's work index is recovered from its measured specific energy $W = P/T$
(pinion power over dry throughput) as

$$W_{i,o} = \frac{W}{10/\sqrt{P_{80}} - 10/\sqrt{F_{80}}},$$

with the efficiency ratio $W_{i,std}/W_{i,o}$ (Global Mining Guidelines Group 2021, *Determining the
Bond Efficiency of Industrial Grinding Circuits*, GMG01-MP-2021; Bond 1952, Trans. AIME 193:484-494).
The guideline limits the method to products coarser than about 70 um: "This Bond Efficiency determination should
not be applied to circuits with a P80 of finer than approximately 70 um without making qualifications" (section 2),
below which the ball-mill fineness correction applies (section 4.1, after Bond 1962). The engine reports the ratio
at any P80 and, below 70 um (`bond.efficiency_min_product_um`), flags the state `bond_efficiency_fine_product`; it does
not apply the correction, whose form we have from secondary sources only (the magnetite nominal, at 60 um, carries
the flag; review of 2026-10-04, C-02).

**The energy basis.** The guideline's $W$ is pinion power over dry throughput. The engine's grinding energy is the net
(charge) energy: the Herbst and Fuerstenau selection function is normalised by net power, and the Moly-Cop check of
page 03 compares net with net. So the engine's operating work index is a net-basis figure, and its efficiency ratio,
a pinion-basis standard work index over a net-basis operating one, is optimistic by the drive and no-load share of
the pinion power. No verified source gives that share for these mills (Moly-Cop's declared 10% is its spreadsheet's
net-to-gross loss, not a pinion share), so no factor is applied; the metrics, the formula captions and this page say
which basis they are on, and the installed power a case declares is the power available to the charge, not a motor
rating (review of 2026-10-04, C-01).

**Rittinger and Kick.** Rittinger's law makes energy proportional to new surface,
$E = K_R(1/P - 1/F)$, and Kick's to the reduction ratio, $E = K_K \ln(F/P)$. They are alternative
hypotheses for the same reduction, bracketing Bond at fine and coarse sizes; they are not energy
components and must never be added to Bond (the 0.04.000 engine summed them and reported up to five
times Bond's energy).

## Implementation

- Crushing energy: Bond with the crushing work index, from the crusher feed F80 to the crusher
  product P80. The crushing work index is the case's, scaled with the operating ball-mill work index (at 1.5 times
  the case's work index the soft porphyry crushes at 18.15 instead of 12.1 kWh/t, 1.24 instead of 0.83 kWh/t of
  energy), so a harder ore is harder in both machines; until 0.09.000 this page said the case value was used as it
  stands (review of 2026-10-04, C-07; page 13 states the same scaling for the uncertain work index).
- Grinding energy: the net specific energy the population balance needs, the energy per pass times the mill feed per
  tonne of new feed (page 03; $e(1 + CL)$ without a gravity unit on the underflow). It is the reported grinding energy.
- Regrind energy: the declared regrind specific energy times the regrind feed, per tonne of ore.
- Total: crushing plus grinding plus regrind.
- Bond requirement, operating work index and efficiency ratio for the achieved reduction.
- Rittinger and Kick constants are chosen so both equal Bond at the reference reduction
  10 000 um to 150 um with the case work index; at the case's own reduction they diverge, which is
  the comparison the Methods view shows.

## Verification

- `tests/test_energy.py::test_gmg_worked_example` (PE-09): 3150 kW at 450 t/h from 2500 to 212 um
  gives 7.0 kWh/t and an operating work index of 14.4 kWh/t, and 8.56 kWh/t from 19 300 to 155 um gives
  11.7 kWh/t, as in the guideline.
- `tests/test_energy.py::test_laws_calibrated_and_not_summed` (PE-10).
- `tests/test_directions.py::test_hardness_effects` and `test_grind_energy_and_liberation`.

## What it is not

No motor or transmission losses (the energies are net, see above), no media or liner energy, no Morrell SMC model for
AG/SAG circuits, no fineness correction below 70 um (flagged instead).

The Bond requirement is the standard-circuit energy with one work index over the rod-mill and ball-mill ranges (GMG01-MP-2021, equation 3, with $W_{i,RM} = W_{i,BM}$), and it leaves out Rowland's oversize-feed factor EF4: every nominal mill is fed at the crusher product of 8.4 mm, 1.7 to 2.5 times Rowland's optimum feed size, where EF4 would be 1.02 to 1.34 and raise the efficiency ratio from 0.83 to 0.91 to 0.88 to 1.17.
The test is `tests/test_energy.py::test_bond_feed_factor_disclosure`.

The GMG check (PE-09) runs the operating work index formula on the guideline's published power,
throughput and sizes; it simulates no circuit, and the second example is a rod and ball circuit the
engine does not model.
