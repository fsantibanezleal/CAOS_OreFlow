"""Particle-level separation experiment on the published HZDR constructed cases.

The workbook's test sheet deliberately contains oracle probabilities but no
realized class labels. We train on the four training-sheet A/B labels and
evaluate probability error against the held-out constructed oracles. This is
not a plant-recovery benchmark.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

FEATURES = ("Aspect Ratio", "Solidity", "ECD", "Mineral 1 surface")
CASE_IDS = ("1", "2", "3", "4")
SCHEMA = "oreflow.particle-benchmark/v1"
SOURCE = "https://doi.org/10.14278/rodare.336"


def _score(predicted: np.ndarray, oracle: np.ndarray) -> dict[str, float]:
    residual = predicted - oracle
    return {
        "rmse": round(float(np.sqrt(np.mean(residual**2))), 6),
        "mae": round(float(np.mean(np.abs(residual))), 6),
        "bias": round(float(np.mean(residual)), 6),
    }


def _calibration(predicted: np.ndarray, oracle: np.ndarray) -> list[dict[str, Any]]:
    bins = np.minimum((predicted * 20).astype(int), 19)
    return [
        {
            "bin": i,
            "count": int(np.sum(bins == i)),
            "predicted": round(float(np.mean(predicted[bins == i])), 5),
            "oracle": round(float(np.mean(oracle[bins == i])), 5),
        }
        for i in range(20)
        if np.any(bins == i)
    ]


def _thresholds(predicted: np.ndarray, oracle: np.ndarray) -> list[dict[str, float]]:
    oracle_total = float(oracle.sum())
    rows = []
    for index in range(101):
        threshold = index / 100
        selected = predicted >= threshold
        count = int(selected.sum())
        rows.append({
            "threshold": threshold,
            "selected_fraction": round(count / len(oracle), 6),
            "expected_recovery": round(float(oracle[selected].sum()) / oracle_total, 6),
            "expected_grade_proxy": round(float(oracle[selected].mean()), 6) if count else 0.0,
        })
    return rows


def run(raw_file: str | Path, output: str | Path, model_dir: str | Path, seed: int = 42) -> dict[str, Any]:
    """Fit two independent model families and export a complete held-out audit."""
    import torch
    from torch import nn

    raw_file, output, model_dir = Path(raw_file), Path(output), Path(model_dir)
    if not raw_file.is_file():
        raise FileNotFoundError(raw_file)
    model_dir.mkdir(parents=True, exist_ok=True)
    train = pd.read_excel(raw_file, sheet_name="Train data")
    test = pd.read_excel(raw_file, sheet_name="Test data")
    required_train = set(FEATURES) | {f"Class {case}" for case in CASE_IDS}
    required_test = set(FEATURES) | {f"Probability {case}" for case in CASE_IDS} | {f"Predicted probability {case}" for case in CASE_IDS}
    if not required_train.issubset(train.columns) or not required_test.issubset(test.columns):
        raise ValueError("HZDR workbook columns do not match the recorded contract")
    x_all = train[list(FEATURES)].to_numpy(dtype=np.float32)
    x_test_raw = test[list(FEATURES)].to_numpy(dtype=np.float32)
    y_all = np.column_stack([(train[f"Class {case}"] == "B").to_numpy(dtype=np.float32) for case in CASE_IDS])
    oracle = np.column_stack([test[f"Probability {case}"].to_numpy(dtype=np.float32) for case in CASE_IDS])
    published = np.column_stack([test[f"Predicted probability {case}"].to_numpy(dtype=np.float32) for case in CASE_IDS])
    if not (np.isfinite(x_all).all() and np.isfinite(x_test_raw).all()):
        raise ValueError("Nonfinite particle feature")
    valid_oracle = oracle[np.isfinite(oracle)]
    if not np.isin(y_all, [0, 1]).all() or not np.logical_and(valid_oracle >= 0, valid_oracle <= 1).all():
        raise ValueError("Invalid particle class or probability")
    fit_idx, validation_idx = train_test_split(np.arange(len(train)), test_size=0.15, random_state=seed, stratify=y_all[:, 0])
    scaler = StandardScaler().fit(x_all[fit_idx])
    x_fit = scaler.transform(x_all[fit_idx]).astype(np.float32)
    x_validation = scaler.transform(x_all[validation_idx]).astype(np.float32)
    x_test = scaler.transform(x_test_raw).astype(np.float32)

    classical = np.empty_like(oracle)
    coefficients: dict[str, Any] = {}
    for column, case in enumerate(CASE_IDS):
        logistic = LogisticRegression(penalty="l1", solver="saga", C=1.0, max_iter=2500, random_state=seed)
        logistic.fit(x_fit, y_all[fit_idx, column])
        classical[:, column] = logistic.predict_proba(x_test)[:, 1]
        coefficients[case] = {
            "intercept": round(float(logistic.intercept_[0]), 7),
            "weights": [round(float(value), 7) for value in logistic.coef_[0]],
        }

    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    network = nn.Sequential(nn.Linear(len(FEATURES), 32), nn.ReLU(), nn.Linear(32, 32), nn.ReLU(), nn.Linear(32, len(CASE_IDS))).to(device)
    fit_x = torch.tensor(x_fit, dtype=torch.float32, device=device)
    fit_y = torch.tensor(y_all[fit_idx], dtype=torch.float32, device=device)
    val_x = torch.tensor(x_validation, dtype=torch.float32, device=device)
    val_y = torch.tensor(y_all[validation_idx], dtype=torch.float32, device=device)
    optimizer = torch.optim.AdamW(network.parameters(), lr=0.002, weight_decay=0.0001)
    criterion = nn.BCEWithLogitsLoss()
    best_loss, best_state, best_epoch, stale = float("inf"), None, 0, 0
    for epoch in range(1, 61):
        network.train()
        order = torch.randperm(len(fit_x), device=device)
        for indices in order.split(4096):
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(network(fit_x[indices]), fit_y[indices])
            loss.backward()
            optimizer.step()
        network.eval()
        with torch.no_grad():
            validation_loss = float(criterion(network(val_x), val_y).item())
        if validation_loss < best_loss - 1e-5:
            best_loss, best_epoch, stale = validation_loss, epoch, 0
            best_state = {name: value.detach().cpu().clone() for name, value in network.state_dict().items()}
        else:
            stale += 1
        if stale >= 8:
            break
    assert best_state is not None
    network.load_state_dict(best_state)
    network.eval()
    with torch.no_grad():
        logits = network(torch.tensor(x_test, dtype=torch.float32, device=device))
        neural = torch.sigmoid(logits).cpu().numpy()
    torch.save({"state_dict": best_state, "features": FEATURES, "scaler_mean": scaler.mean_, "scaler_scale": scaler.scale_, "seed": seed}, model_dir / "particle_mlp.pt")
    torch.onnx.export(
        network.cpu(), torch.zeros((1, len(FEATURES)), dtype=torch.float32),
        model_dir / "particle_mlp.onnx", input_names=["features"], output_names=["logits"],
        dynamic_axes={"features": {0: "batch"}, "logits": {0: "batch"}}, opset_version=17, dynamo=False,
    )
    models = {"published_reference": published, "l1_logistic": classical, "particle_mlp": neural}
    cases = []
    for column, case in enumerate(CASE_IDS):
        comparable = np.isfinite(oracle[:, column]) & np.isfinite(published[:, column])
        if comparable.sum() < 1000:
            raise ValueError(f"Insufficient comparable test rows in constructed case {case}")
        case_oracle = oracle[comparable, column]
        cases.append({
            "case": case,
            "train_class_b": int(y_all[:, column].sum()),
            "test_rows": int(comparable.sum()),
            "excluded_test_rows": int(len(test) - comparable.sum()),
            "oracle_expected_b": round(float(case_oracle.sum()), 3),
            "models": {
                name: {
                    **_score(values[comparable, column], case_oracle),
                    "calibration": _calibration(values[comparable, column], case_oracle),
                    "thresholds": _thresholds(values[comparable, column], case_oracle),
                }
                for name, values in models.items()
            },
        })
    result = {
        "schema": SCHEMA,
        "source": {"doi": "10.14278/rodare.336", "url": SOURCE, "license": "CC BY 4.0", "sha256": hashlib.sha256(raw_file.read_bytes()).hexdigest()},
        "protocol": {
            "train_rows": len(train), "fit_rows": len(fit_idx), "validation_rows": len(validation_idx), "test_rows": len(test),
            "seed": seed, "features": list(FEATURES),
            "excluded_from_features": ["Probability 1–4", "Predicted probability 1–4", "Class 1–4", "Main mineral", "ECD2", "Mineral 1/2 modal", "Mineral 2 surface"],
            "target": "Class 1–4 label B in the published training sheet",
            "test_oracle": "Probability 1–4 in the published test sheet; constructed probability, not observed recovery",
            "missingness": "Case 4 has missing oracle/reference probabilities; all model comparisons use their common finite test rows and expose the excluded count",
            "published_reference": "Predicted probability 1–4 supplied by the source authors; not refitted here",
            "split": "Original published Train data / Test data sheets; 15% of Train data reserved for early stopping",
            "device": device, "torch_version": torch.__version__, "mlp_best_epoch": best_epoch,
            "mlp_validation_bce": round(best_loss, 7),
            "metric": "RMSE, MAE and bias between predicted and constructed oracle probability",
            "threshold_interpretation": "Expected Class B capture under the constructed oracle, not metallurgical recovery",
        },
        "standardization": {"mean": [round(float(v), 8) for v in scaler.mean_], "scale": [round(float(v), 8) for v in scaler.scale_]},
        "logistic_coefficients": coefficients,
        "cases": cases,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    return result
