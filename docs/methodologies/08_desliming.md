# 08 Desliming

## Theory

Phosphate plants deslime the flotation feed, commonly below about 20 um, because clay slimes consume
fatty-acid collector and entrain into the froth; the price is the apatite lost with the slimes
(Brazilian practice at Catalao, Tapira and Cajati; review in Minerals 9(4):253, 2019,
doi:10.3390/min9040253, cited through its summary because the full text was not reachable on
2026-09-26). A coarser desliming cut sends less clay to flotation and loses more phosphate.
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

No slime-coating, collector-consumption or rheology model; clays act through mass, size and entrainment
only. The engine therefore shows what a coarser cut costs and not the benefit plants deslime for: from 8 to
45 um, recovery and concentrate grade fall together, and only the flotation-stage recovery, a ratio, rises
(`tests/test_case_premises.py`). Until 0.08.000 the phosphate case said the cut "trades lost P2O5 against a
cleaner flotation feed", which the engine never showed (review of 2026-10-02, E-03). Erwin et al. (2023),
citing Lima et al. (2020), states that slimes raise reagent consumption and lower froth stability and
selectivity, without a rate that could be parameterized; a sourced slime model is in the backlog.
