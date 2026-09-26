"""Methodology page 14 quotes the learned lane's results; this pins every quoted number to the record.

The page's findings tables are parsed and each value is compared with ``data/derived/learning.json`` at
the precision the page prints it, so a new bake cannot leave the page describing the old one.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "docs" / "methodologies" / "14_learned-lane.md"
RECORD = ROOT / "data" / "derived" / "learning.json"
MODELS = {"Ridge": "ridge", "Random forest": "random_forest", "Gradient boosting": "hist_gradient_boosting",
          "Gaussian process": "gaussian_process", "MLP": "mlp"}
TARGETS = ("recovery_pct", "log_upgrade", "specific_energy_total_kwh_t")
COLUMNS = ("interpolation_r2", "loco_r2_median", "loco_rmse_mean")


def _findings() -> str:
    text = PAGE.read_text(encoding="utf-8")
    assert "## Findings" in text, "page 14 has no findings section"
    return text.split("## Findings", 1)[1].split("\n## ", 1)[0]


def _rows(section: str, first: str) -> list[list[str]]:
    """Body rows of the table whose header's first cell is ``first`` (tables end at a non-table line)."""
    tables: list[list[str]] = []
    current: list[str] = []
    for line in section.splitlines():
        if line.startswith("|"):
            current.append(line)
        elif current:
            tables.append(current)
            current = []
    if current:
        tables.append(current)
    table = next(t for t in tables if t[0].startswith(f"| {first} "))
    return [[c.strip() for c in line.strip().strip("|").split("|")] for line in table[2:]]


def _matches(quoted: str, value: float) -> bool:
    text = quoted.replace("−", "-").replace("%", "").strip()
    decimals = len(text.split(".")[1]) if "." in text else 0
    return abs(round(value, decimals) - float(text)) < 10 ** -(decimals + 3) or f"{value:.{decimals}f}" == text


def test_model_table_quotes_the_record():
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    rows = _rows(_findings(), "Model")
    assert {r[0] for r in rows} == set(MODELS), rows
    for cells in rows:
        model = MODELS[cells[0]]
        values = cells[1:]
        assert len(values) == len(TARGETS) * len(COLUMNS), cells
        for k, (target, column) in enumerate((t, c) for t in TARGETS for c in COLUMNS):
            actual = record["summary"][model][target][column]
            assert _matches(values[k], actual), (cells[0], target, column, values[k], actual)


def test_guard_table_quotes_the_record():
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    folds = record["leave_one_case_out"]
    measured = {
        "Threshold (mean squared error)": record["guard"]["threshold"],
        "False alarms on held-out in-envelope states": 100.0 * record["guard"]["false_alarm_rate"],
        "False accepts on shifted probes": 100.0 * record["guard"]["false_accept_rate"],
        "States of the held-out case flagged (mean over folds)": 100.0 * sum(f["held_out_flag_rate"] for f in folds) / len(folds),
    }
    rows = _rows(_findings(), "Guard")
    assert {r[0] for r in rows} == set(measured), rows
    for name, quoted, *_ in rows:
        assert _matches(quoted, measured[name]), (name, quoted, measured[name])


def test_fold_table_quotes_the_record():
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    index = json.loads((ROOT / "data" / "derived" / "manifests" / "index.json").read_text(encoding="utf-8"))
    titles = {c["title"]["en"]: c["case_id"] for c in index["cases"]}
    flagged = {f["held_out"]: 100.0 * f["held_out_flag_rate"] for f in record["leave_one_case_out"]}
    rows = _rows(_findings(), "Held-out case")
    assert {titles[r[0]] for r in rows} == set(flagged), rows
    for name, quoted, *_ in rows:
        assert _matches(quoted, flagged[titles[name]]), (name, quoted)


def test_interval_and_importance_tables_quote_the_record():
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    gp = record["interpolation"]["models"]["gaussian_process"]
    (coverage,) = _rows(_findings(), "Gaussian process, interpolation split")
    for quoted, target in zip(coverage[1:], TARGETS):
        assert _matches(quoted, 100.0 * gp[target]["coverage_95"]), (target, quoted)
    importance = record["interpolation"]["permutation_importance"]["recovery_pct"]
    top = sorted(importance.items(), key=lambda kv: -kv[1])[:5]
    rows = _rows(_findings(), "Feature (gradient boosting, recovery)")
    assert [r[0].strip("`") for r in rows] == [k for k, _ in top], rows
    for (name, quoted, *_), (_, value) in zip(rows, top):
        assert _matches(quoted, value), (name, quoted, value)


def test_design_line_quotes_the_record():
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    section = _findings()
    match = re.search(r"(\d[\d,]*) engine states", section)
    assert match and int(match.group(1).replace(",", "")) == record["design"]["rows"]
