"""Reproducible measured LCT-recovery benchmark, separate from OreFlow's simulator.

Source: GeoMet dataset v4, Zenodo 7051975, CC BY 4.0. The raw workbook is
downloaded to ignored data/raw; only compact attributed evaluation is exported.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from urllib.request import urlopen

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestRegressor
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, RBF, WhiteKernel
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "geomet-flotation.csv"
OUTPUT = ROOT / "data" / "derived" / "source" / "geomet_lct_benchmark.json"
CHECKPOINT = ROOT / "models" / "geomet_lct.joblib"
SOURCE_URL = "https://zenodo.org/api/records/7051975/files/flotation.csv/content"
SOURCE_MD5 = "f2e90da6bfa81de1261177ee85a91570"
FEATURES = ("Cu ppm", "Fe ppm", "S ppm", "Si ppm", "Al ppm")
MODEL_NAMES = ("train_mean", "ridge", "random_forest", "gaussian_process")


def source_bytes(path: Path = RAW) -> bytes:
    if path.is_file():
        data = path.read_bytes()
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(SOURCE_URL, timeout=30) as response:
            data = response.read()
        if hashlib.md5(data).hexdigest() == SOURCE_MD5:
            path.write_bytes(data)
    actual = hashlib.md5(data).hexdigest()
    if actual != SOURCE_MD5:
        raise ValueError(f"GeoMet source checksum drift: {actual}")
    return data


def load_rows(path: Path = RAW) -> tuple[pd.DataFrame, list[dict]]:
    source_bytes(path)
    frame = pd.read_csv(path)
    required = {"HOLEID", "X", "Y", "Z", "LCT", *FEATURES}
    if not required.issubset(frame.columns):
        raise ValueError(f"missing source columns: {sorted(required - set(frame.columns))}")
    exclusions = []
    keep = []
    for idx, row in frame.iterrows():
        target = row["LCT"]
        reason = ("missing LCT" if pd.isna(target) else "LCT outside [0,1]" if not 0 <= target <= 1
                  else "missing hole/location" if pd.isna(row[["HOLEID", "X", "Y", "Z"]]).any() else None)
        if reason:
            exclusions.append({"source_row": int(idx) + 2, "reason": reason})
        else:
            keep.append(idx)
    usable = frame.loc[keep].copy()
    usable["source_row"] = usable.index + 2
    if usable.empty or usable["HOLEID"].nunique() < 5:
        raise ValueError("insufficient distinct holes for five-fold evaluation")
    return usable.reset_index(drop=True), exclusions


def spatial_zones(frame: pd.DataFrame) -> np.ndarray:
    """Leave contiguous X-ordered sets of complete holes out; never split a hole."""
    holes = frame.groupby("HOLEID")["X"].mean().sort_values().index.to_numpy()
    mapping = {hole: zone for zone, group in enumerate(np.array_split(holes, 3)) for hole in group}
    return frame["HOLEID"].map(mapping).to_numpy(dtype=int)


def make_models() -> dict:
    transform = [("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]
    return {
        "ridge": Pipeline([*transform, ("regressor", Ridge(alpha=10.0))]),
        "random_forest": Pipeline([("impute", SimpleImputer(strategy="median")),
                                   ("regressor", RandomForestRegressor(n_estimators=160, min_samples_leaf=3,
                                                                        max_features=0.8, random_state=42, n_jobs=1))]),
        "gaussian_process": Pipeline([*transform, ("regressor", GaussianProcessRegressor(
            kernel=ConstantKernel(1.0, constant_value_bounds="fixed") * RBF(2.0, length_scale_bounds="fixed")
            + WhiteKernel(0.05, noise_level_bounds="fixed"), optimizer=None, normalize_y=True))]),
    }


def scores(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    return {"mae_pp": round(float(mean_absolute_error(actual, predicted)), 4),
            "rmse_pp": round(float(math.sqrt(mean_squared_error(actual, predicted))), 4),
            "bias_pp": round(float(np.mean(predicted - actual)), 4),
            "r2": round(float(r2_score(actual, predicted)), 4)}


def evaluate(frame: pd.DataFrame, protocol: str) -> dict:
    x = np.log1p(frame[list(FEATURES)].apply(pd.to_numeric, errors="coerce").clip(lower=0).to_numpy(dtype=float))
    y = frame["LCT"].to_numpy(dtype=float) * 100
    holes = frame["HOLEID"].to_numpy()
    groups = holes if protocol == "hole" else spatial_zones(frame)
    n_splits = 5 if protocol == "hole" else 3
    predictions = {name: np.full(len(y), np.nan) for name in MODEL_NAMES}
    fold_ids = np.full(len(y), -1, dtype=int)
    folds = []
    for fold, (train, test) in enumerate(GroupKFold(n_splits=n_splits).split(x, y, groups=groups)):
        train_holes = set(holes[train].tolist())
        test_holes = set(holes[test].tolist())
        if train_holes & test_holes:
            raise AssertionError("same-hole train/test leakage")
        fold_ids[test] = fold
        predictions["train_mean"][test] = y[train].mean()
        for name, estimator in make_models().items():
            model = clone(estimator).fit(x[train], y[train])
            predictions[name][test] = np.clip(model.predict(x[test]), 0, 100)
        folds.append({"id": fold, "train_rows": len(train), "test_rows": len(test),
                      "train_holes": len(train_holes), "test_holes": len(test_holes),
                      "test_source_rows": frame.iloc[test]["source_row"].astype(int).tolist()})
    if np.any(fold_ids < 0) or any(not np.isfinite(values).all() for values in predictions.values()):
        raise AssertionError("incomplete out-of-fold prediction matrix")
    rows = []
    for i, row in frame.iterrows():
        rows.append({"source_row": int(row["source_row"]), "hole_id": str(row["HOLEID"]),
                     "x": round(float(row["X"]), 3), "y": round(float(row["Y"]), 3),
                     "observed_lct_pct": round(float(y[i]), 4), "fold": int(fold_ids[i]),
                     "predictions_pct": {name: round(float(values[i]), 4) for name, values in predictions.items()}})
    return {"folds": folds, "scores": {name: scores(y, values) for name, values in predictions.items()}, "rows": rows}


def build(source_path: Path = RAW, output_path: Path = OUTPUT) -> dict:
    data = source_bytes(source_path)
    frame, exclusions = load_rows(source_path)
    if len(frame) != 52 or len(exclusions) != 1:
        raise ValueError(f"pinned source population drift: {len(frame)} usable, {len(exclusions)} excluded")
    artifact = {
        "schema": "oreflow.geomet-lct/v1",
        "source": {"title": "GeoMet dataset", "record": "https://zenodo.org/records/7051975",
                   "doi": "10.5281/zenodo.7051975", "concept_doi": "10.5281/zenodo.6336137",
                   "paper_doi": "10.1007/s11004-022-10013-1", "license": "CC BY 4.0",
                   "md5": SOURCE_MD5, "sha256": hashlib.sha256(data).hexdigest(),
                   "raw_rows": len(frame) + len(exclusions), "usable_rows": len(frame),
                   "holes": int(frame["HOLEID"].nunique()), "exclusions": exclusions},
        "protocol": {"target": "LCT measured locked-cycle copper recovery, converted from fraction to percent",
                     "features": list(FEATURES), "transform": "log1p of nonnegative ppm; fold-local median imputation; fold-local scaling for ridge/GP",
                     "excluded_features": ["HOLEID", "X", "Y", "Z", "fr", "xr", "LCT"],
                     "hole": "five GroupKFold folds; complete holes excluded from training",
                     "zone": "three GroupKFold folds; holes sorted by mean X into three spatial zones",
                     "models": {"train_mean": "training-fold mean", "ridge": "alpha=10",
                                "random_forest": "160 trees, leaf>=3, max_features=0.8, seed=42",
                                "gaussian_process": "fixed RBF length-scale=2 and white noise=0.05; train-conditioned"},
                     "boundary": "one deposit, sparse locked-cycle tests; no grind/reagent/residence controls; not a plant operating-point model"},
        "protocols": {name: evaluate(frame, name) for name in ("hole", "zone")},
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(artifact, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return artifact


def validate_assays(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    if frame.empty or not set(FEATURES).issubset(frame.columns):
        raise ValueError(f"assay CSV requires nonempty rows and columns: {', '.join(FEATURES)}")
    for feature in FEATURES:
        original = frame[feature]
        values = pd.to_numeric(original, errors="coerce")
        if (original.notna() & values.isna()).any():
            raise ValueError(f"non-numeric assay in {feature}")
        if ((values < 0) | (values > 1_000_000)).any():
            raise ValueError(f"assay outside physical ppm range in {feature}")
        frame[feature] = values
    if frame[list(FEATURES)].isna().all(axis=1).any():
        raise ValueError("at least one assay is required in every row")
    return frame


def fit_checkpoint(source_path: Path = RAW, checkpoint_path: Path = CHECKPOINT) -> dict:
    data = source_bytes(source_path)
    frame, _ = load_rows(source_path)
    values = frame[list(FEATURES)].apply(pd.to_numeric, errors="coerce").to_numpy(dtype=float)
    x = np.log1p(np.clip(values, 0, None))
    y = frame["LCT"].to_numpy(dtype=float) * 100
    models = {name: estimator.fit(x, y) for name, estimator in make_models().items()}
    checkpoint = {"schema": "oreflow.geomet-checkpoint/v1", "source_sha256": hashlib.sha256(data).hexdigest(),
                  "features": list(FEATURES), "training_rows": len(y),
                  "assay_min": np.nanmin(values, axis=0).tolist(), "assay_max": np.nanmax(values, axis=0).tolist(),
                  "models": models}
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(checkpoint, checkpoint_path)
    return checkpoint


def predict_assays(input_path: Path, output_path: Path, source_path: Path = RAW,
                   checkpoint_path: Path = CHECKPOINT) -> pd.DataFrame:
    frame = validate_assays(input_path)
    expected_hash = hashlib.sha256(source_bytes(source_path)).hexdigest()
    checkpoint = joblib.load(checkpoint_path) if checkpoint_path.is_file() else fit_checkpoint(source_path, checkpoint_path)
    if checkpoint.get("schema") != "oreflow.geomet-checkpoint/v1" or checkpoint.get("source_sha256") != expected_hash or checkpoint.get("features") != list(FEATURES):
        raise ValueError("stale or incompatible GeoMet checkpoint; rerun --fit-checkpoint")
    values = frame[list(FEATURES)].to_numpy(dtype=float)
    missing = np.isnan(values).sum(axis=1)
    below = values < np.array(checkpoint["assay_min"])
    above = values > np.array(checkpoint["assay_max"])
    outside = np.any(below | above, axis=1)
    x = np.log1p(np.clip(values, 0, None))
    output = frame.copy()
    output["missing_assay_count"] = missing
    output["outside_reference_range"] = outside
    for name, model in checkpoint["models"].items():
        output[f"{name}_lct_pct"] = np.clip(model.predict(x), 0, 100)
    output["evidence_boundary"] = "within-deposit locked-cycle model; not a plant set-point"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.to_csv(output_path, index=False)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fit-checkpoint", action="store_true", help="fit full-data local inference checkpoint after evaluation")
    parser.add_argument("--predict", type=Path, help="local CSV containing the five named assay columns")
    parser.add_argument("--output", type=Path, help="prediction CSV path (required with --predict)")
    args = parser.parse_args()
    if args.predict:
        if args.output is None:
            parser.error("--output is required with --predict")
        prediction = predict_assays(args.predict, args.output)
        print(f"GeoMet local assay inference: {len(prediction)} rows -> {args.output}; "
              f"{int(prediction['outside_reference_range'].sum())} outside reference range")
    else:
        artifact = build()
        print(f"GeoMet LCT benchmark: {artifact['source']['usable_rows']} measured tests, "
              f"{artifact['source']['holes']} holes, 2 leakage-safe protocols, 4 models")
        for name, protocol in artifact["protocols"].items():
            print(name, {model: score["rmse_pp"] for model, score in protocol["scores"].items()})
        if args.fit_checkpoint:
            checkpoint = fit_checkpoint()
            print(f"Local inference checkpoint: {checkpoint['training_rows']} rows -> {CHECKPOINT}")
