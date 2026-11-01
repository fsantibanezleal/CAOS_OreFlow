# Release result collector design

`scripts/collect_results.py` exports `collect(derived, expected_version=None)` and
`render_markdown(result)`. It uses only the standard library. Learning v1 is
refused before other inputs are traversed. JSON parsing rejects duplicate keys,
nonfinite constants and overflowing numbers. Paths in manifests/indexes must be
relative, stay inside the selected derived root and identify unique case files.

The collector reads a stable completed artifact snapshot, verifies all index and
manifest identities and case byte counts/hashes, checks catalog completeness and
learning design/fold/group membership, then validates score diagnostics through
the existing pure observable validator. It reuses the pure cohort checker and
checks exported summaries against persisted score cells. It uses a checked
adapter for consumed v2 fields, not a general JSON Schema engine. No training
module is imported. Validation errors name the input and field. All consumed JSON files
and validator/collector source identities have SHA256 provenance.

JSON output keeps full precision and nulls. Conditional per-model summaries,
complete case/group score rows, all-model common cohorts, seed summaries and score
rows, GP coverage, guard diagnostics and paired optimizer evidence are separate
fields. Markdown renders each complete collection, without sorting models into
an unqualified ranking. Transfer cohorts combine explicitly grouped folds and
singleton-group case folds using the producer's group semantics.

Optimizer comparisons derive counts from actual records and their shared-cache
start totals. Feasible agreement compares the stored decision vector with the
producer's relative tolerance; two infeasible outcomes are terminal-status
agreement, never identical feasible decisions. Exact optimizer calls exclude
screening inference and separate weight-path studies. Those counts remain
distinct in the export. There is no training, input mutation, historical score
upgrade or generated timestamp.

CLI output destinations are resolved before writes. Repository destinations,
paths inside the input tree, symlink/junction escapes into either, collisions
between outputs and existing output files are rejected. Stdout is the default
Markdown destination; `--json -` selects JSON stdout explicitly. Production
collection must wait for the artifact producer to finish and its owner to approve
the snapshot. The artifact owner owns manuscript interpretation and final release checks.
