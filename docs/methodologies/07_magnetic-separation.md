# 07 Magnetic separation

## Theory

Low-intensity magnetic separators (LIMS, 800 to 2000 G drums) recover magnetite almost completely,
including composites that carry enough magnetite, so the concentrate's iron grade is set by how much
silica those composites carry, which is set by the grind. At Zandrivierspoort a 35.7% Fe feed gave
64.9% Fe (7.7% SiO2) at 80% passing 75 um and 69.0% Fe (2.25% SiO2) at 80% passing 45 um, with rougher
magnetite recovery above 98% (Muthaphuli 2014, J. S. Afr. Inst. Min. Metall. 114(7)).

## Implementation

The grinding overflow feeds a rougher drum and a cleaner drum. Capture probabilities per particle
class and size:

- liberated magnetite: $p_{max}\,(1 - e^{-d/d_f})$, the ultrafine loss at small $d$;
- composites: $p_{max}\,(1 - e^{-c/c_0})\,(1 - e^{-d/d_f})$, rising with their magnetite content $c$;
- free gangue: entrapment $e_0 + e_1 e^{-d/d_e}$, scaled by a cleaner factor in the second drum.

Concentrate water follows a declared concentrate solids fraction. Fe grade and recovery come from
the mineral balance: magnetite at 72.36% Fe and an iron-bearing silicate gangue at a declared 5% Fe.
Recovery is reported both as total Fe and as magnetite (magnetic Fe).

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| $p_{max}$, $d_f$ | 0.995, 1.5 | 1, um | authored; rougher recovery above 98% reported |
| $c_0$ | 0.1 | 1 | authored composite response |
| $e_0$, $e_1$, $d_e$ | 0.02, 0.12, 12 | 1, 1, um | authored entrapment |
| cleaner factor | 0.4 | 1 | authored |
| magnetite liberation size, slope | 130, 2.0 | um, 1 | authored banded-ore texture |

## Verification

- `tests/test_separation.py::test_grade_rises_with_finer_grind` (PE-19): magnetite recovery above
  90% and Fe grade rising from 75 to 60 to 45 um.
- `tests/test_oracles.py::test_zandrivierspoort_trend`: grade at 75 um near 63 to 67% Fe and at 45 um
  near 66 to 71% Fe, a rise of more than 1.5 points, as published.

## What it is not

No field strength, drum speed or magnetic flocculation model; no reverse flotation of silica.
