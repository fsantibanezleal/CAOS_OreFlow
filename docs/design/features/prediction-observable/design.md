# Prediction observable design

`pipeline.methods.observable` defines the prediction boundary and the standard-library validator of its persisted
range summaries. `learning._scores` applies it after inference and before calculating errors; each per-case score,
comparison fitted on equal training rows, and neural seed run retains its range diagnostics. The artifact validator
loads the same pure summary checker without importing the scientific training stack.

The widened reference is an explicitly declared target observable over the authored evaluation design. It is not
used for fitting transforms, clipping predictions, choosing a model or hiding an inaccurate fold. Training transforms
use only training rows. StandardScaler supplies numerical-constant detection; a near-zero positive variance caused
by roundoff must not amplify an unseen feature by many orders of magnitude.

Non-finite, misaligned and wholly out-of-scale answers fail. Finite constant forecasts on varying observations are
reported as loss of sensitivity. A case-mean baseline is identified as intentionally constant. Neither becomes useful
for operations because it has a valid record. Shape checks, physical plausibility and predictive accuracy remain
separate assessments.

`oreflow.observable/v1` stores rows, observed/predicted/reference ranges, widened limits, baseline declaration and
status. The validator recomputes allowed bounds and status rather than trusting the stored verdict. These summaries
are sufficient for consistency checks, not an independent reconstruction of all predictions or scores.
