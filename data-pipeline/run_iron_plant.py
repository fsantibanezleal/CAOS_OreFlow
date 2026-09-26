"""Chronological, leakage-aware soft-sensor experiment on open iron-flotation data.

This predicts the next hourly laboratory silica grade from current plant sensors.
It is observational forecast evidence, not an intervention or plant set-point model.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "iron-flotation-kaggle-v1.zip"
OUTPUT = ROOT / "data" / "derived" / "source" / "iron_plant_soft_sensor.json"
SOURCE_URL = "https://www.kaggle.com/api/v1/datasets/download/edumagalhaes/quality-prediction-in-a-mining-process?datasetVersionNumber=1"
SOURCE_PAGE = "https://www.kaggle.com/datasets/edumagalhaes/quality-prediction-in-a-mining-process"
SOURCE_SHA256 = "fa1fb0c928d84366ec1bd315e0ed1380f5d5576525603458b49ea4cfe446d98e"
CSV_NAME = "MiningProcess_Flotation_Plant_Database.csv"
TARGET = "% Silica Concentrate"
EXCLUDED = ("date", "% Iron Concentrate", TARGET)
MODEL_NAMES = ("train_mean", "previous_lab", "ridge", "random_forest", "hist_gradient_boosting",
               "ridge_with_previous_lab", "boosting_with_previous_lab")


def source_archive(path: Path = RAW) -> tuple[Path, str]:
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(SOURCE_URL, timeout=120) as response:
            content = response.read()
        if hashlib.sha256(content).hexdigest() != SOURCE_SHA256:
            raise ValueError("industrial source archive checksum drift")
        path.write_bytes(content)
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != SOURCE_SHA256:
        raise ValueError(f"industrial source archive checksum drift: {actual}")
    return path, actual


def load_source(path: Path = RAW) -> tuple[pd.DataFrame, str]:
    path, _ = source_archive(path)
    with ZipFile(path) as archive:
        if archive.namelist() != [CSV_NAME]:
            raise ValueError(f"unexpected industrial archive members: {archive.namelist()}")
        digest = hashlib.sha256()
        with archive.open(CSV_NAME) as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    frame = pd.read_csv(path, decimal=",", parse_dates=["date"])
    if frame.shape != (737453, 24) or set(EXCLUDED) - set(frame.columns):
        raise ValueError(f"industrial source schema/population drift: {frame.shape}")
    features = [column for column in frame if column not in EXCLUDED]
    if len(features) != 21 or frame[features + [TARGET]].isna().any().any():
        raise ValueError("industrial source predictor or missingness drift")
    return frame, digest.hexdigest()


def prepare_hours(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Collapse 20-second records, removing hours with changing lab labels."""
    required = {"date", TARGET, "% Iron Concentrate"}
    if not required.issubset(frame.columns):
        raise ValueError(f"missing industrial columns: {required - set(frame.columns)}")
    features = [column for column in frame if column not in EXCLUDED]
    if len(features) != 21:
        raise ValueError("expected 21 plant sensor predictors")
    groups = frame.groupby("date", sort=True)
    count = groups.size()
    unique_lab = groups[TARGET].nunique(dropna=False)
    label = groups[TARGET].first()
    sensors = groups[features].median()
    hours = sensors.copy()
    hours["silica_lab_pct"] = label
    hours["constant_lab_label"] = unique_lab.eq(1)
    hours["source_rows"] = count
    changing = unique_lab.ne(1)
    quality = {
        "source_rows": int(len(frame)), "nominal_hours": int(len(count)),
        "rows_per_hour_min": int(count.min()), "rows_per_hour_max": int(count.max()),
        "constant_lab_hours": int((~changing).sum()), "changing_lab_hours_excluded": int(changing.sum()),
        "changing_lab_rows_excluded": int(count[changing].sum()),
        "changing_lab_first_hour": str(unique_lab[changing].index[0]),
        "gap_hours": int((count.index.to_series().diff() > pd.Timedelta(hours=1)).sum()),
    }
    return hours, quality


def make_pairs(hours: pd.DataFrame) -> pd.DataFrame:
    """Only exact consecutive valid hours; current sensors predict next lab result."""
    next_date = hours.index.to_series().shift(-1)
    next_label = hours["silica_lab_pct"].shift(-1)
    next_valid = hours["constant_lab_label"].shift(-1).eq(True)
    valid = (hours["constant_lab_label"] & next_valid
             & (next_date - hours.index.to_series() == pd.Timedelta(hours=1)))
    pairs = hours.loc[valid].copy()
    pairs["target_next_hour_pct"] = next_label.loc[valid]
    pairs["target_hour"] = next_date.loc[valid]
    if pairs.empty or pairs["target_next_hour_pct"].isna().any():
        raise ValueError("no valid exact next-hour targets")
    return pairs


def make_models() -> dict:
    return {
        "ridge": Pipeline([("impute", SimpleImputer(strategy="median")),
                           ("scale", StandardScaler()), ("regressor", Ridge(alpha=30.0))]),
        "random_forest": Pipeline([("impute", SimpleImputer(strategy="median")),
                                   ("regressor", RandomForestRegressor(
                                       n_estimators=120, min_samples_leaf=8, max_features=0.8,
                                       random_state=42, n_jobs=1))]),
        "hist_gradient_boosting": Pipeline([("impute", SimpleImputer(strategy="median")),
                                            ("regressor", HistGradientBoostingRegressor(
                                                max_iter=150, max_leaf_nodes=15, learning_rate=0.05,
                                                l2_regularization=1.0, early_stopping=False, random_state=42))]),
    }


def score(y: np.ndarray, estimate: np.ndarray) -> dict:
    return {
        "mae_pct_points": round(float(mean_absolute_error(y, estimate)), 4),
        "rmse_pct_points": round(float(math.sqrt(mean_squared_error(y, estimate))), 4),
        "bias_pct_points": round(float(np.mean(estimate - y)), 4),
        "r2": round(float(r2_score(y, estimate)), 4),
    }


def evaluate(pairs: pd.DataFrame, features: list[str]) -> tuple[list[dict], dict]:
    x = pairs[features].to_numpy(dtype=float)
    y = pairs["target_next_hour_pct"].to_numpy(dtype=float)
    previous = pairs["silica_lab_pct"].to_numpy(dtype=float)
    x_with_lab = np.column_stack((x, previous))
    dates = pairs.index
    n = len(pairs)
    folds = []
    pooled_truth = []
    pooled_predictions = {name: [] for name in MODEL_NAMES}
    for fold_id, (begin_fraction, end_fraction) in enumerate(((0.50, 0.65), (0.65, 0.80), (0.80, 1.0))):
        begin = int(n * begin_fraction)
        end = int(n * end_fraction)
        test = np.arange(begin, end)
        first_test = dates[begin]
        train = np.flatnonzero(dates < first_test - pd.Timedelta(hours=24))
        if len(train) < 200 or len(test) < 100 or dates[train[-1]] >= first_test - pd.Timedelta(hours=24):
            raise ValueError("insufficient embargoed chronological training/test rows")
        predictions = {
            "train_mean": np.full(len(test), float(y[train].mean())),
            "previous_lab": previous[test],
        }
        for name, estimator in make_models().items():
            fit = clone(estimator).fit(x[train], y[train])
            predictions[name] = np.clip(fit.predict(x[test]), 0, 100)
        for name, estimator in (("ridge_with_previous_lab", make_models()["ridge"]),
                                ("boosting_with_previous_lab", make_models()["hist_gradient_boosting"])):
            fit = clone(estimator).fit(x_with_lab[train], y[train])
            predictions[name] = np.clip(fit.predict(x_with_lab[test]), 0, 100)
        for name, estimate in predictions.items():
            pooled_predictions[name].extend(estimate.tolist())
        pooled_truth.extend(y[test].tolist())
        # The full test population determines metrics; sparse traces only control payload size.
        trace_indices = np.unique(np.linspace(0, len(test) - 1, min(180, len(test)), dtype=int))
        trace = [{
            "sensor_hour": str(dates[test[i]]), "lab_hour": str(pairs.iloc[test[i]]["target_hour"]),
            "observed_pct": round(float(y[test[i]]), 4),
            "predictions_pct": {name: round(float(values[i]), 4) for name, values in predictions.items()},
        } for i in trace_indices]
        folds.append({
            "id": fold_id, "train_rows": len(train), "test_rows": len(test),
            "train_first": str(dates[train[0]]), "train_last": str(dates[train[-1]]),
            "test_first": str(dates[test[0]]), "test_last": str(dates[test[-1]]),
            "embargo_hours_min": round(float((first_test - dates[train[-1]]) / pd.Timedelta(hours=1)), 3),
            "scores": {name: score(y[test], estimate) for name, estimate in predictions.items()},
            "trace": trace,
        })
    pooled = {name: score(np.asarray(pooled_truth), np.asarray(values))
              for name, values in pooled_predictions.items()}
    return folds, pooled


def build(source_path: Path = RAW, output_path: Path = OUTPUT) -> dict:
    frame, csv_hash = load_source(source_path)
    hours, quality = prepare_hours(frame)
    pairs = make_pairs(hours)
    features = [column for column in frame if column not in EXCLUDED]
    folds, pooled = evaluate(pairs, features)
    artifact = {
        "schema": "oreflow.iron-plant-soft-sensor/v1",
        "source": {"title": "Quality Prediction in a Mining Process", "url": SOURCE_PAGE,
                   "publisher": "Eduardo Magalhaes Oliveira on Kaggle", "dataset_id": 6294,
                   "version": 1, "license": "CC0: Public Domain", "archive_sha256": SOURCE_SHA256,
                   "csv_sha256": csv_hash, "date_first": str(frame["date"].min()),
                   "date_last": str(frame["date"].max())},
        "quality": quality,
        "protocol": {"target": "next-hour measured % silica concentrate",
                     "features": features, "excluded_features": list(EXCLUDED),
                     "pair_rows": len(pairs), "sampling": "median of approximately 180 sensor rows per nominal hour; changing/interpolated lab-label hours excluded",
                     "splits": "three disjoint chronological future windows; expanding history; at least 24 h train/test embargo",
                     "interpretation": "observational one-plant quality forecast; no causal control effect, recovery or transfer claim",
                     "previous_lab_caveat": "persistence and lab-conditioned models assume previous hourly lab assay is already available; reporting latency is not established"},
        "pooled_scores": pooled, "folds": folds,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(artifact, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return artifact


if __name__ == "__main__":
    artifact = build()
    print("Iron-plant soft sensor:", artifact["quality"], "valid pairs", artifact["protocol"]["pair_rows"])
    print("Pooled forward-window MAE pp:", {name: values["mae_pct_points"] for name, values in artifact["pooled_scores"].items()})
