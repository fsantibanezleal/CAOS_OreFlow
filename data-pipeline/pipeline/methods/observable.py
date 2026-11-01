"""Unit-scale checks at the prediction boundary, independent of accuracy rankings.

The reference is an explicitly declared observable range, widened by one full span on each side.
It is used only after fitting, never for scaling, training, model selection or clipping predictions.
Finite poor predictions retain their scores. A constant forecast is recorded as loss of sensitivity,
including honest extrapolation failures; a declared mean baseline is identified separately.
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import numpy as np

SCHEMA = "oreflow.observable/v1"


def _range(values: np.ndarray) -> list[float]:
    return [float(values.min()), float(values.max())]


def _expected_status(observed: list[float], predicted: list[float], constant_baseline: bool) -> str:
    if observed[1] > observed[0] and predicted[1] == predicted[0]:
        return "declared-constant-baseline" if constant_baseline else "constant-prediction"
    return "passed"


def check_observable(y: np.ndarray, pred: np.ndarray, *, reference: np.ndarray | None = None,
                     constant_baseline: bool = False) -> dict[str, Any]:
    """Reject non-finite/misaligned answers and predictions wholly outside the widened observable.

    An uninformative finite model is still negative evidence: its constant-prediction status must
    travel with its score. Reporting that status never turns it into an operationally useful model.
    """
    import numpy as np

    observed, predicted = np.asarray(y, dtype=float), np.asarray(pred, dtype=float)
    ref = observed if reference is None else np.asarray(reference, dtype=float)
    if observed.ndim != 1 or predicted.shape != observed.shape or not observed.size or ref.ndim != 1 or not ref.size:
        raise ValueError("observable check: non-empty, matching one-dimensional shapes required")
    if not all(np.isfinite(a).all() for a in (observed, predicted, ref)):
        raise ValueError("observable check: observations, predictions and reference must be finite")
    observed_range, prediction_range, reference_range = _range(observed), _range(predicted), _range(ref)
    span = reference_range[1] - reference_range[0]
    allowed = [reference_range[0] - span, reference_range[1] + span]
    if prediction_range[1] < allowed[0] or prediction_range[0] > allowed[1]:
        raise ValueError(f"observable check: predictions {prediction_range} wholly outside widened range {allowed}")
    return {"schema": SCHEMA, "rows": int(observed.size), "observed_range": observed_range,
            "prediction_range": prediction_range, "reference_range": reference_range, "allowed_range": allowed,
            "constant_baseline": constant_baseline,
            "status": _expected_status(observed_range, prediction_range, constant_baseline)}


def summary_findings(record: object) -> list[str]:
    """Recheck sufficient range diagnostics in a shipped score without trusting its stored verdict."""
    if not isinstance(record, dict) or record.get("schema") != SCHEMA:
        return ["missing observable diagnostics"]
    errors = []
    for name in ("observed_range", "prediction_range", "reference_range", "allowed_range"):
        values = record.get(name)
        if not isinstance(values, list) or len(values) != 2 or any(
                isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
            errors.append(f"{name}: two finite bounds required")
        elif values[1] < values[0]:
            errors.append(f"{name}: reversed bounds")
    if not isinstance(record.get("rows"), int) or isinstance(record.get("rows"), bool) or record["rows"] < 1:
        errors.append("rows: positive integer required")
    if not isinstance(record.get("constant_baseline"), bool):
        errors.append("constant_baseline: boolean required")
    if errors:
        return errors
    lo, hi = record["reference_range"]
    if record["allowed_range"] != [lo - (hi - lo), hi + (hi - lo)]:
        errors.append("allowed_range: inconsistent with the reference observable")
    pmin, pmax = record["prediction_range"]
    if pmax < lo - (hi - lo) or pmin > hi + (hi - lo):
        errors.append("predictions wholly outside widened observable")
    status = _expected_status(record["observed_range"], record["prediction_range"], record["constant_baseline"])
    if record.get("status") != status:
        errors.append(f"status: expected {status}")
    return errors


def record_findings(record: object) -> list[str]:
    """Check every persisted score and range summary, including grouped and seed-stability runs."""
    errors: list[str] = []
    count = 0

    def walk(value: object, path: str) -> None:
        nonlocal count
        if isinstance(value, dict):
            if {"rmse", "mae", "r2", "rows"}.issubset(value) and "observable" not in value:
                errors.append(f"{path}: score has no observable diagnostics")
            if value.get("schema") == SCHEMA:
                count += 1
                errors.extend(f"{path}: {finding}" for finding in summary_findings(value))
            for name, child in value.items():
                walk(child, f"{path}/{name}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{path}/{index}")

    walk(record, "learning")
    if not count:
        errors.append("learning: no observable diagnostics in shipped predictions")
    return errors
