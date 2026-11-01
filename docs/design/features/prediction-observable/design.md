# Prediction observable design

`pipeline.methods.observable` defines the prediction boundary and the standard-library validator of its persisted
range summaries. `learning._scores` applies it after inference and before calculating errors; each per-case score,
comparison fitted on equal training rows, and neural seed run retains its range diagnostics. The artifact validator
loads the same pure summary checker without importing the scientific training stack.

The widened reference is an explicitly declared target observable over the authored evaluation design. It is not
used for fitting transforms, clipping predictions, choosing a model or hiding an inaccurate fold. Training transforms
use only training rows. StandardScaler supplies numerical-constant detection; a near-zero positive variance caused
by roundoff must not amplify an unseen feature by many orders of magnitude.

Non-finite and misaligned answers fail the evaluation. Interpolation range failures also abort. A finite transfer
prediction wholly outside the widened range becomes an explicit `rejected-transfer` record in `oreflow.learning/v2`,
with `valid_for_scoring=false`, null RMSE, MAE and R2, unmodified diagnostics and model/target/protocol/fold/seed
context. The specific `PredictionRejected` exception is the only failure converted; fitting and programming errors
remain fatal. Individual case checks prevent a pooled group from hiding an entirely invalid constituent case.
No clipping or refitting uses the reference. The full-design reference includes held-out labels and is a postfit
gross-range diagnostic, not a test of training support. It can miss extreme individual outliers if some predictions
overlap the widened range; a scoreable record does not establish physical validity at every point.

Finite constant forecasts on varying observations are
reported as loss of sensitivity. A case-mean baseline is identified as intentionally constant. Neither becomes useful
for operations because it has a valid record. Shape checks, physical plausibility and predictive accuracy remain
separate assessments.

Conditional transfer summaries use only scoreable folds and carry attempted/scored/rejected counts beside every
model and target. They must not rank models with different surviving cohorts. `common_cohorts` lists the folds
admissible for every model, the excluded fold identifiers, and mean RMSE/median R2 on that common set. Empty sets
have null metrics. All neural seed scores and case-mean baseline diagnostics remain in the artifact. The
standard-library artifact checker recomputes summary metrics, denominators, matched membership and score identity
from the stored fold records.

`oreflow.observable/v1` stores rows, observed/predicted/reference ranges, widened limits, baseline declaration and
status. The validator recomputes allowed bounds and status rather than trusting the stored verdict. These summaries
are sufficient for consistency checks, not an independent reconstruction of all predictions or scores.
