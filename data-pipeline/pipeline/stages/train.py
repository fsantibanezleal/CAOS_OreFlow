"""Stage 3: train classical, probabilistic and neural surrogate tiers offline."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import numpy as np

from ..io.formats import write_json
from .feature_extraction import vector


def _scores(y: np.ndarray, pred: np.ndarray) -> dict[str, float]:
    rmse = float(np.sqrt(np.mean((pred - y) ** 2)))
    ss = float(np.sum((y - y.mean()) ** 2))
    return {"rmse_pct_points": round(rmse, 6), "r2": round(1 - float(np.sum((pred - y) ** 2)) / ss if ss else 0.0, 6)}


class _TorchPredictor:
    def __init__(self, model, scaler, torch_module):
        self.model, self.scaler, self.torch = model, scaler, torch_module

    def predict(self, x: np.ndarray) -> np.ndarray:
        with self.torch.no_grad():
            tx = self.torch.tensor(self.scaler.transform(x), dtype=self.torch.float32, device=next(self.model.parameters()).device)
            return self.model(tx).detach().cpu().numpy().reshape(-1)


def _train_torch(x_train, y_train, scaler, models_dir: Path, seed: int) -> tuple[Any, dict[str, Any]]:
    import torch
    torch.manual_seed(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = torch.nn.Sequential(torch.nn.Linear(x_train.shape[1], 32), torch.nn.SiLU(), torch.nn.Linear(32, 16), torch.nn.SiLU(), torch.nn.Linear(16, 1)).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=0.008, weight_decay=1e-4)
    x = torch.tensor(scaler.transform(x_train), dtype=torch.float32, device=device)
    y = torch.tensor(y_train.reshape(-1, 1), dtype=torch.float32, device=device)
    best = float("inf")
    best_state = None
    for epoch in range(1, 161):
        opt.zero_grad(set_to_none=True)
        loss = torch.mean((model(x) - y) ** 2)
        loss.backward()
        opt.step()
        loss_value = float(loss.detach())
        if loss_value < best:
            best = loss_value
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    if best_state:
        model.load_state_dict(best_state)
    onnx_path = models_dir / "mlp.onnx"
    try:
        dummy = torch.zeros((1, x_train.shape[1]), dtype=torch.float32, device=device)
        torch.onnx.export(model, dummy, onnx_path, input_names=["features"], output_names=["recovery_pct"], opset_version=17, dynamo=False)
        onnx = True
    except Exception:
        onnx = False
    return _TorchPredictor(model, scaler, torch), {"method_id": "mlp", "device": str(device), "epochs": 160, "onnx": onnx,
                                                    "parameters": sum(p.numel() for p in model.parameters()), "path": "models/mlp.onnx" if onnx else None}


def _train_autoencoder(x_train: np.ndarray, scaler, models_dir: Path, seed: int) -> tuple[Any, dict[str, Any]]:
    import torch
    torch.manual_seed(seed + 17)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dim = x_train.shape[1]
    model = torch.nn.Sequential(torch.nn.Linear(dim, 12), torch.nn.Tanh(), torch.nn.Linear(12, 5), torch.nn.Tanh(), torch.nn.Linear(5, 12), torch.nn.Tanh(), torch.nn.Linear(12, dim)).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=0.008)
    x = torch.tensor(scaler.transform(x_train), dtype=torch.float32, device=device)
    for _ in range(100):
        opt.zero_grad(set_to_none=True)
        loss = torch.mean((model(x) - x) ** 2)
        loss.backward()
        opt.step()
    onnx_path = models_dir / "autoencoder.onnx"
    onnx = False
    try:
        torch.onnx.export(model, torch.zeros((1, dim), dtype=torch.float32, device=device), onnx_path, input_names=["features"], output_names=["reconstruction"], opset_version=17, dynamo=False)
        onnx = True
    except Exception:
        pass
    class AE:
        def predict(self, x_new):
            with torch.no_grad():
                tx = torch.tensor(scaler.transform(x_new), dtype=torch.float32, device=device)
                return torch.mean((model(tx) - tx) ** 2, dim=1).cpu().numpy()
    return AE(), {"method_id": "autoencoder", "device": str(device), "epochs": 100, "onnx": onnx,
                  "parameters": sum(p.numel() for p in model.parameters()), "path": "models/autoencoder.onnx" if onnx else None}


def run(dataset: dict[str, Any], models_dir: str | Path, seed: int = 42) -> dict[str, Any]:
    started = time.perf_counter()
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import ConstantKernel, Matern, WhiteKernel
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler
    import joblib

    models = Path(models_dir)
    models.mkdir(parents=True, exist_ok=True)
    rows = dataset["rows"]
    x = np.array([r["x"] for r in rows], dtype=np.float64)
    y = np.array([r["target_recovery"] for r in rows], dtype=np.float64)
    n_train = dataset["splits"]["train"]
    n_val = dataset["splits"]["validation"]
    x_train, y_train = x[:n_train], y[:n_train]
    x_test, y_test = x[n_train + n_val:], y[n_train + n_val:]
    scaler = StandardScaler().fit(x_train)
    xs_train = scaler.transform(x_train)
    xs_test = scaler.transform(x_test)
    joblib.dump(scaler, models / "scaler.joblib")
    predictors: dict[str, Any] = {}
    records: list[dict[str, Any]] = []

    classical = {
        "ridge": Ridge(alpha=0.7).fit(xs_train, y_train),
        "random_forest": RandomForestRegressor(n_estimators=96, max_depth=10, min_samples_leaf=3, random_state=seed, n_jobs=-1).fit(xs_train, y_train),
        "hist_gradient_boosting": GradientBoostingRegressor(n_estimators=100, max_depth=3, learning_rate=0.04, random_state=seed, loss="huber").fit(xs_train, y_train),
        "gaussian_process": GaussianProcessRegressor(kernel=ConstantKernel(1.0) * Matern(length_scale=1.0, nu=1.5) + WhiteKernel(0.2), normalize_y=True, random_state=seed, n_restarts_optimizer=0).fit(xs_train[:240], y_train[:240]),
    }
    for name, model in classical.items():
        predictors[name] = model
        joblib.dump(model, models / f"{name}.joblib")
        pred = model.predict(xs_test)
        scores = _scores(y_test, pred)
        records.append({"method_id": name, "family": "learned", "backend": "scikit-learn", **scores})

    try:
        mlp, mlp_meta = _train_torch(x_train, y_train, scaler, models, seed)
        ae, ae_meta = _train_autoencoder(x_train, scaler, models, seed)
        predictors["mlp"], predictors["autoencoder"] = mlp, ae
        records.extend([{**mlp_meta, "family": "frontier", **_scores(y_test, mlp.predict(x_test))}, {**ae_meta, "family": "frontier", "reconstruction_rmse": round(float(np.sqrt(np.mean(ae.predict(x_test)))), 6)}])
    except ImportError:
        records.extend([{"method_id": "mlp", "family": "frontier", "backend": "unavailable", "status": "install requirements-gpu.txt"}, {"method_id": "autoencoder", "family": "frontier", "backend": "unavailable", "status": "install requirements-gpu.txt"}])

    registry = {"schema": "oreflow.models/v1", "seed": seed, "feature_names": dataset["feature_names"],
                "training_rows": len(x_train), "validation_rows": n_val, "test_rows": len(x_test),
                "elapsed_seconds": round(time.perf_counter() - started, 4), "models": records,
                "compute": {"torch": records[-2].get("device", "not-run") if records else "not-run"}}
    write_json(models / "registry.json", registry)
    return {"registry": registry, "predictors": predictors, "scaler": scaler}


def predict_bundle(bundle: dict[str, Any], params) -> dict[str, float]:
    x = vector(params).reshape(1, -1)
    xs = bundle["scaler"].transform(x)
    out: dict[str, float] = {}
    for name, model in bundle["predictors"].items():
        pred = model.predict(x if name in {"mlp", "autoencoder"} else xs)
        out[name] = float(np.asarray(pred).reshape(-1)[0])
    return out
