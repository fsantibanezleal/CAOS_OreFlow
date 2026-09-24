"""Cheap committed-artifact checks; CI must never refit the measured benchmark."""
from __future__ import annotations

import json
import math
from pathlib import Path
import pandas as pd
import pytest

from run_geomet import validate_assays

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "data" / "derived" / "source" / "geomet_lct_benchmark.json"


def load():
    return json.loads(ARTIFACT.read_text(encoding="utf-8"))


def test_source_hash():
    source = load()["source"]
    assert source["md5"] == "f2e90da6bfa81de1261177ee85a91570"
    assert source["sha256"] == "e7968c250c1ccc17b63da6d9624473dd92b32a7ba8d8772e70070a0115e42eda"
    assert source["license"] == "CC BY 4.0"
    assert source["doi"] == "10.5281/zenodo.7051975"


def test_contract_and_missingness():
    artifact = load()
    assert artifact["schema"] == "oreflow.geomet-lct/v1"
    assert (artifact["source"]["raw_rows"], artifact["source"]["usable_rows"], artifact["source"]["holes"]) == (53, 52, 29)
    assert artifact["source"]["exclusions"] == [{"source_row": 29, "reason": "missing LCT"}]
    for protocol in artifact["protocols"].values():
        assert len(protocol["rows"]) == 52
        assert len({row["source_row"] for row in protocol["rows"]}) == 52
        assert all(0 <= row["observed_lct_pct"] <= 100 for row in protocol["rows"])


def test_group_splits():
    for protocol in load()["protocols"].values():
        hole_to_fold = {}
        for row in protocol["rows"]:
            prior = hole_to_fold.setdefault(row["hole_id"], row["fold"])
            assert row["fold"] == prior
        assert set(row["fold"] for row in protocol["rows"]) == set(range(len(protocol["folds"])))
        assert sum(fold["test_rows"] for fold in protocol["folds"]) == 52
        for fold in protocol["folds"]:
            assert fold["train_rows"] + fold["test_rows"] == 52
            assert fold["train_holes"] + fold["test_holes"] == 29


def test_benchmark_matrix():
    models = {"train_mean", "ridge", "random_forest", "gaussian_process"}
    for protocol in load()["protocols"].values():
        assert set(protocol["scores"]) == models
        for score in protocol["scores"].values():
            assert all(math.isfinite(score[key]) for key in ("mae_pp", "rmse_pp", "bias_pp", "r2"))
        for row in protocol["rows"]:
            assert set(row["predictions_pct"]) == models
            assert all(0 <= value <= 100 for value in row["predictions_pct"].values())


def test_evidence_boundary():
    protocol = load()["protocol"]
    assert protocol["features"] == ["Cu ppm", "Fe ppm", "S ppm", "Si ppm", "Al ppm"]
    assert {"HOLEID", "X", "Y", "Z", "fr", "xr", "LCT"}.issubset(protocol["excluded_features"])
    assert "not a plant operating-point model" in protocol["boundary"]


def test_assay_input_contract(tmp_path):
    valid = tmp_path / "valid.csv"
    pd.DataFrame([{"Cu ppm": 5000, "Fe ppm": 200000, "S ppm": 2300,
                   "Si ppm": 185000, "Al ppm": 50000, "sample_id": "A"}]).to_csv(valid, index=False)
    frame = validate_assays(valid)
    assert frame.loc[0, "sample_id"] == "A"
    missing = tmp_path / "missing.csv"
    pd.DataFrame([{"Cu ppm": 5000}]).to_csv(missing, index=False)
    with pytest.raises(ValueError, match="requires"):
        validate_assays(missing)
    negative = tmp_path / "negative.csv"
    pd.DataFrame([{"Cu ppm": -1, "Fe ppm": 200000, "S ppm": 2300,
                   "Si ppm": 185000, "Al ppm": 50000}]).to_csv(negative, index=False)
    with pytest.raises(ValueError, match="physical"):
        validate_assays(negative)
