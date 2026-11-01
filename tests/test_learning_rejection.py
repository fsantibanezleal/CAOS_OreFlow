"""Rejected transfers stay in the cohort without acquiring ordinary accuracy scores."""
from copy import deepcopy

import numpy as np
import pytest

from pipeline.methods.learning import MODELS, _aggregate, _fold_counts, _scores, common_cohort
from pipeline.methods.observable import PredictionRejected, record_findings

CONTEXT = {"method": "mlp", "target": "recovery_pct", "protocol": "leave_one_case_out", "fold": "unseen", "seed": 7}


def rejected():
    return _scores(np.array([40., 50., 60.]), np.array([-200., -180., -160.]),
                   evaluation=CONTEXT, allow_rejection=True)


def test_adversarial_only_range_failure_can_be_preserved_as_rejected_transfer():
    result = rejected()
    assert result["status"] == "rejected-transfer" and result["valid_for_scoring"] is False
    assert all(result[key] is None for key in ("rmse", "mae", "r2"))
    assert result["rejection"]["affected_rows"] == 3
    assert result["observable"]["prediction_range"] == [-200., -160.]
    assert record_findings(result) == []
    with pytest.raises(PredictionRejected):
        _scores(np.array([40., 50., 60.]), np.array([-200., -180., -160.]))
    with pytest.raises(ValueError, match="finite"):
        _scores(np.array([40., 50., 60.]), np.array([40., np.nan, 60.]), evaluation=CONTEXT, allow_rejection=True)
    with pytest.raises(ValueError, match="shape"):
        _scores(np.array([40., 50., 60.]), np.array([40.]), evaluation=CONTEXT, allow_rejection=True)


def test_adversarial_a_failed_individual_case_is_not_hidden_by_pooled_overlap():
    y = np.array([40., 50., 40., 50.])
    result = _scores(y, np.array([40., 50., -200., -180.]), np.array(["a", "a", "b", "b"]),
                     reference=y, evaluation={**CONTEXT, "protocol": "transfer"}, allow_rejection=True)
    assert result["observable"]["status"] == "passed"
    assert result["observable_by_case"]["b"]["status"] == "rejected-outside-range"
    assert result["rejection"]["affected_rows"] == 2
    assert record_findings(result) == []


def test_adversarial_rejection_cannot_be_relabelled_as_a_score_or_used_to_hide_poor_valid_predictions():
    bad = rejected()
    bad.update(status="scored", valid_for_scoring=True, rmse=250., mae=250., r2=-100.)
    assert any("outside" in error for error in record_findings(bad))
    poor = _scores(np.array([40., 50., 60.]), np.array([61., 32., 43.]), evaluation=CONTEXT)
    assert poor["valid_for_scoring"] and poor["r2"] < 0
    forged = deepcopy(poor)
    forged.update(status="rejected-transfer", valid_for_scoring=False, rmse=None, mae=None, r2=None,
                  rejection={"code": "observable-range", "reason": "poor accuracy", "affected_rows": 3})
    assert any("genuine" in error for error in record_findings(forged))


def test_adversarial_denominators_and_matched_cohorts_preserve_failed_folds():
    scored = _scores(np.array([40., 50., 60.]), np.array([41., 49., 61.]), evaluation=CONTEXT)
    folds = [{"id": key, "models": {model: {"recovery_pct": deepcopy(scored)} for model in MODELS}}
             for key in ("a", "b")]
    folds[1]["models"]["mlp"]["recovery_pct"] = rejected()
    rows = [fold["models"]["mlp"]["recovery_pct"] for fold in folds]
    assert _fold_counts(rows) == {"attempted": 2, "scored": 1, "rejected": 1}
    assert _aggregate(rows, "rmse", "mean") == scored["rmse"]
    assert _aggregate([rejected()], "rmse", "mean") is None
    common = common_cohort(folds, "id", "recovery_pct")
    assert common["attempted"] == 2 and common["folds"] == ["a"] and common["excluded"] == ["b"]
    assert all(model["rmse_mean"] == scored["rmse"] for model in common["models"].values())


def test_adversarial_transfer_rejection_is_not_allowed_for_interpolation():
    with pytest.raises(ValueError, match="Only a declared transfer"):
        _scores(np.array([40., 50.]), np.array([-200., -180.]),
                evaluation={**CONTEXT, "protocol": "interpolation"}, allow_rejection=True)
