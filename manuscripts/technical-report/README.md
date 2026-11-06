# Build the technical report

`main.tex` is the authored source. It is compiled directly with XeLaTeX; there
is no Markdown-to-LaTeX conversion in the release path. The report's title,
author/ORCID, version, publication date, version DOI and concept DOI in the TeX
source must agree with `zenodo.json`, `product.json` and `VERSION`.

The result figures and tables are generated from committed release artifacts by
`generate_evidence.py`. Run the generator before building. It updates
`evidence.tex` and the vector PDFs in `figures/`; these are source inputs and
must be reviewed and committed with the report.

## Candidate build

Install XeLaTeX and Poppler (`pdfinfo`, `pdftotext`) on `PATH`, and use the
project Python environment. Set `CAOS_TEMP_ROOT` to an external temporary
directory or pass `--temp-root` explicitly. The builder refuses scratch space
inside the product repository, including through a junction or symlink.

```powershell
python manuscripts/technical-report/generate_evidence.py
& .venv/Scripts/python.exe scripts/build_technical_report.py `
  --doi 10.5281/zenodo.23994678 --date 2026-11-06 `
  --expected-pages 38 --temp-root $env:CAOS_TEMP_ROOT
```

The DOI/date above identify the previously reserved report version. A later
version requires its own reserved version DOI and matching date; the offline
builder cannot verify Zenodo reservation or publication. It does not reserve,
publish, or change release metadata.

The builder snapshots and hashes `main.tex`, generated evidence, figures,
metadata and product identity; compiles the source twice; rejects compiler
warnings, undefined references, underfull boxes, missing glyphs, malformed
PDFs, identity mismatches, page-count changes and any text glyph outside the
physical page; and checks that no input changed during the build. An overfull
box is recorded and reviewed against the rendered page bounds: it fails when it
cuts text at a physical edge. The current report build has one measured overfull horizontal box in the
results table; its rendered table remains within the page and all text
glyphs remain inside page bounds. A candidate and receipt remain in
external scratch for review. The build does not
establish scientific review or publication readiness.

To install the validated `main.tex` and PDF into this directory, add `--write`.
The write mode reruns every check and installs only those two files. It never
changes metadata or publishes a record.

## Verification

```powershell
python manuscripts/technical-report/generate_evidence.py
& .venv/Scripts/python.exe scripts/build_technical_report.py `
  --doi 10.5281/zenodo.23994678 --date 2026-11-06 `
  --expected-pages 38 --temp-root $env:CAOS_TEMP_ROOT
& .venv/Scripts/python.exe -m pytest tests/test_build_technical_report.py -q
```

The external publication-depth gate is also required. Run it from the publication-tooling checkout, passing this repository path:

```powershell
python tools/zenodo/check_manuscript_depth.py <path-to-OreFlow-checkout> --only technical-report --report
```

A successful mechanical build is not a substitute for reading every rendered
page, checking the result tables against release artifacts, independent
scientific review, or the remaining product release gates.
