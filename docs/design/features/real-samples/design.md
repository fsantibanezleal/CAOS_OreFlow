# Real-sample mode design

## Sources

- **GeoMet** (Zenodo 7051975, CC BY 4.0, Hoffimann et al. 2022). Two tables share 21 holes but no sample
  coordinates:
  - 60 comminution samples with BWI test values;
  - 53 locked-cycle tests, 52 of them usable (the GeoMet lane's ledger).

  A locked-cycle sample takes the work index of the nearest comminution sample in its drill hole (3-D distance
  on the samples' X, Y, Z), or else the deposit median. The record says which, and the distance.
- **Iron plant** (Kaggle 6294 v1, CC0). Hours from the soft-sensor lane's artifact: the hour's sensor medians,
  its lab grades, and the lane's out-of-fold prediction and persistence baseline for the next hour. No raw row is
  committed; the artifact is compact and attributed, as IS-01 to IS-06 require.

## Normative mineralogy

Measured on 2026-09-28: the samples' sulphur cannot cover chalcopyrite.
- Of 53 locked-cycle samples, 52 fall short; 37 are below even bornite's need.
- The median S/Cu is 0.35 by mass; chalcopyrite needs 1.01, bornite 0.40 and chalcocite 0.25.

The allocation is therefore sulphur-limited, in moles (c Cu, s S):

| Sulphur | Copper minerals |
|---|---|
| `s >= 2c` | chalcopyrite `c`; pyrite from the remaining S |
| `0.8c <= s < 2c` | chalcopyrite `(5s - 4c)/6`, bornite `(2c - s)/6` |
| `0.5c <= s < 0.8c` | bornite `(2s - c)/3`, chalcocite `(4c - 5s)/3` |
| `s < 0.5c` | excluded, with the reason in the ledger |

All 53 samples fall in the first three rows. In the median one of the 52 that run (the one without a measured recovery
is excluded), bornite carries 56% of the copper and chalcocite 38%.
- The remaining iron is not identified by the assays. It goes to magnetite, as an assumption shown with the result.
- Quartz closes the mass. The case's own 2.5% pyrite is not kept: pyrite enters only when the allocation gives it
  (the one sample in the chalcopyrite-and-pyrite band), so the sample's sulphur is held by its copper minerals and
  that pyrite alone (`pipeline/cases/real_samples.py`, `sample_ore`; review of 2026-10-02, S-21).
- The atomic weights are the engine's (`chemistry`). The allocation is sequential; Whiten (2007) and Lund et al.
  (2013) describe the least-squares generalization.
- The allocation is labelled an assumption on every surface that shows it.

**Bornite and chalcocite** join the mineral catalogue, with:
- formulas and densities;
- element contents from the atomic weights;
- flotation parameters authored relative to chalcopyrite from Tafirenyika et al. (2022) and Jiang et al. (2025),
  each labelled authored and sourced.

This is research task T2a, done before T2.

## Engine run

The soft porphyry's plant and nominal operating point run on:
- the sample's ore: the case's minerals with the sample's proportions;
- the sample's head grade and work index.

The liberation, breakage and flotation parameters stay the case's. The Case view lists them as authored. The
record keeps:
- the engine's recovery;
- the measured locked-cycle recovery;
- the GeoMet lane's out-of-fold predictions (hole folds);
- the difference, labelled as a comparison between a locked-cycle test and a simulated plant, not a
  calibration.

## Workbench

- The rail gets a top-level source selector: synthetic case, GeoMet sample or iron-plant hour.
- A sample list gives each sample's id and hole, and a search.
- Each view either reacts to the source or states why it does not apply:
  - for an iron-plant hour, Grinding, Separation and Circuit say that the reverse cationic circuit is not an
    engine family;
  - every view but Case says so; the Case view shows the hour, its sensors, its two assays and the soft sensor's
    recorded forecasts, and the workbench opens on it (`Workbench.tsx`; review of 2026-10-02, S-21). The soft
    sensor's whole record is on the Benchmark's Industrial quality tab.
- The URL carries the source, so a sample is a link.
