"""Learned lane: surrogates of the process engine, evaluated for interpolation and for transfer (PE-29).

Design. For every case, a seeded scrambled Sobol design covers its Contract 1 envelope (the case's
applicable operating inputs within their resolved bounds) and two ore properties (liberation-size and
floatability factors within the uncertainty half-widths; liberation only for magnetite). A state
that breaks a contract rule is skipped. The engine simulates every state.

Features are physical properties and controls computed before simulation, never the case identity,
so leave-one-case-out measures transfer to an unseen ore and plant: the payable fraction, the
throughput per installed megawatt, the grind, circulating load, water, crusher setting and work
index, the share-weighted liberation size, composite content, density, floatability and
dose-to-half-dose ratio of the payable's carriers, the rougher gas velocity, cells and volume per
t/h, the gravity bleed, the desliming cut and four circuit descriptors. Targets are the overall
recovery (%), the log10 upgrade ratio (concentrate over head grade, unit-free across payables) and
the total specific energy (kWh/t).

Protocols. Interpolation: a seeded 80/20 split inside every case. Leave-one-case-out: each case held
out in turn; its states never train the models that predict it.

Models. Ridge (the linear reference), random forest (Breiman 2001, doi:10.1023/A:1010933404324),
scikit-learn's HistGradientBoostingRegressor, a Gaussian process with an ARD squared-exponential
kernel (Rasmussen and Williams 2006) whose 95% intervals are checked for coverage, and a PyTorch
MLP that stops on validation loss (CUDA when available). An autoencoder trained on the training
features guards against out-of-envelope states: its threshold is the 99th percentile of the
validation reconstruction error, and the record reports the false-alarm rate on held-out in-envelope
states and the false-accept rate on states pushed outside the training range. Permutation importance
explains the gradient-boosting surrogate. The final MLP and autoencoder are trained on every state
and exported to ONNX, with an ONNX Runtime check against PyTorch.
"""
from __future__ import annotations

import json
import time
import warnings
from dataclasses import replace
from pathlib import Path
from typing import Any

import numpy as np
from scipy.stats import qmc

from ..cases.catalog import CASES, CaseDef
from ..engine.circuit import simulate
from ..engine.constants import constant
from ..engine.model import OperatingPoint
from ..engine.ore import grade_to_fraction, resolve
from ..io.contract import validate

FEATURES = (
    "log_payable_fraction", "specific_throughput_t_h_mw", "target_p80_um", "circulating_load", "water_m3_t",
    "crusher_css_mm", "work_index_kwh_t", "carrier_liberation_um", "grind_to_liberation", "carrier_composite_content",
    "carrier_density_t_m3", "carrier_floatability", "dose_ratio", "jg_cm_s", "rougher_cells", "rougher_volume_m3_per_tph",
    "gravity_bleed", "deslime_cut_um", "has_flotation", "has_gravity", "has_magnetic", "has_desliming",
)
BINARY = ("has_flotation", "has_gravity", "has_magnetic", "has_desliming")
TARGETS = ("recovery_pct", "log_upgrade", "specific_energy_total_kwh_t")
MODELS = ("ridge", "random_forest", "hist_gradient_boosting", "gaussian_process", "mlp")


def settings(**overrides: Any) -> dict[str, Any]:
    """Declared learning settings; tests pass smaller values for a sandbox design."""
    keys = ("design_points_per_case", "seed", "test_fraction", "validation_fraction", "ridge_alpha", "forest_trees",
            "forest_min_leaf", "hgb_iterations", "hgb_learning_rate", "gp_training_rows", "gp_restarts", "interval_z",
            "mlp_hidden", "mlp_learning_rate", "mlp_weight_decay", "max_epochs", "patience", "autoencoder_hidden",
            "guard_quantile", "ood_shift", "permutation_repeats", "onnx_tolerance", "gp_noise_initial", "gp_noise_bounds",
            "gp_length_scale_bounds", "gp_bound_margin")
    out = {k: constant(f"learning.{k}") for k in keys}
    out["device"] = "auto"
    out.update(overrides)
    return out


# ---- design and features ----

def _ore_factors(case: CaseDef) -> tuple[str, ...]:
    return ("liberation_size", "floatability") if case.plant.flotation is not None else ("liberation_size",)


def design_states(case: CaseDef, contract: dict[str, Any], count: int, seed: int) -> list[dict[str, Any]]:
    inputs = contract["cases"][case.id]["inputs"]
    names = list(inputs)
    factors = _ore_factors(case)
    widths = constant("uncertainty.half_widths")
    sampler = qmc.Sobol(d=len(names) + len(factors), scramble=True, rng=np.random.default_rng(seed))
    states: list[dict[str, Any]] = []
    batch = 2 ** int(np.ceil(np.log2(max(count, 2))))
    while len(states) < count:
        # each batch doubles the drawn total, which stays a power of two (Sobol balance)
        for row in sampler.random(batch):
            values = {}
            for name, u in zip(names, row[:len(names)]):
                lo, hi = inputs[name]["min"], inputs[name]["max"]
                v = lo + float(u) * (hi - lo)
                values[name] = int(round(v)) if isinstance(lo, int) else v
            verdict = validate(contract, case.id, values)
            if not verdict["accepted"]:
                continue
            ore = {f: 1.0 - float(widths[f]) + 2.0 * float(widths[f]) * float(u) for f, u in zip(factors, row[len(names):])}
            states.append({"point": verdict["point"], "factors": ore})
            if len(states) == count:
                break
    return states


def _perturbed_ore(case: CaseDef, factors: dict[str, float]):
    minerals = []
    for mineral in case.ore.minerals:
        if mineral.liberation_size_um > 0.0:
            flotation = mineral.flotation
            if flotation is not None and "floatability" in factors:
                flotation = replace(flotation, floatability=flotation.floatability * factors["floatability"])
            mineral = replace(mineral, liberation_size_um=mineral.liberation_size_um * factors["liberation_size"],
                              flotation=flotation)
        minerals.append(mineral)
    return replace(case.ore, minerals=tuple(minerals))


def features(case: CaseDef, point: OperatingPoint, factors: dict[str, float]) -> list[float]:
    """The physical feature vector of one state, in FEATURES order (no simulation, no case identity)."""
    ore = _perturbed_ore(case, factors)
    resolved = resolve(ore, point)
    payable = ore.payables[0]
    spec = {m.id: m for m in ore.minerals}
    carriers = [(c.mineral, c.share) for c in payable.carriers if spec[c.mineral].liberation_size_um > 0.0]
    total = sum(share for _, share in carriers)

    def weighted(fn) -> float:
        return sum(share * fn(spec[m]) for m, share in carriers) / total

    liberation = weighted(lambda s: s.liberation_size_um)
    plant = case.plant
    flot = plant.flotation
    has_flotation = flot is not None
    floatability = weighted(lambda s: s.flotation.floatability if s.flotation else 0.0) if has_flotation else 0.0
    half_dose = weighted(lambda s: s.flotation.half_dose_gpt if s.flotation else 0.0) if has_flotation else 0.0
    values = {
        "log_payable_fraction": float(np.log10(grade_to_fraction(point.head_grade, payable.unit))),
        "specific_throughput_t_h_mw": point.throughput_tph / (plant.mill.installed_power_kw / float(constant("units.kw_per_mw"))),
        "target_p80_um": point.target_p80_um,
        "circulating_load": point.circulating_load,
        "water_m3_t": point.water_m3_t,
        "crusher_css_mm": point.crusher_css_mm,
        "work_index_kwh_t": point.work_index_kwh_t,
        "carrier_liberation_um": liberation,
        "grind_to_liberation": point.target_p80_um / liberation,
        "carrier_composite_content": weighted(lambda s: s.composite_content),
        "carrier_density_t_m3": weighted(lambda s: resolved.density[s.id]),
        "carrier_floatability": floatability,
        "dose_ratio": point.collector_gpt / half_dose if half_dose > 0.0 else 0.0,
        "jg_cm_s": point.jg_cm_s if has_flotation else 0.0,
        "rougher_cells": float(point.rougher_cells) if has_flotation else 0.0,
        "rougher_volume_m3_per_tph": (flot.rougher.cell_volume_m3 * point.rougher_cells / point.throughput_tph) if has_flotation else 0.0,
        "gravity_bleed": point.gravity_bleed if plant.gravity is not None else 0.0,
        "deslime_cut_um": point.deslime_cut_um if plant.deslime is not None else 0.0,
        "has_flotation": 1.0 if has_flotation else 0.0,
        "has_gravity": 1.0 if plant.gravity is not None else 0.0,
        "has_magnetic": 1.0 if plant.magnetic is not None else 0.0,
        "has_desliming": 1.0 if plant.deslime is not None else 0.0,
    }
    return [float(values[name]) for name in FEATURES]


def targets(metrics: dict[str, float]) -> list[float]:
    return [metrics["recovery_pct"], float(np.log10(metrics["concentrate_grade"] / metrics["head_grade"])),
            metrics["specific_energy_total_kwh_t"]]


def build_design(contract: dict[str, Any], cases: tuple[CaseDef, ...] = CASES, per_case: int | None = None,
                 seed: int | None = None) -> dict[str, Any]:
    s = settings()
    per_case = int(s["design_points_per_case"]) if per_case is None else per_case
    seed = int(s["seed"]) if seed is None else seed
    x, y, case_of, points = [], [], [], []
    started = time.perf_counter()
    for index, case in enumerate(cases):
        for state in design_states(case, contract, per_case, seed + index):
            point = OperatingPoint(**state["point"])
            ore = _perturbed_ore(case, state["factors"])
            metrics = simulate(ore, case.plant, point).metrics
            x.append(features(case, point, state["factors"]))
            y.append(targets(metrics))
            case_of.append(case.id)
            points.append({"point": state["point"], "factors": state["factors"]})
    return {"x": np.asarray(x), "y": np.asarray(y), "case": np.asarray(case_of), "states": points,
            "per_case": per_case, "seed": seed, "seconds": time.perf_counter() - started}


# ---- protocols ----

def interpolation_split(case_of: np.ndarray, test_fraction: float, seed: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    train, test = [], []
    for case_id in dict.fromkeys(case_of.tolist()):
        rows = np.flatnonzero(case_of == case_id)
        rows = rows[rng.permutation(len(rows))]
        cut = int(round(test_fraction * len(rows)))
        test.extend(rows[:cut].tolist())
        train.extend(rows[cut:].tolist())
    return np.asarray(sorted(train)), np.asarray(sorted(test))


def leave_one_case_out(case_of: np.ndarray) -> list[tuple[str, np.ndarray, np.ndarray]]:
    return [(case_id, np.flatnonzero(case_of != case_id), np.flatnonzero(case_of == case_id))
            for case_id in dict.fromkeys(case_of.tolist())]


# ---- models ----

def _scores(y: np.ndarray, pred: np.ndarray) -> dict[str, float]:
    err = pred - y
    ss = float(np.sum((y - np.mean(y)) ** 2))
    return {"rmse": float(np.sqrt(np.mean(err ** 2))), "mae": float(np.mean(np.abs(err))),
            "r2": 1.0 - float(np.sum(err ** 2)) / ss if ss > 0.0 else 0.0, "rows": int(len(y))}


def _torch_device(requested: str):
    import torch

    if requested == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device(requested)


def _train_network(x: np.ndarray, y: np.ndarray, hidden: list[int], s: dict[str, Any], seed: int, activation: str):
    """Full-batch Adam with validation-based early stopping; the best validation weights are restored."""
    import torch

    device = _torch_device(s["device"])
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    order = rng.permutation(len(x))
    n_val = max(1, int(round(float(s["validation_fraction"]) * len(x))))
    val, fit = order[:n_val], order[n_val:]
    act = {"silu": torch.nn.SiLU, "tanh": torch.nn.Tanh}[activation]
    layers: list[Any] = []
    width = x.shape[1]
    for h in hidden:
        layers += [torch.nn.Linear(width, h), act()]
        width = h
    layers.append(torch.nn.Linear(width, y.shape[1]))
    model = torch.nn.Sequential(*layers).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=float(s["mlp_learning_rate"]), weight_decay=float(s["mlp_weight_decay"]))
    xt = torch.tensor(x, dtype=torch.float32, device=device)
    yt = torch.tensor(y, dtype=torch.float32, device=device)
    fit_t, val_t = torch.tensor(fit, device=device), torch.tensor(val, device=device)
    best, best_epoch, best_state, history = float("inf"), 0, None, []
    patience, epochs = int(s["patience"]), int(s["max_epochs"])
    epoch = 0
    for epoch in range(1, epochs + 1):
        model.train()
        opt.zero_grad(set_to_none=True)
        loss = torch.mean((model(xt[fit_t]) - yt[fit_t]) ** 2)
        loss.backward()
        opt.step()
        model.eval()
        with torch.no_grad():
            v = float(torch.mean((model(xt[val_t]) - yt[val_t]) ** 2))
        history.append(v)
        if v < best:
            best, best_epoch = v, epoch
            best_state = {k: t.detach().clone() for k, t in model.state_dict().items()}
        elif epoch - best_epoch >= patience:
            break
    model.load_state_dict(best_state)
    model.eval()
    info = {"device": str(device), "epochs_run": epoch, "best_epoch": best_epoch, "best_validation_mse": best,
            "stopped_early": epoch < epochs, "validation_rows": int(len(val)), "fit_rows": int(len(fit)),
            "validation_history": [history[i] for i in range(0, len(history), max(1, len(history) // 200))],
            "parameters": int(sum(p.numel() for p in model.parameters()))}
    return model, info, val


def _predict_network(model, x: np.ndarray) -> np.ndarray:
    import torch

    device = next(model.parameters()).device
    with torch.no_grad():
        return model(torch.tensor(x, dtype=torch.float32, device=device)).cpu().numpy().astype(np.float64)


class Standardizer:
    def __init__(self, data: np.ndarray) -> None:
        self.mean = data.mean(axis=0)
        scale = data.std(axis=0)
        self.scale = np.where(scale > 0.0, scale, 1.0)

    def __call__(self, data: np.ndarray) -> np.ndarray:
        return (data - self.mean) / self.scale

    def inverse(self, data: np.ndarray) -> np.ndarray:
        return data * self.scale + self.mean


def fit_and_score(x: np.ndarray, y: np.ndarray, train: np.ndarray, test: np.ndarray, s: dict[str, Any], seed: int) -> dict[str, Any]:
    """Train every model on ``train`` rows and score it on ``test`` rows, for every target."""
    from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
    from sklearn.exceptions import ConvergenceWarning
    from sklearn.gaussian_process import GaussianProcessRegressor
    from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel
    from sklearn.linear_model import Ridge

    fx = Standardizer(x[train])
    fy = Standardizer(y[train])
    xs_tr, xs_te = fx(x[train]), fx(x[test])
    out: dict[str, Any] = {"models": {}, "identity": {}}
    rng = np.random.default_rng(seed)
    gp_rows = train if len(train) <= int(s["gp_training_rows"]) else np.sort(rng.choice(train, int(s["gp_training_rows"]), replace=False))
    for j, target in enumerate(TARGETS):
        yt, ye = y[train, j], y[test, j]
        estimators = {
            "ridge": Ridge(alpha=float(s["ridge_alpha"])),
            "random_forest": RandomForestRegressor(n_estimators=int(s["forest_trees"]), min_samples_leaf=int(s["forest_min_leaf"]),
                                                   random_state=seed, n_jobs=-1),
            "hist_gradient_boosting": HistGradientBoostingRegressor(max_iter=int(s["hgb_iterations"]),
                                                                    learning_rate=float(s["hgb_learning_rate"]),
                                                                    early_stopping=False, random_state=seed),
        }
        for name, est in estimators.items():
            est.fit(xs_tr, yt)
            out["identity"][name] = f"{type(est).__module__}.{type(est).__name__}"
            out["models"].setdefault(name, {})[target] = _scores(ye, est.predict(xs_te))
            if name == "hist_gradient_boosting":
                out.setdefault("_hgb", {})[target] = est
        low, high = (float(v) for v in s["gp_length_scale_bounds"])
        kernel = (ConstantKernel(1.0) * RBF(length_scale=np.ones(x.shape[1]), length_scale_bounds=(low, high))
                  + WhiteKernel(float(s["gp_noise_initial"]), noise_level_bounds=tuple(float(v) for v in s["gp_noise_bounds"])))
        gp = GaussianProcessRegressor(kernel=kernel, normalize_y=True, n_restarts_optimizer=int(s["gp_restarts"]), random_state=seed)
        with warnings.catch_warnings(record=True) as caught:
            # a length scale at its upper bound is ARD switching a feature off, and a noise level at its
            # lower bound is a deterministic engine: both are results, recorded below, not failures
            warnings.simplefilter("always", ConvergenceWarning)
            gp.fit(fx(x[gp_rows]), y[gp_rows, j])
        scales = np.atleast_1d(gp.kernel_.k1.k2.length_scale)
        mean, std = gp.predict(xs_te, return_std=True)
        z = float(s["interval_z"])
        inside = np.abs(ye - mean) <= z * std
        out["identity"]["gaussian_process"] = f"{type(gp).__module__}.{type(gp).__name__}"
        out["models"].setdefault("gaussian_process", {})[target] = {
            **_scores(ye, mean), "coverage_95": float(np.mean(inside)), "mean_half_width": float(np.mean(z * std)),
            "training_rows": int(len(gp_rows)), "kernel": str(gp.kernel_),
            "length_scales": {name: float(v) for name, v in zip(FEATURES, scales)},
            "switched_off": [name for name, v in zip(FEATURES, scales) if v >= high * float(s["gp_bound_margin"])],
            "noise_level": float(gp.kernel_.k2.noise_level),
            "optimizer_notes": len([w for w in caught if issubclass(w.category, ConvergenceWarning)])}
    model, info, _ = _train_network(xs_tr, fy(y[train]), list(s["mlp_hidden"]), s, seed, "silu")
    pred = fy.inverse(_predict_network(model, xs_te))
    out["identity"]["mlp"] = f"torch.nn.Sequential ({info['device']})"
    for j, target in enumerate(TARGETS):
        out["models"].setdefault("mlp", {})[target] = _scores(y[test, j], pred[:, j])
    out["mlp_training"] = info
    return out


def guard(x: np.ndarray, train: np.ndarray, test: np.ndarray, s: dict[str, Any], seed: int) -> dict[str, Any]:
    """Autoencoder guard: threshold on validation reconstruction error, false alarms and false accepts."""
    fx = Standardizer(x[train])
    xs_tr = fx(x[train])
    # the threshold uses the rows held out from fitting (they only selected the best epoch)
    model, info, val = _train_network(xs_tr, xs_tr, list(s["autoencoder_hidden"]), s, seed + 1, "tanh")

    def errors(rows_std: np.ndarray) -> np.ndarray:
        return np.mean((_predict_network(model, rows_std) - rows_std) ** 2, axis=1)

    threshold = float(np.quantile(errors(xs_tr[val]), float(s["guard_quantile"])))
    in_env = errors(fx(x[test]))
    lo, hi = x[train].min(axis=0), x[train].max(axis=0)
    probes, labels = [], []
    for j, name in enumerate(FEATURES):
        if name in BINARY or hi[j] <= lo[j]:
            continue
        shifted = x[test].copy()
        shifted[:, j] = hi[j] + float(s["ood_shift"]) * (hi[j] - lo[j])
        probes.append(shifted)
        labels += [name] * len(shifted)
    probe_x = np.vstack(probes)
    probe_err = errors(fx(probe_x))
    labels_arr = np.asarray(labels)
    per_feature = {name: float(np.mean(probe_err[labels_arr == name] <= threshold)) for name in dict.fromkeys(labels)}
    return {"threshold": threshold, "false_alarm_rate": float(np.mean(in_env > threshold)),
            "false_accept_rate": float(np.mean(probe_err <= threshold)), "false_accept_by_feature": per_feature,
            "in_envelope_rows": int(len(test)), "probe_rows": int(len(probe_x)), "training": info,
            "_model": model, "_standardizer": fx}


def importance(hgb: dict[str, Any], x: np.ndarray, y: np.ndarray, test: np.ndarray, fx: Standardizer, s: dict[str, Any],
               seed: int) -> dict[str, dict[str, float]]:
    from sklearn.inspection import permutation_importance

    out = {}
    for j, target in enumerate(TARGETS):
        result = permutation_importance(hgb[target], fx(x[test]), y[test, j], n_repeats=int(s["permutation_repeats"]),
                                        random_state=seed, scoring="neg_root_mean_squared_error")
        out[target] = {name: float(v) for name, v in zip(FEATURES, result.importances_mean)}
    return out


# ---- export ----

def export_onnx(model, n_inputs: int, path: Path, input_name: str, output_name: str, check_rows: np.ndarray,
                tolerance: float) -> dict[str, Any]:
    import onnxruntime
    import torch

    cpu = model.to("cpu").eval()
    dummy = torch.zeros((1, n_inputs), dtype=torch.float32)
    path.parent.mkdir(parents=True, exist_ok=True)
    with warnings.catch_warnings():
        # torch is pinned at 2.12, where the TorchScript exporter still ships; it is deprecated in favour of
        # the torch.export path, which moves with a torch upgrade. The ONNX Runtime check below verifies the file.
        warnings.simplefilter("ignore", DeprecationWarning)
        torch.onnx.export(cpu, dummy, str(path), input_names=[input_name], output_names=[output_name],
                          dynamic_axes={input_name: {0: "rows"}, output_name: {0: "rows"}}, opset_version=17, dynamo=False)
    session = onnxruntime.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    ort_out = session.run(None, {input_name: check_rows.astype(np.float32)})[0]
    torch_out = _predict_network(cpu, check_rows)
    difference = float(np.max(np.abs(ort_out - torch_out)))
    if difference > tolerance:
        raise AssertionError(f"ONNX export of {path.name} differs from PyTorch by {difference}")
    return {"path": path.name, "bytes": path.stat().st_size, "max_abs_difference": difference, "opset": 17}


# ---- the lane ----

def run(contract: dict[str, Any], models_dir: Path, cases: tuple[CaseDef, ...] = CASES, **overrides: Any) -> dict[str, Any]:
    s = settings(**overrides)
    seed = int(s["seed"])
    started = time.perf_counter()
    design = build_design(contract, cases, int(s["design_points_per_case"]), seed)
    x, y, case_of = design["x"], design["y"], design["case"]
    train, test = interpolation_split(case_of, float(s["test_fraction"]), seed)
    interpolation = fit_and_score(x, y, train, test, s, seed)
    hgb = interpolation.pop("_hgb")
    fx = Standardizer(x[train])
    interpolation["permutation_importance"] = importance(hgb, x, y, test, fx, s, seed)
    guard_interp = guard(x, train, test, s, seed)
    folds = []
    for held_out, tr, te in leave_one_case_out(case_of):
        fold = fit_and_score(x, y, tr, te, s, seed)
        fold.pop("_hgb", None)
        g = guard(x, tr, te, s, seed)
        folds.append({"held_out": held_out, "train_rows": int(len(tr)), "test_rows": int(len(te)), "models": fold["models"],
                      "mlp_training": {k: v for k, v in fold["mlp_training"].items() if k != "validation_history"},
                      "held_out_flag_rate": float(g["false_alarm_rate"])})
    # the deployable surrogate and guard: every state trains them
    all_rows = np.arange(len(x))
    fx_all, fy_all = Standardizer(x), Standardizer(y)
    final_mlp, final_info, _ = _train_network(fx_all(x), fy_all(y), list(s["mlp_hidden"]), s, seed, "silu")
    final_guard = guard(x, all_rows, all_rows[:1], s, seed)
    tolerance = float(s["onnx_tolerance"])
    check = fx_all(x[: min(len(x), 64)])
    exports = {
        "surrogate": export_onnx(final_mlp, x.shape[1], models_dir / "process_surrogate.onnx", "features", "targets", check, tolerance),
        "guard": export_onnx(final_guard["_model"], x.shape[1], models_dir / "process_guard.onnx", "features", "reconstruction",
                             final_guard["_standardizer"](x[: min(len(x), 64)]), tolerance),
    }
    scalers = {"features": FEATURES, "targets": TARGETS, "feature_mean": fx_all.mean.tolist(), "feature_scale": fx_all.scale.tolist(),
               "target_mean": fy_all.mean.tolist(), "target_scale": fy_all.scale.tolist(),
               "guard_feature_mean": final_guard["_standardizer"].mean.tolist(),
               "guard_feature_scale": final_guard["_standardizer"].scale.tolist(), "guard_threshold": final_guard["threshold"]}
    (models_dir / "process_surrogate.json").write_text(json.dumps(scalers, indent=1) + "\n", encoding="utf-8", newline="\n")
    write_surrogate_reference(models_dir, cases)
    summary: dict[str, Any] = {}
    for model_name in MODELS:
        summary[model_name] = {}
        for target in TARGETS:
            pooled = [f["models"][model_name][target] for f in folds]
            summary[model_name][target] = {
                "interpolation_rmse": interpolation["models"][model_name][target]["rmse"],
                "interpolation_r2": interpolation["models"][model_name][target]["r2"],
                "loco_rmse_mean": float(np.mean([p["rmse"] for p in pooled])),
                "loco_rmse_max": float(np.max([p["rmse"] for p in pooled])),
                "loco_r2_median": float(np.median([p["r2"] for p in pooled])),
            }
    return {
        "schema": "oreflow.learning/v1",
        "features": list(FEATURES), "targets": list(TARGETS), "models": list(MODELS),
        "design": {"per_case": design["per_case"], "cases": [c.id for c in cases], "rows": int(len(x)), "seed": design["seed"],
                   "seconds": design["seconds"], "method": "scrambled Sobol over each case's Contract 1 envelope and ore factors"},
        "settings": {k: v for k, v in s.items()},
        "identity": interpolation["identity"],
        "interpolation": {"train_rows": int(len(train)), "test_rows": int(len(test)), "models": interpolation["models"],
                          "mlp_training": interpolation["mlp_training"],
                          "permutation_importance": interpolation["permutation_importance"]},
        "guard": {k: v for k, v in guard_interp.items() if not k.startswith("_")},
        "leave_one_case_out": folds,
        "summary": summary,
        "final": {"mlp_training": {k: v for k, v in final_info.items() if k != "validation_history"},
                  "guard_threshold": final_guard["threshold"], "exports": exports},
        "seconds": time.perf_counter() - started,
    }


def surrogate_reference(models_dir: Path, cases: tuple[CaseDef, ...] = CASES) -> list[dict[str, Any]]:
    """Features and ONNX Runtime outputs of the exported surrogate and guard at every case's nominal point.

    Written into ``process_surrogate.json`` so the browser, which recomputes the features and runs the
    same ONNX files, can be checked against this reference end to end.
    """
    import onnxruntime

    scalers = json.loads((models_dir / "process_surrogate.json").read_text(encoding="utf-8"))
    surrogate = onnxruntime.InferenceSession(str(models_dir / "process_surrogate.onnx"), providers=["CPUExecutionProvider"])
    guard_model = onnxruntime.InferenceSession(str(models_dir / "process_guard.onnx"), providers=["CPUExecutionProvider"])
    fm, fs = np.asarray(scalers["feature_mean"]), np.asarray(scalers["feature_scale"])
    tm, ts = np.asarray(scalers["target_mean"]), np.asarray(scalers["target_scale"])
    gm, gs = np.asarray(scalers["guard_feature_mean"]), np.asarray(scalers["guard_feature_scale"])
    out = []
    for case in cases:
        factors = {name: 1.0 for name in _ore_factors(case)}
        x = np.asarray(features(case, case.nominal, factors))
        standardized = ((x - fm) / fs).astype(np.float32)[None, :]
        prediction = surrogate.run(None, {"features": standardized})[0][0].astype(np.float64) * ts + tm
        guard_input = ((x - gm) / gs).astype(np.float32)[None, :]
        reconstruction = guard_model.run(None, {"features": guard_input})[0][0].astype(np.float64)
        error = float(np.mean((reconstruction - guard_input[0].astype(np.float64)) ** 2))
        out.append({"case_id": case.id, "features": [float(v) for v in x],
                    "prediction": {name: float(v) for name, v in zip(TARGETS, prediction)},
                    "guard_error": error, "guard_flag": error > scalers["guard_threshold"]})
    return out


def write_surrogate_reference(models_dir: Path, cases: tuple[CaseDef, ...] = CASES) -> None:
    path = models_dir / "process_surrogate.json"
    scalers = json.loads(path.read_text(encoding="utf-8"))
    scalers["reference"] = surrogate_reference(models_dir, cases)
    path.write_text(json.dumps(scalers, indent=1) + "\n", encoding="utf-8", newline="\n")
