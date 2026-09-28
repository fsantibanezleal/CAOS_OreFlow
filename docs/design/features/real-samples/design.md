# Real-sample mode design

## Sources

- **GeoMet** (Zenodo 7051975, CC BY 4.0, Hoffimann et al. 2022). Two tables share 21 holes but no sample
  coordinates:
  - 60 comminution samples with BWI test values;
  - 53 locked-cycle tests, 52 of them usable (the GeoMet lane's ledger).

  A locked-cycle sample takes the work index of the nearest comminution sample in its drill hole along the
  hole's depth, or else the deposit median. The record says which, and the depth difference.
- **Iron plant** (Kaggle 6294 v1, CC0). Hours from the soft-sensor lane's artifact: the hour's sensor medians,
  its lab grades, and the lane's out-of-fold prediction and persistence baseline for the next hour. No raw row is
  committed; the artifact is compact and attributed, as IS-01 to IS-06 require.

## Normative mineralogy

From the head assays in ppm:
- chalcopyrite `CuFeS2` takes all the Cu;
- its S need is `Cu * 2 M_S / M_Cu`, and the remaining S goes to pyrite `FeS2`;
- the remaining mass is the case's gangue minerals, in their authored proportions.

The atomic weights are the engine's (`chemistry`). The allocation is sequential (Whiten 2007 and Lund et al.
2013 describe the least-squares generalization), and it is labelled an assumption on every surface that shows it.

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
  - the Methods view shows the soft-sensor record.
- The URL carries the source, so a sample is a link.
