# 06 Gravity gold

## Theory

Free gold is dense (electrum about 15.7 t/m3) and malleable, so it breaks slowly and cyclones return
almost all gravity-recoverable gold (GRG) to the mill. Gold therefore circulates many times more than
the ore does, and a gravity concentrator installed on a bleed of the cyclone underflow recovers it
(Laplante and Staunton, *Gravity recovery of gold, an overview of recent developments*, AMIRA P420B;
Laplante and Gray 2005, Developments in Mineral Processing 15:280-307,
doi:10.1016/S0167-4528(05)15013-3). Measured GRG contents range from about 25 to 92% across ores,
GRG is mostly 15 to 300 um, and marginal GRG lies below about 20 um.

## Implementation

Gold is a mineral in the grinding circuit like any other, with liberation by size, a slow
grindability for liberated grains (0.15 of the ore rate) and the density correction of page 04. A
fraction $b$ of the underflow (the bleed) passes a gravity unit that recovers liberated gold with

$$E_g(d) = E_{max}\left(1 - e^{-(d/x_g)^2}\right),$$

composite gold with a small fixed recovery and gangue at a small mass yield. The mill recycle becomes
$(1 - b\,E_{eff})\,C\,p$, still linear, so the closed-circuit solve of page 03 is unchanged in form.
Overall gold recovery is the gravity concentrate plus the flotation concentrate; the rest of the gold
is carried in pyrite and floats with it.

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| gold held as free electrum | 45% of head gold | 1 | authored, inside the 25 to 92% GRG range |
| electrum liberation size | 400 | um | authored free-milling ore |
| $E_{max}$, $x_g$ | 0.8, 30 | 1, um | authored per-pass concentrator response |
| bleed $b$ | 0.3 nominal (control) | fraction of underflow | Laplante example treats 10 to 60% |

## Verification

- `tests/test_separation.py::test_bleed_response_and_gold_circulating_load` (PE-18): gold circulating
  load exceeds the ore's at every bleed; gravity recovery rises with bleed with diminishing returns.
- `tests/test_oracles.py::test_laplante_trend`: the same shape as the Laplante simulator example
  (treating 10, 30 and 60% of the underflow), and the gold circulating load falls as more is treated.

## What it is not

The concentrator response is authored, not a fitted Knelson or Falcon unit; the gravity concentrate
is not upgraded further (intensive leaching is out of scope).
