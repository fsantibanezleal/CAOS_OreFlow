# 08 Desliming

## Theory

Phosphate plants deslime the flotation feed, commonly below about 20 um, because clay slimes consume
fatty-acid collector and entrain into the froth; the price is the apatite lost with the slimes
(Brazilian practice at Catalao, Tapira and Cajati; review in Minerals 9(4):253, 2019,
doi:10.3390/min9040253, cited through its summary because the full text was not reachable on
2026-09-26). A coarser desliming cut makes a cleaner flotation feed and loses more phosphate.
A coarser grind makes fewer slimes, which is why overgrinding a desliming feed costs recovery.

## Implementation

A desliming cyclone on the grinding overflow partitions each particle class with the Rosin-Rammler
form of page 04, a declared sharpness and a water bypass; its cut is an operating control. The
overflow reports to tailings as slimes. The underflow is repulped to a declared solids fraction
before the rougher; the dilution water is audited. Apatite is softer than quartz (relative
grindability 1.4) and clay is very soft (4.0), so fines, and the P2O5 they carry, emerge from the
grinding balance rather than being assumed.

## Parameters

| Parameter | Value | Unit | Source |
|---|---|---|---|
| desliming cut | 20 nominal (control) | um | practice below about 20 um |
| sharpness, water bypass | 2.5, 0.12 | 1, fraction | authored |
| rougher feed solids after repulping | 33 | % w/w | authored |

## Verification

- `tests/test_separation.py::test_deslime_cut_tradeoff` (PE-20): slimes loss rises monotonically
  as the cut coarsens from 12 to 40 um.
- `tests/test_directions.py::test_desliming_coarser_product_reduces_slimes_loss` (PE-22b).

## What it is not

No slime-coating or collector-consumption model; clays act through mass, size and entrainment only.
