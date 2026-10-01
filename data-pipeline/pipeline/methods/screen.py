"""The surrogate screen of the optimizer's search step (OP-05, OP-06).

The surrogate management framework (Booker et al. 1999, doi:10.1007/BF01197708) lets a pattern search spend
engine evaluations where a cheap model expects progress: the search step may use any model, and the poll keeps the
method's guarantees. OreFlow's model is the learned lane's deployable surrogate, trusted only where two checks
agree that the state lies inside what the lane learned:

- the autoencoder guard accepts the state's features (reconstruction error at or below its threshold);
- the Gaussian process's 95% half-width on recovery is at most ``optimization.screen_half_width_pct``.

Both languages run the same arithmetic in float64: the networks from their exported ONNX weights (a Gemm and
SiLU network, and a Gemm and tanh autoencoder), and the Gaussian process from its training rows, its kernel
hyperparameters, ``alpha = K^-1 y`` and the lower Cholesky factor of ``K`` (Rasmussen and Williams 2006, algorithm
2.1). The browser's onnxruntime-web runs the networks in float32, which the learned-lane view keeps; the screen does
not, because a float32 difference between runtimes can reorder two candidates on a fine mesh and send the two
searches along different paths.

The export (``export``) is written by the learning stage beside the ONNX files and checked there: the networks
against ONNX Runtime within the lane's ONNX tolerance, the Gaussian process against scikit-learn's
``predict(return_std=True)`` within ``learning.gp_export_tolerance``.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from ..engine.constants import constant

SCREEN_FILE = "process_screen.json"
CHOLESKY_FILE = "process_gp_cholesky.bin"
GP_TARGET = "recovery_pct"


def _layers(path: Path) -> list[dict[str, Any]]:
    """The dense layers of an exported network, in graph order: weight (out x in), bias, activation after it."""
    import onnx
    from onnx import numpy_helper

    model = onnx.load(str(path))
    init = {i.name: numpy_helper.to_array(i) for i in model.graph.initializer}
    layers: list[dict[str, Any]] = []
    for node in model.graph.node:
        if node.op_type == "Gemm":
            attrs = {a.name: onnx.helper.get_attribute_value(a) for a in node.attribute}
            if attrs.get("transB", 0) != 1 or attrs.get("alpha", 1.0) != 1.0 or attrs.get("beta", 1.0) != 1.0 or attrs.get("transA", 0) != 0:
                raise ValueError(f"{path.name}: unexpected Gemm attributes {attrs}")
            layers.append({"weight": init[node.input[1]].astype(np.float64).tolist(),
                           "bias": init[node.input[2]].astype(np.float64).tolist(), "activation": None})
        elif node.op_type == "Tanh":
            layers[-1]["activation"] = "tanh"
        elif node.op_type == "Sigmoid":
            layers[-1]["activation"] = "silu"      # Sigmoid then Mul by its input: SiLU
        elif node.op_type != "Mul":
            raise ValueError(f"{path.name}: unexpected operator {node.op_type}")
    return layers


def export(models_dir: Path, x: np.ndarray, y: np.ndarray, targets: tuple[str, ...], feature_mean: np.ndarray,
           feature_scale: np.ndarray, s: dict[str, Any], seed: int) -> dict[str, Any]:
    """Fit the screen's Gaussian process on the design, export it with the network weights, and check both."""
    import warnings

    import onnxruntime
    from sklearn.exceptions import ConvergenceWarning
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel

    j = targets.index(GP_TARGET)
    rng = np.random.default_rng(seed)
    rows = np.arange(len(x)) if len(x) <= int(s["gp_training_rows"]) else np.sort(rng.choice(len(x), int(s["gp_training_rows"]), replace=False))
    xs = (x - feature_mean) / feature_scale
    low, high = (float(v) for v in s["gp_length_scale_bounds"])
    kernel = (ConstantKernel(1.0) * RBF(length_scale=np.ones(x.shape[1]), length_scale_bounds=(low, high))
              + WhiteKernel(float(s["gp_noise_initial"]), noise_level_bounds=tuple(float(v) for v in s["gp_noise_bounds"])))
    gp = GaussianProcessRegressor(kernel=kernel, normalize_y=True, n_restarts_optimizer=int(s["gp_restarts"]), random_state=seed)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", ConvergenceWarning)
        gp.fit(xs[rows], y[rows, j])
    n = len(rows)
    lower = np.asarray(gp.L_, dtype="<f8")
    packed = np.concatenate([lower[i, : i + 1] for i in range(n)])
    (models_dir / CHOLESKY_FILE).write_bytes(packed.tobytes())
    document = {
        "schema": "oreflow.screen/v1",
        "networks": {"surrogate": _layers(models_dir / "process_surrogate.onnx"), "guard": _layers(models_dir / "process_guard.onnx")},
        "gp": {
            "target": GP_TARGET, "rows": n, "amplitude": float(gp.kernel_.k1.k1.constant_value),
            "length_scales": [float(v) for v in np.atleast_1d(gp.kernel_.k1.k2.length_scale)],
            "noise_level": float(gp.kernel_.k2.noise_level), "y_mean": float(np.atleast_1d(gp._y_train_mean)[0]),
            "y_std": float(np.atleast_1d(gp._y_train_std)[0]), "interval_z": float(s["interval_z"]),
            "training": gp.X_train_.tolist(), "alpha": [float(v) for v in np.ravel(gp.alpha_)],
            "cholesky": {"file": CHOLESKY_FILE, "packing": "lower triangle by rows, float64 little-endian", "values": int(packed.size)},
            "kernel": str(gp.kernel_), "optimizer_notes": len([w for w in caught if issubclass(w.category, ConvergenceWarning)]),
        },
    }
    (models_dir / SCREEN_FILE).write_text(json.dumps(document) + "\n", encoding="utf-8", newline="\n")

    # the checks: this module's float64 arithmetic against the libraries that produced the models
    screen = Screen(models_dir)
    check = xs[: min(len(xs), 256)]
    mean, std = gp.predict(check, return_std=True)
    mine = np.asarray([screen.gp(row) for row in check])
    gp_difference = float(max(np.max(np.abs(mine[:, 0] - mean)), np.max(np.abs(mine[:, 1] - std))))
    if gp_difference > float(constant("learning.gp_export_tolerance")):
        raise AssertionError(f"screen Gaussian process differs from scikit-learn by {gp_difference}")
    scalers = json.loads((models_dir / "process_surrogate.json").read_text(encoding="utf-8"))
    tolerance = float(s["onnx_tolerance"])
    session = onnxruntime.InferenceSession(str(models_dir / "process_surrogate.onnx"), providers=["CPUExecutionProvider"])
    ort_out = session.run(None, {"features": check.astype(np.float32)})[0].astype(np.float64)
    surrogate_difference = float(np.max(np.abs(np.asarray([screen.forward("surrogate", row) for row in check]) - ort_out)))
    gs = (x[: len(check)] - np.asarray(scalers["guard_feature_mean"])) / np.asarray(scalers["guard_feature_scale"])
    guard_session = onnxruntime.InferenceSession(str(models_dir / "process_guard.onnx"), providers=["CPUExecutionProvider"])
    guard_out = guard_session.run(None, {"features": gs.astype(np.float32)})[0].astype(np.float64)
    guard_difference = float(np.max(np.abs(np.asarray([screen.forward("guard", row) for row in gs]) - guard_out)))
    if max(surrogate_difference, guard_difference) > tolerance:
        raise AssertionError(f"screen networks differ from ONNX Runtime by {surrogate_difference} and {guard_difference}")
    write_reference(models_dir)
    # the learning record's export entry: path, size and the networks' largest difference, as for the ONNX files
    return {"path": SCREEN_FILE, "bytes": (models_dir / SCREEN_FILE).stat().st_size,
            "max_abs_difference": max(surrogate_difference, guard_difference),
            "cholesky": {"path": CHOLESKY_FILE, "bytes": (models_dir / CHOLESKY_FILE).stat().st_size},
            "gp_rows": n, "gp_kernel": str(gp.kernel_), "gp_max_abs_difference": gp_difference,
            "surrogate_max_abs_difference": surrogate_difference, "guard_max_abs_difference": guard_difference,
            "check_rows": int(len(check))}


def write_reference(models_dir: Path) -> None:
    """The screen's view of every case's nominal state, written into the export so the browser's port of this
    module (``frontend/src/learning/screen.ts``) is checked against it end to end."""
    from ..cases.catalog import CASES
    from .learning import _ore_factors, features

    path = Path(models_dir) / SCREEN_FILE
    document = json.loads(path.read_text(encoding="utf-8"))
    document.pop("reference", None)
    path.write_text(json.dumps(document) + "\n", encoding="utf-8", newline="\n")
    screen = Screen(models_dir)
    reference = []
    for case in CASES:
        x = features(case, case.nominal, {name: 1.0 for name in _ore_factors(case)})
        reference.append({"case_id": case.id, "features": x, **screen.judge(x)})
    document["reference"] = reference
    path.write_text(json.dumps(document) + "\n", encoding="utf-8", newline="\n")


class Screen:
    """The exported surrogate, guard and Gaussian process, evaluated in float64."""

    def __init__(self, models_dir: Path) -> None:
        doc = json.loads((Path(models_dir) / SCREEN_FILE).read_text(encoding="utf-8"))
        scalers = json.loads((Path(models_dir) / "process_surrogate.json").read_text(encoding="utf-8"))
        self.networks = {name: [(np.asarray(layer["weight"]), np.asarray(layer["bias"]), layer["activation"]) for layer in layers]
                         for name, layers in doc["networks"].items()}
        g = doc["gp"]
        self.amplitude, self.noise, self.y_mean, self.y_std, self.z = g["amplitude"], g["noise_level"], g["y_mean"], g["y_std"], g["interval_z"]
        self.length = np.asarray(g["length_scales"])
        self.scaled = np.asarray(g["training"]) / self.length
        self.alpha = np.asarray(g["alpha"])
        packed = np.frombuffer((Path(models_dir) / g["cholesky"]["file"]).read_bytes(), dtype="<f8")
        n = g["rows"]
        self.lower = np.zeros((n, n))
        self.lower[np.tril_indices(n)] = packed
        self.targets = tuple(scalers["targets"])
        self.feature_mean, self.feature_scale = np.asarray(scalers["feature_mean"]), np.asarray(scalers["feature_scale"])
        self.target_mean, self.target_scale = np.asarray(scalers["target_mean"]), np.asarray(scalers["target_scale"])
        self.guard_mean, self.guard_scale = np.asarray(scalers["guard_feature_mean"]), np.asarray(scalers["guard_feature_scale"])
        self.guard_threshold = float(scalers["guard_threshold"])

    def forward(self, name: str, x: np.ndarray) -> np.ndarray:
        h = np.asarray(x, dtype=float)
        for weight, bias, activation in self.networks[name]:
            h = weight @ h + bias
            if activation == "silu":
                h = h / (1.0 + np.exp(-h))
            elif activation == "tanh":
                h = np.tanh(h)
        return h

    def gp(self, xs: np.ndarray) -> tuple[float, float]:
        """Mean and standard deviation of the GP's target at one standardized state."""
        from scipy.linalg import solve_triangular

        d = ((np.asarray(xs) / self.length - self.scaled) ** 2).sum(axis=1)
        k = self.amplitude * np.exp(-0.5 * d)
        mean = float(k @ self.alpha) * self.y_std + self.y_mean
        v = solve_triangular(self.lower, k, lower=True, check_finite=False)
        variance = max(0.0, self.amplitude + self.noise - float(v @ v))
        return mean, float(np.sqrt(variance)) * self.y_std

    def judge(self, x: list[float]) -> dict[str, Any]:
        """The screen's view of one state: the surrogate's targets, the guard error and the GP half-width."""
        x = np.asarray(x, dtype=float)
        standardized = (x - self.feature_mean) / self.feature_scale
        prediction = self.forward("surrogate", standardized) * self.target_scale + self.target_mean
        g = (x - self.guard_mean) / self.guard_scale
        guard_error = float(np.mean((self.forward("guard", g) - g) ** 2))
        _, std = self.gp(standardized)
        return {"prediction": dict(zip(self.targets, (float(v) for v in prediction))), "guard_error": guard_error,
                "half_width": self.z * std}
