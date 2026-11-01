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


class PredictionRejected(ValueError):
    """A finite, aligned prediction wholly outside the declared scoring envelope.

    This specific failure may be preserved as a rejected transfer. Shape, nonfinite,
    fitting and programming failures must still abort the evaluation.
    """

    def __init__(self, diagnostics: dict[str, Any]) -> None:
        self.diagnostics = diagnostics
        super().__init__(f"observable check: predictions {diagnostics['prediction_range']} wholly outside "
                         f"widened range {diagnostics['allowed_range']}")


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
    diagnostics = {"schema": SCHEMA, "rows": int(observed.size), "observed_range": observed_range,
                   "prediction_range": prediction_range, "reference_range": reference_range, "allowed_range": allowed,
                   "constant_baseline": constant_baseline,
                   "status": _expected_status(observed_range, prediction_range, constant_baseline)}
    if prediction_range[1] < allowed[0] or prediction_range[0] > allowed[1]:
        diagnostics["status"] = "rejected-outside-range"
        raise PredictionRejected(diagnostics)
    return diagnostics


def summary_findings(record: object, *, allow_rejected: bool = False) -> list[str]:
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
    outside = pmax < lo - (hi - lo) or pmin > hi + (hi - lo)
    if outside and not allow_rejected:
        errors.append("predictions wholly outside widened observable")
    status = "rejected-outside-range" if outside else _expected_status(
        record["observed_range"], record["prediction_range"], record["constant_baseline"])
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
            if {"rmse", "mae", "r2", "rows"}.issubset(value):
                if "observable" not in value:
                    errors.append(f"{path}: score has no observable diagnostics")
                    return
                if not isinstance(value["observable"], dict) or not isinstance(value.get("observable_by_case", {}), dict):
                    errors.append(f"{path}: observable diagnostics must be objects")
                    return
                rejected = value.get("status") == "rejected-transfer"
                context = value.get("evaluation", {})
                context_ok = isinstance(context, dict) and all(
                    isinstance(context.get(k), str) and context[k].strip()
                    for k in ("method", "target", "protocol", "fold")) and type(context.get("seed")) is int
                if not context_ok:
                    errors.append(f"{path}: evaluation context required")
                diagnostics = [value["observable"]] + list(value.get("observable_by_case", {}).values())
                outside = [d for d in diagnostics if isinstance(d, dict) and d.get("status") == "rejected-outside-range"]
                diagnostic_errors = []
                for index, diagnostic in enumerate(diagnostics):
                    count += 1
                    diagnostic_errors.extend(f"{path}/observable/{index}: {f}" for f in summary_findings(
                        diagnostic, allow_rejected=rejected))
                errors.extend(diagnostic_errors)
                if diagnostic_errors:
                    return
                if value.get("rows") != value["observable"].get("rows"):
                    errors.append(f"{path}: score and observable rows differ")
                if rejected:
                    reason = value.get("rejection", {})
                    grouped = list(value.get("observable_by_case", {}).values())
                    affected = sum(d["rows"] for d in grouped if d.get("status") == "rejected-outside-range") if grouped else (
                        value["rows"] if outside else 0)
                    if value.get("valid_for_scoring") is not False or any(value[k] is not None for k in ("rmse", "mae", "r2")):
                        errors.append(f"{path}: rejected transfer must have null metrics and valid_for_scoring=false")
                    if not outside or not context_ok or context.get("protocol") not in ("leave_one_case_out", "transfer"):
                        errors.append(f"{path}: rejection needs a genuine outside-range transfer")
                    if not isinstance(reason, dict) or reason.get("code") != "observable-range" or not reason.get("reason") or (
                            type(reason.get("affected_rows")) is not int or reason["affected_rows"] != affected or affected < 1):
                        errors.append(f"{path}: inconsistent rejection diagnostics")
                    if value.get("r2_within_case") is not None or value.get("coverage_95") is not None:
                        errors.append(f"{path}: rejected transfer cannot retain derived scoring metrics")
                else:
                    if value.get("status") != "scored" or value.get("valid_for_scoring") is not True or "rejection" in value:
                        errors.append(f"{path}: scored result status is inconsistent")
                    if any(isinstance(value[k], bool) or not isinstance(value[k], (float, int)) or not math.isfinite(value[k])
                           for k in ("rmse", "mae", "r2")):
                        errors.append(f"{path}: scored metrics must be finite")
                # The parent score is the only authority that may accept rejected diagnostics.
                return
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
