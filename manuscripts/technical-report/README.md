# Build the technical report locally

`main.md` and `report-template.tex` are the authored sources. The builder reads
the title, sole creator/ORCID, license, version and publication date from this
directory's `zenodo.json`; the report concept DOI/title, declared report version
and product holder come from `product.json`, and the candidate release version
comes from `VERSION`. Authored metadata must match that candidate version.
The manifest's declared report version may be a valid previous or current release,
never a future or malformed version. Keep the last-published manifest declaration
until actual publication; building a candidate does not advance that declaration.
It never updates these inputs or reserves/publishes a DOI.

Install Pandoc, XeLaTeX and Poppler (`pdfinfo`, `pdftotext`) on `PATH`, and use the
existing project Python environment. The builder itself uses only the standard
library. Configure `CAOS_TEMP_ROOT` to your external temporary-storage root;
an unset root or one resolving into the product, including through a junction or
symlink, is refused. `--temp-root` overrides the environment explicitly. The tool
does not load `.env` or infer a machine-specific storage path.

## Candidate build

PowerShell, from the repository root:

```powershell
& .venv/Scripts/python.exe scripts/build_technical_report.py `
  --doi 10.5281/zenodo.23850020 --date 2026-11-01
```

Bash, from the repository root:

```bash
.venv/bin/python scripts/build_technical_report.py \
  --doi 10.5281/zenodo.23850020 --date 2026-11-01
```

This concrete DOI/date identifies the current reserved report version. Supply the
actual reserved version DOI and matching ISO publication date for a later build.
The version DOI must differ from the concept DOI. The offline builder checks DOI
syntax and source consistency; it cannot establish remote reservation ownership.
Stale authored metadata versions or dates fail explicitly and must be reconciled
before building. For example, metadata and `VERSION` may be `0.10.008` while the
manifest still declares published report `0.10.007`. Versions are compared as
numeric major/minor/patch components, not strings. There is no automatic
metadata or manifest mutation or historical-version relabelling.

Each invocation creates a fresh `oreflow-report-*` child under the external root.
It copies the exact source snapshot, writes Pandoc metadata, generates `main.tex`
with `--syntax-highlighting=none`, and completes two XeLaTeX passes. All tool calls
use subprocess argument lists without a shell; a path containing spaces remains
one argument, including the XeLaTeX output directory. Existing canonical TeX/PDF
files remain untouched during candidate compilation and validation.

Each pass must produce its own PDF and log. Final warnings, overfull/underfull
boxes, missing/partial outputs, a missing PDF signature/EOF, Poppler diagnostics
or incorrect first-page identity fail the build. Validation requires the title,
sole author's name and ORCID, version, date, labelled version/concept DOIs,
technical-report header, CC BY 4.0 license and unreviewed status. No warning is
suppressed to obtain a pass. Source hashes are rechecked after compilation.

The reviewed layout is eleven pages, so `--expected-pages` defaults to `11`.
Change that value only when a new layout has been deliberately reviewed; a
different page count is not silently accepted as a complete report. Each external
tool call has a 180-second timeout and bounded surfaced output/errors. Failed
scratch candidates remain available for diagnosis; this tool does not clean or
alter other external work.

## Receipt and installation boundary

A successful candidate has `receipt.json` beside its TeX/PDF. The receipt records
exact input/output SHA256 and byte counts, candidate release/DOI/date/author parameters,
the unchanged manifest's `declared_report_version`,
the generated Pandoc metadata hash, expected/actual pages, tool versions and the
builder's source hash. It identifies the compiled bytes; it does not promise
bit-for-bit identity across toolchains or PDF creation timestamps. A receipt
records whether installation was requested, not remote publication or scientific
approval.

Review the candidate's complete rendered PDF and reconcile scientific claims
against the completed release artifacts before installing. To rebuild and install
only the verified `main.tex` and `main.pdf`, add **`--write`**:

```powershell
& .venv/Scripts/python.exe scripts/build_technical_report.py `
  --doi 10.5281/zenodo.23850020 --date 2026-11-01 --write
```

```bash
.venv/bin/python scripts/build_technical_report.py \
  --doi 10.5281/zenodo.23850020 --date 2026-11-01 --write
```

The write invocation performs the full build/validation again, stages both files,
checks source identity again and replaces only canonical TeX/PDF. Ordinary
installation errors roll back completed replacements. Two files are not a single
crash-atomic filesystem transaction. Metadata, source Markdown/template, release
records and remote services are never changed. Exit 0 reports the external
candidate and whether installation was requested; validation/tool failures exit
1 and CLI usage errors exit 2.

## Bounded verification

```powershell
.venv/Scripts/python.exe -m pytest tests/test_build_technical_report.py -q
.venv/Scripts/python.exe -m ruff check scripts/build_technical_report.py tests/test_build_technical_report.py
```

Tests exercise the real orchestration with small compiler/Poppler fixtures,
including path spaces, failed second passes, malformed PDFs, warnings, stale
source identity, receipts, rollback and the explicit write boundary. They do not
compile the real report or certify its appearance. A warning-free log, expected
page count and matching header are bounded mechanical checks. Scientific review,
reading every rendered page and publication remain separate requirements.
