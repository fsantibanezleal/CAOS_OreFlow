"""Exercise the real orchestrator with bounded compiler/Poppler fixtures only."""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_technical_report import build_report  # noqa: E402 -- standalone script

DOI = "10.5281/zenodo.23899991"
DATE = "2026-11-01"
REAL_RUN = subprocess.run
CURRENT_VERSION = (Path(__file__).resolve().parents[1] / "VERSION").read_text(encoding="utf-8").strip()
MAJOR, MINOR, PATCH = (int(part) for part in CURRENT_VERSION.split("."))


def previous_release(major, minor, patch):
    if patch:
        return f"{major}.{minor}.{patch-1}"
    if minor:
        return f"{major}.{minor-1}.999"
    if major:
        return f"{major-1}.99.999"
    raise ValueError("The initial zero release has no preceding semantic version")


# Unpadded derived neighbours also exercise numeric rather than lexical ordering.
PRIOR_VERSION = previous_release(MAJOR, MINOR, PATCH)
PRIOR_MINOR_VERSION = previous_release(MAJOR, MINOR, 0) if MAJOR or MINOR else PRIOR_VERSION
FUTURE_VERSION = f"{MAJOR}.{MINOR}.{PATCH+1}"
NEXT_MINOR_VERSION = f"{MAJOR}.{MINOR+1}.0"
NEXT_MAJOR_VERSION = f"{MAJOR+1}.0.0"


@pytest.fixture
def project(tmp_path):
    root = tmp_path / "product with spaces"
    report = root / "manuscripts/technical-report"
    report.mkdir(parents=True)
    (root / "VERSION").write_text(CURRENT_VERSION + "\n")
    (root / "product.json").write_text(json.dumps({"holder": "Felipe Santibáñez-Leal", "manuscripts": [{
        "kind": "technical-report", "version": CURRENT_VERSION, "concept_doi": "10.5281/zenodo.23783845",
        "title": "A reproducible simulator report"}]}))
    (report / "zenodo.json").write_text(json.dumps({"metadata": {
        "title": "A reproducible simulator report", "version": CURRENT_VERSION, "publication_date": DATE,
        "license": "cc-by-4.0", "creators": [{"name": "Santibáñez-Leal, Felipe", "orcid": "0000-0002-0150-3246"}]}}))
    (report / "main.tex").write_text(
        r"\documentclass{article}\newcommand{\docversion}{v" + CURRENT_VERSION + "}"
        r"\newcommand{\docdate}{1 November 2026}\newcommand{\versiondoi}{" + DOI + "}"
        r"\newcommand{\conceptdoi}{10.5281/zenodo.23783845}"
        r"\title{A reproducible simulator report}\author{Felipe Santibáñez-Leal (ORCID: 0000-0002-0150-3246)}"
        r"\begin{document}\maketitle\end{document}", encoding="utf-8")
    (report / "main.pdf").write_bytes(b"existing canonical PDF")
    return root


class FixtureTools:
    def __init__(self):
        self.calls = []
        self.passes = 0
        self.failure = None
        self.warning = ""
        self.bad_text = None
        self.pages = 11
        self.clip = False
        self.signature = b"%PDF-1.7\nfixture body\n%%EOF\n"
        self.drift = None

    def __call__(self, args, **kwargs):
        assert isinstance(args, list) and all(isinstance(arg, str) for arg in args)
        assert kwargs.get("shell") is False
        self.calls.append((args, kwargs))
        tool = Path(args[0]).name
        if "--version" in args or "-v" in args:
            return SimpleNamespace(returncode=0, stdout=f"{tool} fixture-version\n", stderr="")
        directory = Path(kwargs["cwd"])
        if tool == "xelatex":
            self.passes += 1
            assert f"-output-directory={directory}" in args
            assert all("$" not in arg for arg in args)
            if self.drift:
                self.drift()
            if self.failure == f"pass-{self.passes}":
                (directory / "main.pdf").write_bytes(b"partial")
                return SimpleNamespace(returncode=1, stdout="", stderr="fixture compiler failed")
            if self.failure != f"missing-{self.passes}":
                (directory / "main.pdf").write_bytes(self.signature)
                (directory / "main.log").write_text("fixture clean log\n" + self.warning, encoding="utf-8")
        elif tool == "pdfinfo":
            return SimpleNamespace(returncode=0, stdout=f"Pages: {self.pages}\n", stderr="")
        elif tool == "pdftotext":
            if "-bbox" in args:
                output = Path(args[-1])
                x_max = "613" if self.clip else "540"
                pages = "".join(f'<page width="612" height="792"><word xMin="10" yMin="10" xMax="{x_max}" yMax="20">visible</word></page>'
                                for _ in range(self.pages))
                output.write_text(f"<html><body>{pages}</body></html>", encoding="utf-8")
                return SimpleNamespace(returncode=0, stdout="", stderr="")
            assert args[args.index("-f")+1] == "1" and args[args.index("-l")+1] == "1"
            text = ("A reproducible simulator report\nFelipe Santibáñez-Leal ORCID: 0000-0002-0150-3246\n"
                    f"Technical report v{CURRENT_VERSION}, 1 November 2026 Licence CC BY 4.0\nVersion DOI {DOI}\n"
                    "concept DOI 10.5281/zenodo.23783845\nNot peer reviewed.")
            return SimpleNamespace(returncode=0, stdout=self.bad_text(text) if self.bad_text else text, stderr="")
        else:
            pytest.fail(f"Unexpected tool: {tool}")
        return SimpleNamespace(returncode=0, stdout="fixture complete", stderr="")


@pytest.fixture
def tools(tmp_path, monkeypatch):
    import build_technical_report as builder

    runner = FixtureTools()
    monkeypatch.setattr(builder.subprocess, "run", runner)
    monkeypatch.setattr(builder.shutil, "which", lambda name: str(tmp_path / "tool bin" / name))
    return runner


def canonical(root):
    report = root / "manuscripts/technical-report"
    return {name: (report / name).read_bytes() for name in ("main.tex", "main.pdf", "zenodo.json")}


def metadata(root, mutate):
    path = root / "manuscripts/technical-report/zenodo.json"
    value = json.loads(path.read_text())
    mutate(value["metadata"])
    path.write_text(json.dumps(value))


@pytest.mark.parametrize("damage", ["doi", "concept-doi", "date", "version", "metadata-date", "creator", "orcid", "license", "scratch", "empty-source", "write-type"])
def test_adversarial_invalid_identity_or_scratch(project, tools, tmp_path, damage):
    doi, date, scratch = DOI, DATE, tmp_path / "external scratch"
    if damage == "doi":
        doi = "10.5281/zenodo.00000000"
    elif damage == "concept-doi":
        doi = "10.5281/zenodo.23783845"
    elif damage == "date":
        date = "2026-02-30"
    elif damage == "version":
        metadata(project, lambda m: m.update(version=PRIOR_VERSION))
    elif damage == "metadata-date":
        metadata(project, lambda m: m.update(publication_date="2026-10-31"))
    elif damage == "creator":
        metadata(project, lambda m: m["creators"].append(dict(m["creators"][0])))
    elif damage == "orcid":
        metadata(project, lambda m: m["creators"][0].update(orcid="0000-0002-0150-3247"))
    elif damage == "license":
        metadata(project, lambda m: m.update(license="MIT"))
    elif damage == "scratch":
        scratch = project / "scratch"
    elif damage == "empty-source":
        (project / "manuscripts/technical-report/main.tex").write_text("")
    before = canonical(project)
    with pytest.raises(ValueError):
        build_report(root=project, doi=doi, publication_date=date, temp_root=scratch, write="false" if damage == "write-type" else True)
    assert canonical(project) == before
    assert tools.calls == [] and not scratch.exists()


@pytest.mark.parametrize("failure", ["pass-1", "pass-2", "missing-1", "missing-2"])
def test_adversarial_failed_or_partial_compilation(project, tools, tmp_path, failure):
    tools.failure = failure
    before = canonical(project)
    with pytest.raises(ValueError):
        build_report(root=project, doi=DOI, publication_date=DATE, temp_root=tmp_path / "scratch path", write=True)
    assert canonical(project) == before
    assert tools.passes == int(failure[-1])


@pytest.mark.parametrize("damage", ["version", "doi", "date", "author", "orcid", "license", "header", "title", "pages", "signature", "underfull", "warning", "clipped"])
def test_adversarial_invalid_pdf_preserves_canonical(project, tools, tmp_path, damage):
    removed = {"version": f"v{CURRENT_VERSION}", "doi": DOI, "date": "1 November 2026", "author": "Felipe Santibáñez-Leal",
               "orcid": "0000-0002-0150-3246", "license": "CC BY 4.0", "header": "Technical report", "title": "A reproducible simulator report"}
    if damage in removed:
        tools.bad_text = lambda text: text.replace(removed[damage], "WRONG")
    elif damage == "pages":
        tools.pages = 1
    elif damage == "signature":
        tools.signature = b"%PDF-1.7 partial"
    elif damage == "clipped":
        tools.clip = True
    else:
        tools.warning = {"underfull": r"Underfull \vbox (badness 10000)",
                         "warning": "Package hyperref Warning: unsupported token"}[damage]
    before = canonical(project)
    with pytest.raises(ValueError):
        build_report(root=project, doi=DOI, publication_date=DATE, temp_root=tmp_path / "scratch", write=True)
    assert canonical(project) == before


def test_measured_overfull_box_is_accepted_when_every_glyph_is_inside_page(project, tools, tmp_path):
    tools.warning = r"Overfull \hbox (39.5pt too wide) in introduction"
    receipt = build_report(root=project, doi=DOI, publication_date=DATE, temp_root=tmp_path / "scratch")
    assert receipt["layout"] == {"overfull_boxes_within_page_bounds": 1, "pages_with_text_bounds": 11}


def test_adversarial_candidate_identity_and_write_boundary(project, tools, tmp_path):
    before = canonical(project)
    receipt = build_report(root=project, doi=DOI, publication_date=DATE, temp_root=tmp_path / "external scratch")
    directory = Path(receipt["candidate_dir"])
    assert canonical(project) == before and tools.passes == 2
    assert receipt["pages"] == 11 and receipt["parameters"]["write_requested"] is False
    for name, evidence in receipt["inputs"].items():
        assert evidence["sha256"] == hashlib.sha256((project / name).read_bytes()).hexdigest()
    for name, evidence in receipt["outputs"].items():
        assert evidence["sha256"] == hashlib.sha256((directory / name).read_bytes()).hexdigest()
    assert json.loads((directory / "receipt.json").read_text(encoding="utf-8")) == receipt
    assert set(receipt["tools"]) == {"xelatex", "pdfinfo", "pdftotext"}
    written = build_report(root=project, doi=DOI, publication_date=DATE, temp_root=tmp_path / "external scratch", write=True)
    assert written["candidate_dir"] != receipt["candidate_dir"]
    after = canonical(project)
    assert after["main.tex"] == (Path(written["candidate_dir"]) / "main.tex").read_bytes()
    assert after["main.pdf"] == (Path(written["candidate_dir"]) / "main.pdf").read_bytes()
    assert after["zenodo.json"] == before["zenodo.json"]
    # A source edit during the next build must stop installation; do not relabel its receipt.
    tools.drift = lambda: (project / "VERSION").write_text("source changed")
    existing_children = set((tmp_path / "external scratch").iterdir())
    with pytest.raises(ValueError, match="changed"):
        build_report(root=project, doi=DOI, publication_date=DATE, temp_root=tmp_path / "external scratch", write=True)
    assert canonical(project)["main.tex"] == after["main.tex"]
    assert canonical(project)["main.pdf"] == after["main.pdf"]
    failed_children = set((tmp_path / "external scratch").iterdir()) - existing_children
    assert len(failed_children) == 1 and not (failed_children.pop() / "receipt.json").exists()


def test_external_root_environment_and_missing_tools(project, tools, tmp_path, monkeypatch):
    import build_technical_report as builder

    monkeypatch.setenv("CAOS_TEMP_ROOT", str(tmp_path / "role scratch"))
    receipt = build_report(root=project, doi=DOI, publication_date=DATE)
    assert Path(receipt["candidate_dir"]).parent == tmp_path / "role scratch"
    monkeypatch.setattr(builder.shutil, "which", lambda name: None)
    with pytest.raises(ValueError, match="xelatex"):
        build_report(root=project, doi=DOI, publication_date=DATE)


def test_adversarial_scratch_junction_back_to_product(project, tools, tmp_path):
    link = tmp_path / "scratch junction"
    try:
        link.symlink_to(project, target_is_directory=True)
    except OSError:
        if os.name != "nt":
            raise
        result = REAL_RUN(["cmd", "/c", "mklink", "/J", str(link), str(project)], capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
    with pytest.raises(ValueError, match="external|outside"):
        build_report(root=project, doi=DOI, publication_date=DATE, temp_root=link)
    assert tools.calls == []


def test_installation_failure_restores_both_canonical_files(project, tools, tmp_path, monkeypatch):
    import build_technical_report as builder

    before = canonical(project)
    replace = builder.os.replace
    calls = 0

    def fail_second(source, destination):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("simulated second install failure")
        return replace(source, destination)

    monkeypatch.setattr(builder.os, "replace", fail_second)
    with pytest.raises(OSError, match="second install"):
        build_report(root=project, doi=DOI, publication_date=DATE, temp_root=tmp_path / "scratch", write=True)
    assert canonical(project) == before
    assert not list((project / "manuscripts/technical-report").glob(".report-build-*"))


@pytest.mark.parametrize("damage", ["missing-source", "missing-root", "timeout", "verbose-tool", "poppler-warning"])
def test_clear_bounded_failures(project, tools, tmp_path, monkeypatch, damage):
    import build_technical_report as builder

    if damage == "missing-source":
        (project / "manuscripts/technical-report/main.tex").unlink()
    elif damage == "missing-root":
        monkeypatch.delenv("CAOS_TEMP_ROOT", raising=False)
    else:
        def broken(args, **kwargs):
            if damage == "timeout":
                raise subprocess.TimeoutExpired(args, 180)
            if damage == "verbose-tool":
                return SimpleNamespace(returncode=1, stdout="x"*20000, stderr="last failure detail")
            result = tools(args, **kwargs)
            if Path(args[0]).name == "pdfinfo" and "-v" not in args:
                result.stderr = "Syntax Warning: recovered damaged PDF"
            return result
        monkeypatch.setattr(builder.subprocess, "run", broken)
    before = {p: p.read_bytes() for p in project.rglob("*") if p.is_file()}
    with pytest.raises(ValueError) as caught:
        build_report(root=project, doi=DOI, publication_date=DATE,
                     temp_root=None if damage == "missing-root" else tmp_path / "scratch", write=True)
    assert len(str(caught.value)) < 3000
    assert {p: p.read_bytes() for p in project.rglob("*") if p.is_file()} == before


@pytest.mark.parametrize("declared", [PRIOR_VERSION, PRIOR_MINOR_VERSION, CURRENT_VERSION])
def test_candidate_build_preserves_previous_or_current_report_declaration(project, tools, tmp_path, declared):
    manifest = project / "product.json"
    product = json.loads(manifest.read_text())
    product["manuscripts"][0]["version"] = declared
    manifest.write_text(json.dumps(product))
    before = {path: path.read_bytes() for path in project.rglob("*") if path.is_file()}
    receipt = build_report(root=project, doi=DOI, publication_date=DATE, temp_root=tmp_path / "scratch")
    assert receipt["parameters"]["version"] == CURRENT_VERSION
    assert receipt["parameters"]["declared_report_version"] == declared
    assert receipt["inputs"]["product.json"]["sha256"] == hashlib.sha256(before[manifest]).hexdigest()
    assert tools.passes == 2
    assert {path: path.read_bytes() for path in project.rglob("*") if path.is_file()} == before


@pytest.mark.parametrize("declared", [FUTURE_VERSION, NEXT_MINOR_VERSION, NEXT_MAJOR_VERSION, "0.10", f"v{PRIOR_VERSION}", "0.10.bad", "", None, True])
def test_adversarial_future_or_malformed_report_declaration_rejected(project, tools, tmp_path, declared):
    manifest = project / "product.json"
    product = json.loads(manifest.read_text())
    product["manuscripts"][0]["version"] = declared
    manifest.write_text(json.dumps(product))
    before = {path: path.read_bytes() for path in project.rglob("*") if path.is_file()}
    scratch = tmp_path / "scratch"
    with pytest.raises(ValueError, match="version"):
        build_report(root=project, doi=DOI, publication_date=DATE, temp_root=scratch, write=True)
    assert not scratch.exists() and not tools.calls
    assert {path: path.read_bytes() for path in project.rglob("*") if path.is_file()} == before


@pytest.mark.parametrize("candidate_metadata", [PRIOR_VERSION, FUTURE_VERSION])
def test_adversarial_authored_metadata_still_must_match_candidate(project, tools, tmp_path, candidate_metadata):
    manifest = project / "product.json"
    product = json.loads(manifest.read_text())
    product["manuscripts"][0]["version"] = PRIOR_VERSION
    manifest.write_text(json.dumps(product))
    metadata(project, lambda m: m.update(version=candidate_metadata))
    before = canonical(project)
    scratch = tmp_path / "scratch"
    with pytest.raises(ValueError, match="metadata version"):
        build_report(root=project, doi=DOI, publication_date=DATE, temp_root=scratch, write=True)
    assert not scratch.exists() and not tools.calls
    assert canonical(project) == before
