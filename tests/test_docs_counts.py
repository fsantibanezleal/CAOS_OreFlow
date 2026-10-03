"""The documentation's counts and tables against the records (review of 2026-10-02, W-11 to W-16, W-24, W-54).

Docs drifted from 0.05 to 0.07 while every gate passed: "six stages" above a table of eight, "two measured lanes"
when there were three, "72 variants" when there were 96. This holds the prose that describes the current product to
the contract, the index, the validation record and the case records. Historical records (the CHANGELOG, the release
verification, the superseded design sections) are left alone: they describe their own release.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _cases() -> list[dict]:
    index = _read(DERIVED / "manifests" / "index.json")
    return [_read(DERIVED / "cases" / f"{entry['case_id']}.json") for entry in index["cases"]]


MECHANISMS = (
    ("Gravity bleed", lambda units, pays: "gravity_split" in units),
    ("Desliming", lambda units, pays: "deslime" in units),
    ("LIMS drums", lambda units, pays: "lims_rougher" in units),
    ("Flotation", lambda units, pays: "rougher" in units),
    ("Regrind", lambda units, pays: "regrind" in units),
    ("Recleaner", lambda units, pays: "recleaner" in units),
    ("Second payable", lambda units, pays: len(pays) > 1),
)
COMMON = {"nominal", "harder_ore", "coarser_grind", "higher_throughput", "more_collector", "more_air", "cut_nominal", "cut_finer"}


def test_the_sdd_coverage_matrix_is_the_records():
    """W-54: SDD section 5's case-by-mechanism matrix, row by row, from each case's nominal circuit and variants."""
    text = (ROOT / "docs" / "design" / "SDD.md").read_text(encoding="utf-8")
    header = "| Case | " + " | ".join(name for name, _ in MECHANISMS) + " | Levers of its own |"
    assert header in text
    rows = {}
    for line in text[text.index(header):].splitlines()[2:]:
        if not line.startswith("|"):
            break
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows[cells[0]] = cells[1:]
    cases = _cases()
    assert sorted(rows) == sorted(a["case_id"] for a in cases)
    for artifact in cases:
        units = {u["unit"] for u in artifact["variants"][0]["trace"]["topology"]}
        pays = artifact["definition"]["ore"]["payables"]
        own = ", ".join(v["id"] for v in artifact["variants"] if v["id"] not in COMMON)
        expected = ["yes" if has(units, pays) else "" for _, has in MECHANISMS] + [own]
        assert rows[artifact["case_id"]] == expected, artifact["case_id"]
    # and every harder-ore and higher-throughput variant is power-limited, as the section says
    for artifact in cases:
        limited = {v["id"] for v in artifact["variants"] if v["trace"]["metrics"]["power_limited"]}
        assert {"harder_ore", "higher_throughput"} <= limited, artifact["case_id"]
    assert re.search(r"every harder-ore and higher-throughput\s+variant is power-limited", text)
