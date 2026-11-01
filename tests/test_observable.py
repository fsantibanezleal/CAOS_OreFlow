"""The scoring boundary rejects unit-scale failures while preserving poor, finite forecasts."""
import numpy as np
import pytest

from pipeline.methods.observable import check_observable, record_findings, summary_findings
from pipeline.methods.learning import Standardizer


def test_adversarial_a_fraction_cannot_answer_a_percent_observable():
    with pytest.raises(ValueError, match="outside"):
        check_observable(np.array([40.0, 50.0, 60.0]), np.array([0.4, 0.5, 0.6]))


def test_nonfinite_and_misaligned_outputs_are_rejected():
    with pytest.raises(ValueError, match="finite"):
        check_observable(np.array([1.0, 2.0]), np.array([1.0, np.nan]))
    with pytest.raises(ValueError, match="shape"):
        check_observable(np.array([1.0, 2.0]), np.array([1.0]))


def test_a_bad_but_same_unit_prediction_stays_reportable():
    result = check_observable(np.array([40.0, 50.0, 60.0]), np.array([61.0, 32.0, 43.0]))
    assert result["status"] == "passed"
    assert summary_findings(result) == []


def test_adversarial_unexpected_constant_predictions_are_explicit_negative_evidence():
    result = check_observable(np.array([40.0, 50.0, 60.0]), np.array([50.0, 50.0, 50.0]))
    assert result["status"] == "constant-prediction"
    assert result["prediction_range"] == [50.0, 50.0]
    assert summary_findings(result) == []
    baseline = check_observable(np.array([40.0, 50.0, 60.0]), np.array([50.0, 50.0, 50.0]),
                                constant_baseline=True)
    assert baseline["status"] == "declared-constant-baseline"


def test_a_held_out_group_uses_the_declared_observable_reference():
    result = check_observable(np.array([90.0, 91.0]), np.array([60.0, 62.0]),
                              reference=np.array([10.0, 50.0, 99.0]))
    assert result["status"] == "passed"
    assert result["allowed_range"] == [-79.0, 188.0]


def test_adversarial_the_artifact_validator_recomputes_status_and_bounds():
    result = check_observable(np.array([40.0, 50.0, 60.0]), np.array([41.0, 49.0, 61.0]))
    result["allowed_range"] = [0.0, 1.0]
    assert any("allowed_range" in item for item in summary_findings(result))
    result = check_observable(np.array([40.0, 50.0, 60.0]), np.array([50.0, 50.0, 50.0]))
    result["status"] = "passed"
    assert any("status" in item for item in summary_findings(result))


def test_adversarial_shipped_scores_cannot_omit_the_runtime_check():
    score = {"rmse": 2.0, "mae": 1.0, "r2": -1.0, "rows": 3}
    assert any("no observable diagnostics" in item for item in record_findings({"models": [score]}))
    score["observable"] = check_observable(np.array([40.0, 50.0, 60.0]), np.array([41.0, 49.0, 61.0]))
    assert record_findings({"models": [score]}) == []


def test_adversarial_numerically_constant_training_features_do_not_amplify_unseen_values():
    # Summation roundoff makes np.std(repeat(0.1)) positive on common platforms.
    train = np.column_stack([np.repeat(0.1, 48), np.arange(48, dtype=float)])
    scaler = Standardizer(train)
    held_out = scaler(np.array([[0.2, 24.0]]))
    assert scaler.scale[0] == 1.0
    assert held_out[0, 0] == pytest.approx(0.1)
    np.testing.assert_allclose(scaler.inverse(scaler(train)), train)
