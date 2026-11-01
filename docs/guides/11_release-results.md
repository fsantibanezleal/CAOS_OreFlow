# Collect release result tables

`scripts/collect_results.py` prepares manuscript reconciliation tables from a
completed, validated derived-artifact snapshot. It reads learning v2, the case
index, every referenced manifest and every case artifact. It uses only the
standard library and never fits models. Historical learning v1 is refused.

Wait for the bake and artifact adoption to finish. Matching identities and hashes
are necessary evidence, not a substitute for full producer validation.

## Run

From the repository root with the existing environment:

```powershell
$releaseVersion = (Get-Content VERSION -Raw).Trim()
.venv/Scripts/python.exe scripts/collect_results.py --derived data/derived --expected-version $releaseVersion
```

The default writes Markdown to stdout. To export both formats, configure an
external `CAOS_TEMP_ROOT` first and choose fresh output names:

```powershell
$releaseVersion = (Get-Content VERSION -Raw).Trim()
$resultsDirectory = Join-Path $env:CAOS_TEMP_ROOT "oreflow/release-results-$releaseVersion"
.venv/Scripts/python.exe scripts/collect_results.py `
  --derived data/derived --expected-version $releaseVersion `
  --json (Join-Path $resultsDirectory 'results.json') `
  --markdown (Join-Path $resultsDirectory 'results.md')
```

The collector does not load `.env` or choose storage implicitly; the shell supplies
these paths. On POSIX use the existing `.venv/bin/python` with the same flags and
explicit paths. `--json -` selects JSON stdout, and `--markdown -` selects Markdown
stdout. Only one format may use stdout at once.

Destinations must resolve outside the repository and input tree, including through
symlinks/junctions. Existing files are refused. Missing external parent directories
are created; inputs are never changed. Exit 0 means successful collection, exit 1
names invalid evidence or a destination, and argparse usage errors exit 2. Export
failure can leave a newly created partial output; rerun to fresh paths.

## API and output

The script exposes `collect(derived: Path, expected_version: str | None = None)
-> dict` and `render_markdown(result: dict) -> str`. Invalid evidence raises
`ValueError`. Always pass the intended release version: otherwise mutual identity
is checked, but the tool cannot know which release you intend.

JSON identifies itself as `oreflow.release-results/v1`, preserves numerical
precision and nulls, and adds no clock values. Markdown prints ten significant
digits; use JSON when choosing manuscript rounding. Output contains:

- Engine version, contract digest, design/settings and actual case, variant,
  fold, group and seed counts, derived from the records.
- SHA256 and byte counts for every consumed JSON input, plus the collector,
  observable/cohort validators, learning schema and constants.
- Conditional summaries for every algorithm, protocol and target: attempted,
  scored/rejected folds, scored/rejected rows, rejected IDs and mean/max RMSE and
  median R². Rejected-row totals count excluded folds; affected rows identify the
  subset failing the observable check.
- Every interpolation, case and transfer score, with nulls/status/rows/units and
  rejection diagnostics. Transfer combines grouped folds and singleton-group
  case folds; JSON retains the original evaluation identity for auditing.
- Within-case interpolation, case-mean baseline, equal-training-row interpolation
  controls and matched cohorts shared by all models, with included/excluded IDs.
- Every MLP seed score and per-seed denominator/summary; GP per-fold and pooled
  coverage; guard rates, feature/distance diagnostics and probe counts.
- Every case variant's simulator metrics and optimizer outcome, paired exact-call
  totals and signed differences, endpoint agreement, constraint slacks and
  recovered-metal differences. Screening candidates, engine-audited proposals
  and separate weight-path calls remain distinct. Proposal surrogate MAE is
  weighted by actual engine-audited proposal counts.

Recovery errors use percentage points, log-upgrade errors use dimensionless log
ratios and energy errors use kWh/t. R² is dimensionless. Coverage/guard rates are
fractions. Recovered metal uses t/h. Markdown renders null as **unavailable** and
retains rejected-transfer status. Empty matched cohorts retain all excluded IDs
and null model summaries.

## Interpret with the denominator

The optimizer's paired counters measure distinct cached trial states after each fixed-weight multistart
search. Repeated states across starts count once; refused trials remain outcomes. Screened and unscreened
runs have separate caches. The later weight-path calculation, uncached base/endpoint audits, fitting and
screening inference are excluded. These counters describe the recorded search workload, not every
simulator invocation or elapsed time.

Conditional results describe each model's surviving folds. Different surviving
sets cannot support an unqualified ranking. Use common-cohort tables to compare
identical fold IDs and state exclusions. Seed summaries also have their own
surviving sets; they are not automatically matched across seeds. GP pooled
coverage excludes rejected scores and states the scored-row denominator.

Optimizer difference is
`100 * (screened exact calls / unscreened exact calls - 1)`: positive means more
calls, negative means fewer. A zero unscreened denominator yields unavailable.
Feasible decisions agree within `1e-6 * max(1, abs(screened_decision))`, the
producer's tolerance. Matching infeasible outcomes are terminal agreement, never
successful endpoints. The unscreened record lacks saved slacks; its feasibility
comes from producer status. The collector checks screened feasible endpoint
values/slacks against declared constraints.

## Validation and limits

Mixed identities, reused learning, malformed scores, invalid observable
diagnostics, dishonest summaries/counts, incomplete coverage, nonfinite JSON,
duplicate keys, missing/unlisted artifacts, foreign paths and byte/hash drift are
errors. Input hashes are rechecked after collection to detect concurrent writes.
Pure existing validators are reused with additional design, seed, coverage,
guard and optimizer checks. This is a checked adapter for consumed v2 fields,
not a general JSON Schema implementation or replacement for
`scripts/check_artifacts.py`.

Hashes identify bytes; they do not authenticate authorship or regenerate absent
predictions. Source/configuration identity and fresh evaluation remain producer
responsibilities. These are **authored simulator results, not measured plant
validation**. Collection prepares evidence; the manuscript author owns scientific
interpretation and limitations. See the exact
[adversarial gates](../design/features/release-results/validation.md).
