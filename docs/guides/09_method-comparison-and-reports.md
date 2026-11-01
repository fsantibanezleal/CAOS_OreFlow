# Guide: method comparisons and research reports

OreFlow compares process equations, fitted statistical models and a proposed screened search using
declared data and protocols. A new method is complete when its implementation, applicable inputs,
computed comparison, lesson and limitations agree. A citation alone does not establish an implementation,
and a faster model inference does not establish a cheaper optimization run.

## Define a comparison before running it

The [software design document](../design/SDD.md) records the question, method names, input domain,
comparison protocol and criterion that would refute the proposed benefit. Use the same input data,
splits, objectives, starting points and resource limits for compared methods. Record intentional
differences explicitly. Preserve unsuccessful and infeasible outcomes rather than reporting only
the variants on which a method looks favorable.

For the process equations, use published worked examples, conservation checks and limiting cases.
For fitted models, keep interpolation, held-out-case evaluation and held-out-ore-group evaluation
separate. Fit scaling, imputation and model parameters using the training partition. For the
screened search, compare exact-engine evaluation counts and selected feasible decisions against
the same pattern search with screening disabled. Wall-clock time, prediction error and simulator
evaluation counts answer different questions and should be reported separately.

## Implement and explain the method

The production method belongs in the existing path-invoked pipeline. A notebook calls that
implementation in small steps, displays intermediate outputs and interprets its computed figures.
The notebook's comparison must run the named methods on its bounded lesson experiment; archived
results provide the broader context. An artifact reproduction check can establish integrity but
cannot carry the lesson. [Guide 08](08_notebooks.md) defines the lesson structure and language checks.

Public titles, sections, charts and navigation use method names: Bond's work-index relation,
random forest, Gaussian-process surrogate, or surrogate-screened pattern search. Internal planning
classifications and requirement identifiers belong in design metadata. They do not describe the
science to a reader. Bibliographic titles retain their published wording.

## Interpret the screening result

The archived paired comparison covers 72 target-mode variants. Screening used 26,367 exact-engine
evaluations against 22,487 without screening, an increase of 17.25%. There were 63 identical feasible
decision vectors, two matching infeasible outcomes and seven differing feasible pairs. These are
results over authored simulator cases; they do not demonstrate transfer to calibrated plant control.

The proposed saving in simulator evaluations was refuted on this suite. Retaining that result is
necessary to explain when surrogate ordering can add search work even though model inference is
fast. The [screening article](https://doi.org/10.5281/zenodo.23833134) describes the method, protocol,
paired outcomes and applicability limits. Its [source](../../manuscripts/surrogate-screening/main.tex)
is maintained with the product.

## Keep research reports citable

The [technical report](https://doi.org/10.5281/zenodo.23783845) covers the simulator, data,
validation and learned-model results. The separate screening article reports the proposed search
comparison. Each has a concept DOI that resolves to its current version, and a version DOI for an
immutable published PDF. [Product metadata](../../product.json), the [README](../../README.md)
and the Introduction's technical view expose the concept DOIs.

The first-page header states the document type, version, date, CC BY 4.0 licence, author and ORCID,
version DOI, concept DOI and source-code link. The body describes the problem, methods, experiments,
results and limitations. Release administration and publication history belong in metadata and
the changelog. A manuscript record contains its manuscript PDF; supporting datasets and other
artifacts have separate linked records when deposited.

A release that changes a method, data source or result requires an updated technical report before
or with the release. A documentation-only maintenance change can retain the existing report when
its scientific account is unchanged. Never edit a published PDF in place; publish a new version
under the existing concept when its content changes.

## Validate a release

- `python scripts/check_sdd.py` checks the design record and named evidence.
- `python scripts/check_notebooks.py` checks lesson structure, bilingual mirrors and method coverage;
  fresh-kernel execution and independent teaching review remain separate requirements.
- `python scripts/check_internal_names.py` checks reader-facing method names.
- `python scripts/check_manuscripts.py --release --zenodo` checks declared report versions and public
  concept records for a scientific release. A default run supports maintenance releases that retain
  a scientifically unchanged report.
- `scripts/smoke.ps1` or `bash scripts/smoke.sh` runs the local repository, scientific and frontend checks.

The checks provide bounded evidence. They do not establish plant calibration, external adoption,
algorithmic superiority or acceptance of a design by its users.
