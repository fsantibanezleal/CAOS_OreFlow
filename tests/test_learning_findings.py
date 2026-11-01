"""Methodology page 14 quotes the learned lane's results; this pins every quoted number to the record.

The page's findings tables are parsed and each value is compared with ``data/derived/learning.json`` at
the precision the page prints it, so a new bake cannot leave the page describing the old one.
"""
from __future__ import annotations

import json
import re
import runpy
from copy import deepcopy
from pathlib import Path

import pytest

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


def test_within_case_and_transfer_table_quotes_the_record():
    """L-01, L-03: the scores within each case and with a whole ore group held out."""
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    rows = _rows(_findings(), "Model, within case and one group out")
    assert {r[0] for r in rows} == set(MODELS), rows
    columns = ("interpolation_r2_within_case", "transfer_r2_median", "transfer_rmse_mean")
    for cells in rows:
        model = MODELS[cells[0]]
        values = cells[1:]
        assert len(values) == len(TARGETS) * len(columns), cells
        for k, (target, column) in enumerate((t, c) for t in TARGETS for c in columns):
            actual = record["summary"][model][target][column]
            assert _matches(values[k], actual), (cells[0], target, column, values[k], actual)


def test_guard_table_quotes_the_record():
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    folds = record["leave_one_case_out"]
    measured = {
        "Threshold of the interpolation-split guard (mean squared error)": record["guard"]["threshold"],
        # W-42 (review of 0.07.000): the shipped guard is the final fit's, with its own threshold
        "Threshold of the exported guard, fitted on every state": record["final"]["guard_threshold"],
        "False alarms on held-out in-envelope states": 100.0 * record["guard"]["false_alarm_rate"],
        "False accepts on shifted probes": 100.0 * record["guard"]["false_accept_rate"],
        "States of the held-out case flagged (mean over folds)": 100.0 * sum(f["held_out_flag_rate"] for f in folds) / len(folds),
    }
    rows = _rows(_findings(), "Guard")
    assert {r[0] for r in rows} == set(measured), rows
    for name, quoted, *_ in rows:
        assert _matches(quoted, measured[name]), (name, quoted, measured[name])
    # W-42: the guard's training ran to the epoch cap, and the page says so instead of "the same early stopping"
    training = record["guard"]["training"]
    assert training["epochs_run"] == record["settings"]["max_epochs"]
    page = " ".join((ROOT / "docs" / "methodologies" / "14_learned-lane.md").read_text(encoding="utf-8").split())
    assert f"ran to the {record['settings']['max_epochs']}-epoch cap (best epoch {training['best_epoch']})" in page


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


def test_protocols_section_quotes_the_group_folds():
    """The Protocols section listed two protocols for a release after the record gained the third (L-01); it is held
    to the record's ore groups and fold sizes."""
    record = json.loads(RECORD.read_text(encoding="utf-8"))
    groups = {g["held_out_group"]: g for g in record["leave_one_group_out"]}
    cu, au = groups["Cu:chalcopyrite"], groups["Au:pyrite"]
    alone = len(record["transfer_groups"]) - len(cu["cases"]) - len(au["cases"])
    words = {5: "five", 7: "seven"}
    text = re.sub(r"\s+", " ", PAGE.read_text(encoding="utf-8"))
    section = text[text.index("## Protocols"):text.index("## Models")]
    for phrase in (f"the {words[len(cu['cases'])]} chalcopyrite plants ({cu['train_rows']} training and {cu['test_rows']} test rows)",
                   f"the two gold plants with most of their gold in pyrite ({au['train_rows']} and {au['test_rows']})",
                   f"each of the other {words[alone]} alone",
                   f"{words[len(set(record['transfer_groups'].values()))]} groups in all"):
        assert phrase in section, phrase


def _reindex_seed_scores(record, indices, seed_ids):
    """Change every dependent array consistently, leaving the intended configuration alone."""
    seeds = record["mlp_seeds"]
    seeds["seeds"] = list(seed_ids)
    for targets in seeds["scores"].values():
        for target, scores in targets.items():
            targets[target] = [deepcopy(scores[i]) for i in indices]
            for seed, score in zip(seed_ids, targets[target]):
                score["evaluation"]["seed"] = seed
    for target, summary in seeds["summary"].items():
        for field in ("interpolation_rmse", "loco_rmse_mean", "loco_r2_median", "loco_folds"):
            summary[field] = [deepcopy(summary[field][i]) for i in indices]
        summary["loco_rmse_by_case"] = {case: [values[i] for i in indices]
                                        for case, values in summary["loco_rmse_by_case"].items()}
        if "seeds" in record["summary"]["mlp"][target]:
            record["summary"]["mlp"][target]["seeds"] = deepcopy(summary)


def _seed_inventory_fixture():
    record = json.loads((ROOT / "tests/contracts/fixtures/learning-v2.json").read_text(encoding="utf-8"))
    # Three configured seeds let a mutation reorder only noninitial IDs, defeating
    # the old first-seed/uniqueness checks without inventing production evidence.
    record["settings"]["mlp_seed_offsets"] = [0, 1, 2]
    _reindex_seed_scores(record, [0, 1, 1], [1, 2, 3])
    for target in record["targets"]:
        record["summary"]["mlp"][target]["seeds"] = deepcopy(record["mlp_seeds"]["summary"][target])
    return record


def _check_seed_inventory(record):
    return runpy.run_path(str(ROOT / "scripts/check_artifacts.py"))["check_learning_cohorts"](record)


@pytest.mark.parametrize("indices,ids", [
    ([0, 2], [1, 3]),
    ([0, 1, 2], [1, 99, 3]),
    ([0, 2, 1], [1, 3, 2]),
    ([0, 1, 2, 2], [1, 2, 3, 4]),
], ids=["removed-noninitial", "substituted-noninitial", "reordered-noninitial", "extra"])
def test_adversarial_configured_seed_inventory_cannot_be_shortened(indices, ids):
    record = _seed_inventory_fixture()
    assert _check_seed_inventory(record) == []
    _reindex_seed_scores(record, indices, ids)
    findings = _check_seed_inventory(record)
    assert findings and all("planned seed inventory" in finding for finding in findings), findings


@pytest.mark.parametrize("offsets", [[0], [0, 11], [0, 11, 22]])
def test_configured_seed_inventory_accepts_complete_one_or_many_seeds(offsets):
    record = _seed_inventory_fixture()
    record["settings"]["mlp_seed_offsets"] = offsets
    _reindex_seed_scores(record, list(range(len(offsets))), [record["design"]["seed"] + offset for offset in offsets])
    assert _check_seed_inventory(record) == []


@pytest.mark.parametrize("field,value", [
    ("offsets", None), ("offsets", []), ("offsets", "0,1,2"), ("offsets", [0, {}]),
    ("offsets", [0, True]), ("offsets", [0, 1.5]), ("offsets", [0, 0]),
    ("offsets", [0, float("inf")]), ("offsets", [0, 2**53 - 1]),
    ("base", None), ("base", True), ("base", "1"), ("base", float("nan")), ("base", 10**1000),
    ("ids", None), ("ids", []), ("ids", [1, {}]), ("ids", [1, True]), ("ids", [1, 2.5]),
    ("settings", None), ("missing-offsets", None), ("missing-base", None),
])
def test_adversarial_malformed_seed_declarations_have_findings_without_tracebacks(field, value):
    record = _seed_inventory_fixture()
    if field == "offsets":
        record["settings"]["mlp_seed_offsets"] = value
    elif field == "base":
        record["design"]["seed"] = value
    elif field == "ids":
        record["mlp_seeds"]["seeds"] = value
    elif field == "settings":
        record["settings"] = value
    elif field == "missing-offsets":
        del record["settings"]["mlp_seed_offsets"]
    else:
        del record["design"]["seed"]
    assert _check_seed_inventory(record)
