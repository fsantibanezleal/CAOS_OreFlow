#!/usr/bin/env python3
"""Build a verified external technical-report candidate; --write installs only TeX/PDF."""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = Path("manuscripts/technical-report")
INPUTS = (Path("VERSION"), Path("product.json"), REPORT / "zenodo.json", REPORT / "main.md", REPORT / "report-template.tex")
TOOLS = ("pandoc", "xelatex", "pdfinfo", "pdftotext")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")


def _need(condition, message):
    if not condition:
        raise ValueError(message)


def _hash(data):
    return {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def _read(path):
    try:
        return path.read_bytes()
    except OSError as exc:
        raise ValueError(f"Missing or unreadable input/output {path}: {exc}") from exc


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        _need(key not in result, f"Duplicate metadata key: {key}")
        result[key] = value
    return result


def _doi(value):
    _need(isinstance(value, str) and re.fullmatch(r"10\.5281/zenodo\.[1-9][0-9]{4,}", value),
          "A real reserved Zenodo version DOI is required (10.5281/zenodo.<record ID>)")
    return value


def _release_version(value, label):
    _need(isinstance(value, str) and re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", value), f"{label} is a malformed release version")
    return tuple(int(part) for part in value.split("."))


def _identity(snapshot, doi, publication_date, expected_pages):
    _doi(doi)
    _need(isinstance(publication_date, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", publication_date), "Date must be ISO YYYY-MM-DD")
    day = datetime.date.fromisoformat(publication_date)
    _need(type(expected_pages) is int and expected_pages > 0, "Expected page count must be a positive integer")
    try:
        version = snapshot[Path("VERSION")].decode("utf-8").strip()
        product = json.loads(snapshot[Path("product.json")], object_pairs_hook=_pairs)
        metadata = json.loads(snapshot[REPORT / "zenodo.json"], object_pairs_hook=_pairs)["metadata"]
        reports = [entry for entry in product["manuscripts"] if entry["kind"] == "technical-report"]
        _need(len(reports) == 1, "Exactly one technical-report product entry is required")
        report = reports[0]
        candidate_version = _release_version(version, "VERSION")
        _need(metadata["version"] == version, "Report metadata version must match VERSION; reconcile metadata explicitly")
        declared_report_version = report["version"]
        _need(_release_version(declared_report_version, "Declared report version") <= candidate_version,
              "Declared report version is future relative to VERSION")
        _need(metadata["publication_date"] == publication_date, "Metadata publication date differs from --date")
        _need(metadata.get("doi", doi) == doi, "Metadata version DOI differs from --doi")
        concept = _doi(report["concept_doi"])
        _need(concept != doi, "Version DOI must differ from the concept DOI")
        title = metadata["title"].strip()
        _need(bool(title) and title == report["title"].strip(), "Metadata title differs from product report title")
        _need(metadata["license"].lower() == "cc-by-4.0", "Report license must be CC BY 4.0")
        creators = metadata["creators"]
        _need(isinstance(creators, list) and len(creators) == 1, "Exactly one report creator is required")
        creator = creators[0]
        name = creator["name"].strip()
        parts = [part.strip() for part in name.split(",")]
        author = f"{parts[1]} {parts[0]}" if len(parts) == 2 else name
        _need(bool(author) and author.casefold() == product["holder"].strip().casefold(), "Sole report author differs from product holder")
        orcid = creator["orcid"]
        _need(re.fullmatch(r"\d{4}-\d{4}-\d{4}-\d{3}[0-9X]", orcid), "A valid creator ORCID is required")
        digits = orcid.replace("-", "")
        checksum = 0
        for digit in digits[:15]:
            checksum = (checksum + int(digit))*2
        expected = (12-checksum % 11) % 11
        _need(digits[-1] == ("X" if expected == 10 else str(expected)), "Creator ORCID checksum is invalid")
    except (KeyError, TypeError, AttributeError, IndexError, UnicodeError) as exc:
        raise ValueError(f"Missing or malformed report metadata identity: {exc}") from exc
    return {"version": version, "declared_report_version": declared_report_version,
            "doi": doi, "concept_doi": concept, "date": publication_date,
            "display_date": f"{day.day} {MONTHS[day.month-1]} {day.year}", "title": title,
            "author": author, "orcid": orcid, "license": "CC BY 4.0", "expected_pages": expected_pages}


def _run(args, directory):
    try:
        result = subprocess.run(args, cwd=directory, shell=False, capture_output=True, text=True,
                                encoding="utf-8", errors="replace", timeout=180, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError(f"{Path(args[0]).name} could not complete: {str(exc)[-2400:]}") from exc
    output = result.stdout + result.stderr
    _need(result.returncode == 0, f"{Path(args[0]).name} failed (exit {result.returncode}): {output[-2400:]}")
    _need(len(output) <= 262144, f"{Path(args[0]).name} output exceeds the bounded 256 KiB limit")
    return result


def _unchanged(root, snapshot):
    for path, original in snapshot.items():
        _need(_read(root / path) == original, f"Source changed during build: {path}")


def _normalized(text):
    text = unicodedata.normalize("NFKC", text).replace("\u00ad", "").replace("\u2010", "-").replace("\u2011", "-")
    return " ".join(text.split()).casefold()


def _install(root, directory, snapshot):
    """Stage both files and rollback a partial installation; entered only on --write."""
    staged, applied = [], []

    def stage(data):
        with tempfile.NamedTemporaryFile(dir=root / REPORT, prefix=".report-build-", delete=False) as handle:
            handle.write(data)
            return Path(handle.name)

    try:
        for name in ("main.tex", "main.pdf"):
            target = root / REPORT / name
            _need(target.resolve().parent == (root / REPORT).resolve(), f"Canonical destination escapes report directory: {target}")
            original = target.read_bytes() if target.exists() else None
            replacement = stage(_read(directory / name))
            try:
                backup = stage(original) if original is not None else None
            except BaseException:
                replacement.unlink(missing_ok=True)
                raise
            staged.append((target, replacement, backup))
        _unchanged(root, snapshot)
        for target, replacement, backup in staged:
            os.replace(replacement, target)
            applied.append((target, backup))
    except BaseException:
        for target, backup in reversed(applied):
            if backup is None:
                target.unlink(missing_ok=True)
            else:
                os.replace(backup, target)
        raise
    finally:
        for _, replacement, backup in staged:
            replacement.unlink(missing_ok=True)
            if backup is not None:
                backup.unlink(missing_ok=True)


def build_report(*, doi: str, publication_date: str, temp_root: Path | None = None,
                 write: bool = False, expected_pages: int = 11, root: Path = ROOT) -> dict:
    """Validate metadata, build externally, verify identity and optionally install TeX/PDF.

    The caller supplies the reserved DOI; this offline tool cannot confirm a
    reservation remotely. Page count defaults to the reviewed eleven-page layout.
    A receipt proves a bounded local build, never scientific or visual acceptance.
    """
    root = Path(root).resolve()
    snapshot = {path: _read(root / path) for path in INPUTS}
    _need(type(write) is bool, "write must be an explicit boolean")
    for path in (REPORT / "main.md", REPORT / "report-template.tex"):
        _need(bool(snapshot[path].strip()), f"Empty report source: {path}")
    identity = _identity(snapshot, doi, publication_date, expected_pages)
    configured = temp_root if temp_root is not None else os.environ.get("CAOS_TEMP_ROOT")
    _need(configured is not None and str(configured).strip(), "Set CAOS_TEMP_ROOT or --temp-root to an external scratch root")
    scratch = Path(configured).expanduser().resolve()
    _need(not scratch.is_relative_to(root) and not scratch.is_relative_to(ROOT), "Scratch root must be external, outside the product repository")
    executables = {name: shutil.which(name) for name in TOOLS}
    for name, executable in executables.items():
        _need(executable, f"Missing required tool on PATH: {name}")
    scratch.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix="oreflow-report-", dir=scratch))
    versions = {}
    for name, executable in executables.items():
        result = _run([executable, "-v" if name in ("pdfinfo", "pdftotext") else "--version"], directory)
        version = (result.stdout + result.stderr).strip().splitlines()
        _need(bool(version), f"{name} did not report its tool version")
        versions[name] = version[0][:500]
    (directory / "source.md").write_bytes(snapshot[REPORT / "main.md"])
    (directory / "report-template.tex").write_bytes(snapshot[REPORT / "report-template.tex"])
    parameters = {"title": identity["title"], "author": f"{identity['author']} (ORCID: {identity['orcid']})",
                  "docversion": "v" + identity["version"], "docdate": identity["display_date"],
                  "versiondoi": doi, "conceptdoi": identity["concept_doi"]}
    (directory / "parameters.json").write_text(json.dumps(parameters, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    tex, pdf, log = [directory / name for name in ("main.tex", "main.pdf", "main.log")]
    converted = _run([executables["pandoc"], str(directory / "source.md"), "--standalone", "--from=markdown+raw_tex", "--to=latex",
                      "--template", str(directory / "report-template.tex"), "--metadata-file", str(directory / "parameters.json"),
                      "--syntax-highlighting=none", "--output", str(tex)], directory)
    _need(not converted.stderr.strip(), "Pandoc reported a warning; inspect the candidate")
    _need(bool(_read(tex).strip()), "Pandoc produced empty TeX")
    for _ in range(2):
        # These are this fresh child's own outputs, not user/canonical files.
        pdf.unlink(missing_ok=True)
        log.unlink(missing_ok=True)
        _run([executables["xelatex"], "-interaction=nonstopmode", "-halt-on-error", "-file-line-error",
              f"-output-directory={directory}", str(tex)], directory)
        _read(pdf)
        _read(log)
    final_log = _read(log)
    _need(len(final_log) <= 4*1024*1024, "Compiler log exceeds bounded 4 MiB limit")
    _need(not re.search(r"\b(?:overfull|underfull)\s+\\[hv]box|\bwarning\s*:|^\s*missing character\s*:",
                        final_log.decode("utf-8", errors="replace"), re.I | re.M),
          "Final compiler log contains a warning or overfull/underfull box; review layout")
    pdf_bytes = _read(pdf)
    _need(pdf_bytes.startswith(b"%PDF-") and pdf_bytes.rstrip().endswith(b"%%EOF"), "Missing PDF signature or complete EOF trailer")
    info = _run([executables["pdfinfo"], str(pdf)], directory)
    _need(not info.stderr.strip(), "pdfinfo reported a PDF warning")
    pages = re.search(r"^Pages:\s+(\d+)\s*$", info.stdout, re.M)
    _need(pages and int(pages[1]) == expected_pages, f"PDF page count differs from reviewed expected count {expected_pages}")
    extracted = _run([executables["pdftotext"], "-f", "1", "-l", "1", "-layout", str(pdf), "-"], directory)
    _need(not extracted.stderr.strip(), "pdftotext reported a PDF warning")
    header = _normalized(extracted.stdout)
    for label, value in (("title", identity["title"]), ("author", identity["author"]), ("ORCID", identity["orcid"]),
                         ("version DOI", doi), ("concept DOI", identity["concept_doi"]), ("date", identity["display_date"]),
                         ("report header", "Technical report"), ("review status", "Not peer reviewed")):
        _need(_normalized(value) in header, f"PDF first page is missing expected {label}: {value}")
    _need(re.search(r"\bv" + re.escape(identity["version"]) + r"\b", header), "PDF header has the wrong release version")
    _need(re.search(r"\bversion doi\s+" + re.escape(doi) + r"(?!\d)", header), "PDF header does not label the reserved version DOI")
    _need(re.search(r"\bconcept doi(?:\s+\(always latest\))?\s+" + re.escape(identity["concept_doi"]) + r"(?!\d)", header),
          "PDF header does not label the concept DOI")
    _need(re.search(r"\blicen[cs]e\s+cc by 4\.0\b", header), "PDF header is missing Licence CC BY 4.0")
    _unchanged(root, snapshot)
    receipt = {"schema": "oreflow.report-build/v1", "candidate_dir": str(directory),
               "inputs": {path.as_posix(): _hash(data) for path, data in snapshot.items()},
               "parameters": {**identity, "write_requested": write}, "tools": versions,
               "outputs": {path.name: _hash(_read(path)) for path in (tex, pdf, log, directory / "parameters.json")}, "pages": int(pages[1]),
               "builder_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    (directory / "receipt.json").write_text(json.dumps(receipt, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False)+"\n",
                                            encoding="utf-8")
    if write:
        _install(root, directory, snapshot)
    return receipt


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--doi", required=True)
    parser.add_argument("--date", required=True, dest="publication_date")
    parser.add_argument("--temp-root", type=Path)
    parser.add_argument("--expected-pages", type=int, default=11)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args(argv)
    try:
        receipt = build_report(**vars(args))
    except (ValueError, OSError) as exc:
        print(f"build_technical_report: {str(exc)[-3000:]}", file=sys.stderr)
        return 1
    print(f"Verified candidate: {receipt['candidate_dir']} ({receipt['pages']} pages); "
          + ("installed TeX/PDF with --write" if args.write else "canonical files unchanged"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
