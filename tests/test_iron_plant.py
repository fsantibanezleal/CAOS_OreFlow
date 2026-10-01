"""IS-01 to IS-04 and IS-06: the iron-plant soft-sensor lane, checked on its committed artifact and on small
synthetic frames; the tests never refit the lane or read the 184 MB CSV."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

import run_iron_plant as lane

ARTIFACT = Path(__file__).resolve().parents[1] / "data" / "derived" / "source" / "iron_plant_soft_sensor.json"


def _artifact() -> dict:
    return json.loads(ARTIFACT.read_text(encoding="utf-8"))


def _frame(hours: int, varying: set[int] = frozenset(), rows: int = 3) -> pd.DataFrame:
    """A minimal plant frame: ``rows`` 20-second rows per hour, 21 sensors, the two concentrate assays."""
    sensors = [f"sensor {k}" for k in range(21)]
    records = []
    start = pd.Timestamp("2017-03-10 01:00:00")
    for h in range(hours):
        for r in range(rows):
            row = {"date": start + pd.Timedelta(hours=h), **{s: float(h + k) for k, s in enumerate(sensors)},
                   "% Iron Concentrate": 65.0, lane.TARGET: 2.0 + 0.1 * h + (0.01 * r if h in varying else 0.0)}
            records.append(row)
    return pd.DataFrame(records)


def test_source_pinned_and_population(tmp_path):
    source, quality = _artifact()["source"], _artifact()["quality"]
    assert source["archive_sha256"] == lane.SOURCE_SHA256 and source["license"] == "CC0: Public Domain"
    assert (source["dataset_id"], source["version"]) == (6294, 1)
    assert (quality["source_rows"], quality["nominal_hours"]) == (737_453, 4_097)
    tampered = tmp_path / "archive.zip"
    tampered.write_bytes(b"not the archive")
    with pytest.raises(ValueError, match="checksum drift"):
        lane.source_archive(tampered)


def test_interpolated_hours_excluded():
    hours, quality = lane.prepare_hours(_frame(4, varying={2}))
    assert list(hours["constant_lab_label"]) == [True, True, False, True]
    assert quality["changing_lab_hours_excluded"] == 1 and quality["changing_lab_rows_excluded"] == 3
    # the sensors are hourly medians, not 20-second rows
    assert len(hours) == 4 and hours["source_rows"].tolist() == [3, 3, 3, 3]
    q = _artifact()["quality"]
    assert (q["changing_lab_hours_excluded"], q["changing_lab_rows_excluded"]) == (310, 55_800)


def test_features_and_pairs():
    assert set(lane.EXCLUDED) == {"date", "% Iron Concentrate", lane.TARGET}
    protocol = _artifact()["protocol"]
    assert len(protocol["features"]) == 21 and not set(protocol["features"]) & set(lane.EXCLUDED)
    hours, _ = lane.prepare_hours(_frame(5, varying={2}))
    pairs = lane.make_pairs(hours)
    # hour 0 predicts hour 1; hours 1 and 2 touch the interpolated hour 2; hour 3 predicts hour 4
    assert [d.hour for d in pairs.index] == [1, 4]
    assert pairs["target_next_hour_pct"].tolist() == pytest.approx([2.1, 2.4])
    assert protocol["pair_rows"] == 3_701


def test_forward_windows_and_embargo():
    folds = _artifact()["folds"]
    assert len(folds) == 3
    for a, b in zip(folds, folds[1:]):
        assert pd.Timestamp(a["test_last"]) < pd.Timestamp(b["test_first"])
    for fold in folds:
        assert pd.Timestamp(fold["train_last"]) < pd.Timestamp(fold["test_first"]) - pd.Timedelta(hours=24)
        assert fold["embargo_hours_min"] >= 24.0
        assert set(fold["scores"]) == set(lane.MODEL_NAMES)
    # preprocessing is part of each model, so it is fitted inside each training window
    for model in lane.make_models().values():
        assert model.steps[0][0] == "impute"
    pooled = _artifact()["pooled_scores"]
    assert all(np.isfinite(v["mae_pct_points"]) for v in pooled.values())


def test_no_set_point_advice():
    protocol = _artifact()["protocol"]
    assert "no causal control effect" in protocol["interpretation"]
    assert "reporting latency is not established" in protocol["previous_lab_caveat"]
    text = json.dumps(_artifact()).lower()
    assert "set point" not in text and "setpoint" not in text and "recommend" not in text
