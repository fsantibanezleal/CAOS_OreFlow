#!/usr/bin/env python3
"""The SDD gate (ADR-0075): a design document exists, and every requirement names a gate that is real.

Checks, in increasing strength:

1. The repository has ``docs/design/SDD.md`` with the eight sections the convention requires.
2. Every requirement of a live feature (a row ``| ID | statement | gate |`` of
   ``docs/design/features/<slug>/requirements.md``) is stated with SHALL and has a gate cell.
3. **The named gate exists.** The gate cell names at least one file in backticks; every named file is
   on disk, and a named pytest test (``path.py::test_name``) is defined in it.

Check 3 is the one that matters: a requirement can name ``tests/test_nothing.py::test_imaginary`` and
pass check 2 while verifying nothing, which is the failure the rule exists for.

A feature whose ``requirements.md`` opens with ``Status: superseded`` is a record of replaced work,
not a live specification; it is skipped and listed, so a superseded gate cannot be mistaken for a
passing one.

Standard library only; exit 1 on any finding. Usage: ``python scripts/check_sdd.py [repo_root]``.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
SDD = ROOT / "docs" / "design" / "SDD.md"
FEATURES = ROOT / "docs" / "design" / "features"

SECTIONS = ("Problem and non-goals", "Contracts", "Lanes", "Method ladder", "Cases", "Oracles", "Deploy driver", "Risks and kill criteria")
ROW = re.compile(r"^\|\s*(?P<id>[A-Z]{2,}-\d+[a-z]?)\s*\|(?P<statement>.*?)\|(?P<gate>.*)\|\s*$")
TICKED = re.compile(r"`([^`]+)`")
FILE_LIKE = re.compile(r"^[\w./<>*-]+\.(py|ts|tsx|mjs|js|json|md|yml|yaml)(::[\w\[\]-]+)?$")


def sdd_findings() -> list[str]:
    if not SDD.is_file():
        return [f"{SDD.relative_to(ROOT)} is missing"]
    headings = [line.lstrip("#").strip() for line in SDD.read_text(encoding="utf-8").splitlines() if line.startswith("## ")]
    return [f"SDD.md has no section for {name!r}" for name in SECTIONS if not any(name.lower() in h.lower() for h in headings)]


def gate_findings(rel: str, rid: str, gate: str) -> list[str]:
    out: list[str] = []
    named = [t for t in TICKED.findall(gate) if FILE_LIKE.match(t)]
    if not named:
        return [f"{rel} {rid}: the gate names no file ({gate.strip()[:80]!r})"]
    for target in named:
        path_part, _, test = target.partition("::")
        # a bare file name refers to a file named earlier in the same cell
        candidates = [ROOT / path_part] if "/" in path_part else [ROOT / p for p in (t.partition('::')[0] for t in named) if p.endswith("/" + path_part)] or [ROOT / path_part]
        path = next((c for c in candidates if c.is_file()), None)
        if path is None:
            out.append(f"{rel} {rid}: names {path_part!r}, which does not exist")
            continue
        if test and path.suffix == ".py":
            name = test.split("[")[0]
            if not re.search(rf"^\s*def {re.escape(name)}\(", path.read_text(encoding="utf-8"), re.M):
                out.append(f"{rel} {rid}: {path_part} defines no test {name!r}")
    return out


def main() -> int:
    findings = sdd_findings()
    live = superseded = 0
    skipped: list[str] = []
    for req in sorted(FEATURES.glob("*/requirements.md")):
        rel = req.relative_to(ROOT).as_posix()
        text = req.read_text(encoding="utf-8")
        head = "\n".join(text.splitlines()[:6])
        if re.search(r"^Status:\s*superseded", head, re.M | re.I):
            superseded += 1
            skipped.append(req.parent.name)
            continue
        rows = [ROW.match(line) for line in text.splitlines()]
        rows = [r for r in rows if r]
        if not rows:
            findings.append(f"{rel}: no requirement rows")
        for r in rows:
            live += 1
            if "SHALL" not in r["statement"]:
                findings.append(f"{rel} {r['id']}: the statement has no SHALL")
            if not r["gate"].strip():
                findings.append(f"{rel} {r['id']}: no gate")
                continue
            findings.extend(gate_findings(rel, r["id"], r["gate"]))
    if findings:
        print("SDD CHECK FAILED:")
        for f in findings:
            print(f"  - {f}")
        return 1
    note = f"; superseded, not checked: {', '.join(skipped)}" if skipped else ""
    print(f"check_sdd: OK, SDD.md complete, {live} live requirements with real gates{note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
