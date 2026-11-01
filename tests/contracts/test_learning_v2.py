"""Authored v2 boundary examples, independent of the pending production bake."""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import contract_schemas as cs


@pytest.fixture
def learning():
    return json.loads((Path(__file__).parent / "fixtures/learning-v2.json").read_text())


def test_scored_and_rejected_fixture(learning):
    assert not cs.errors("oreflow-learning-v2", learning)
    rejected = learning["leave_one_case_out"][1]["models"]["mlp"]["recovery_pct"]
    assert rejected["rmse"] is None and rejected["observable"]["prediction_range"] == [-30, -20]


@pytest.mark.parametrize("field,value", [
    ("rmse", None), ("r2", None), ("valid_for_scoring", False),
    ("evaluation", {}), ("observable", None), ("rmse", float("nan")),
])
def test_illegal_scored_branches(learning, field, value):
    learning["interpolation"]["models"]["ridge"]["recovery_pct"][field] = value
    assert cs.errors("oreflow-learning-v2", learning)


@pytest.mark.parametrize("field,value", [
    ("rmse", 0), ("mae", 1), ("r2", 0), ("valid_for_scoring", True),
    ("evaluation", {}), ("rejection", {"code": "observable-range", "affected_rows": 2}),
    ("observable", {}),
])
def test_illegal_rejected_branches(learning, field, value):
    learning["leave_one_case_out"][1]["models"]["mlp"]["recovery_pct"][field] = value
    assert cs.errors("oreflow-learning-v2", learning)


@pytest.mark.parametrize("field", ["evaluation", "rejection", "observable"])
def test_rejected_requires_context(learning, field):
    del learning["leave_one_case_out"][1]["models"]["mlp"]["recovery_pct"][field]
    assert cs.errors("oreflow-learning-v2", learning)


def test_gp_null_coverage_only_when_rejected(learning):
    gp = learning["leave_one_case_out"][1]["models"]["gaussian_process"]["recovery_pct"]
    metadata = {k: gp[k] for k in ["kernel", "training_rows", "length_scales", "noise_level", "mean_half_width"]}
    gp.update(copy.deepcopy(learning["leave_one_case_out"][1]["models"]["mlp"]["recovery_pct"]))
    gp["evaluation"]["method"] = "gaussian_process"
    gp["coverage_95"] = None
    # Check the score component separately: the complete fixture's summaries have
    # deliberately not been changed to claim that this extra rejection occurred.
    schema = json.loads((cs.ROOT / "docs/contracts/schemas/oreflow-learning-v2.schema.json").read_text())
    from jsonschema import Draft202012Validator
    validator = Draft202012Validator({"$defs": schema["$defs"], "$ref": "#/$defs/GaussianProcessScores"})
    assert not list(validator.iter_errors(gp))
    assert all(gp[k] == v for k, v in metadata.items())
    gp["coverage_95"] = 0
    assert list(validator.iter_errors(gp))


def test_v1_is_not_silently_relabelled(learning):
    learning["schema"] = "oreflow.learning/v1"
    assert cs.errors("oreflow-learning-v2", learning)


@pytest.mark.parametrize("counts", [
    {"attempted": -1, "scored": 1, "rejected": 0},
    {"attempted": 2, "scored": 1},
    {"attempted": 2, "scored": 1.5, "rejected": 0.5},
])
def test_malformed_counts(learning, counts):
    learning["summary"]["mlp"]["recovery_pct"]["loco_folds"] = counts
    assert cs.errors("oreflow-learning-v2", learning)


def test_common_cohort_cannot_duplicate_fold_ids(learning):
    cohort = learning["common_cohorts"]["leave_one_case_out"]["recovery_pct"]
    cohort["folds"] = ["case-a", "case-a"]
    assert cs.errors("oreflow-learning-v2", learning)


def test_empty_transfer_cohort_is_explicit(learning):
    assert learning["common_cohorts"]["transfer"]["recovery_pct"]["folds"] == []
    assert not cs.errors("oreflow-learning-v2", learning)


def test_constant_finite_negative_evidence_is_scored(learning):
    score = learning["interpolation"]["models"]["ridge"]["recovery_pct"]
    score["observable"].update(status="constant-prediction", prediction_range=[1, 1])
    score["r2"] = -100
    assert not cs.errors("oreflow-learning-v2", learning)
