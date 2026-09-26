# 09 Energy

## Theory

**Bond.** The specific energy to reduce ore from F80 to P80 (um) is

$$W = W_i\left(\frac{10}{\sqrt{P_{80}}} - \frac{10}{\sqrt{F_{80}}}\right)\ \mathrm{kWh/t},$$

and an operating circuit's work index is recovered from its measured specific energy $W = P/T$
(pinion power over dry throughput) as

$$W_{i,o} = \frac{W}{10/\sqrt{P_{80}} - 10/\sqrt{F_{80}}},$$

with the efficiency ratio $W_{i,std}/W_{i,o}$ (Global Mining Guidelines Group 2021, *Determining the
Bond Efficiency of Industrial Grinding Circuits*, GMG01-MP-2021; Bond 1952, Trans. AIME 193:484-494).
The guideline limits the method to products coarser than about 70 um.

**Rittinger and Kick.** Rittinger's law makes energy proportional to new surface,
$E = K_R(1/P - 1/F)$, and Kick's to the reduction ratio, $E = K_K \ln(F/P)$. They are alternative
hypotheses for the same reduction, bracketing Bond at fine and coarse sizes; they are not energy
components and must never be added to Bond (the 0.04.000 engine summed them and reported up to five
times Bond's energy).

## Implementation

- Crushing energy: Bond with the case crushing work index, from the crusher feed F80 to the crusher
  product P80.
- Grinding energy: the specific energy the population balance needs, $E = e(1 + CL)$ per tonne of new
  feed (page 03). It is the reported grinding energy.
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

No motor or transmission losses, no media or liner energy, no Morrell SMC model for AG/SAG circuits.
