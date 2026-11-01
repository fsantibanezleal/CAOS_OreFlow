"""Producer boundaries reject malformed nested payloads, without training or rewriting artifacts."""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import contract_schemas as cs  # noqa: E402


@pytest.fixture(params=["contract", "learning"])
def record(request):
    path = ROOT / "data/derived/contract/operating_contract.json" if request.param == "contract" else Path(__file__).parent / "fixtures/learning-v2.json"
    return request.param, json.loads(path.read_text(encoding="utf-8"))


def test_valid_producer_record(record):
    kind, payload = record
    assert not cs.errors(("oreflow-learning-v2" if kind == "learning" else "oreflow-contract-v1"), payload)


# Paths use a representative case/method, never a fixed case count or timing value.
MALFORMED = [
    ("contract", ("fields", 0), None),
    ("contract", ("cases",), {}),
    ("contract", ("inputs", 0, "label"), {"en": "missing Spanish"}),
    ("contract", ("inputs", 0, "step"), 0),
    ("contract", ("rules", 0, "factor"), "half"),
    ("contract", ("rules", 0, "relation"), ">="),
    ("contract", ("cases", "copper_porphyry_soft", "inputs", "throughput_tph", "min"), None),
    ("contract", ("cases", "copper_porphyry_soft", "nominal", "throughput_tph"), "720"),
    ("contract", ("cases", "copper_porphyry_soft", "primary"), {}),
    ("contract", ("controls", "uncertainty_samples", "default"), False),
    ("contract", ("grid", "size_um", 0), -1),
    ("contract", ("laguerre", "weights", 0), float("inf")),
    ("learning", ("interpolation",), {}),
    ("learning", ("interpolation", "models", "ridge"), {}),
    ("learning", ("interpolation", "models", "ridge", "recovery_pct", "rmse"), None),
    ("learning", ("interpolation", "models", "ridge", "recovery_pct", "rows"), 1.5),
    ("learning", ("interpolation", "models", "ridge", "recovery_pct", "mae"), -0.1),
    ("learning", ("leave_one_case_out", 0, "models", "mlp", "log_upgrade"), []),
    ("learning", ("design", "rows"), "3072"),
    ("learning", ("guard", "false_alarm_rate"), 1.01),
    ("learning", ("summary", "mlp", "recovery_pct"), {}),
    ("learning", ("final", "exports", "surrogate", "opset"), None),
    ("learning", ("final", "exports", "screen", "cholesky", "bytes"), 0),
    ("learning", ("interpolation", "models", "ridge", "recovery_pct", "r2"), float("nan")),
    ("learning", ("mlp_seeds", "summary", "log_upgrade", "loco_rmse_by_case"), []),
]


@pytest.mark.parametrize("kind,path,value", MALFORMED, ids=[f"{k}:{'.'.join(map(str, p))}" for k, p, _ in MALFORMED])
def test_reject_malformed_nested_producer_payload(kind, path, value):
    source = ROOT / "data/derived/contract/operating_contract.json" if kind == "contract" else Path(__file__).parent / "fixtures/learning-v2.json"
    payload = json.loads(source.read_text(encoding="utf-8"))
    parent = payload
    for part in path[:-1]:
        parent = parent[part]
    parent[path[-1]] = value
    assert cs.errors(("oreflow-learning-v2" if kind == "learning" else "oreflow-contract-v1"), payload), f"accepted malformed {path}"


def test_dynamic_cases_and_optional_model_diagnostics():
    contract = json.loads((ROOT / "data/derived/contract/operating_contract.json").read_text(encoding="utf-8"))
    contract["cases"]["future_case_with_a_new_id"] = copy.deepcopy(next(iter(contract["cases"].values())))
    assert not cs.errors("oreflow-contract-v1", contract)
    learning = json.loads((Path(__file__).parent / "fixtures/learning-v2.json").read_text(encoding="utf-8"))
    learning["interpolation"]["models"]["ridge"]["recovery_pct"]["unit_check"] = {
        "passed": True, "observed_range": [0.0, 100.0], "prediction_std": 8.3,
    }
    learning["interpolation"]["models"]["ridge"]["recovery_pct"]["future_metric"] = 0.5
    assert not cs.errors("oreflow-learning-v2", learning)


def test_actual_scoring_producer_and_optional_observable_payloads():
    sys.path.insert(0, str(ROOT / "data-pipeline"))
    import numpy as np
    from pipeline.methods.learning import _scores

    payload = json.loads((Path(__file__).parent / "fixtures/learning-v2.json").read_text(encoding="utf-8"))
    score = _scores(np.array([1.0, 2.0, 3.0]), np.array([1.1, 2.1, 2.9]), np.array(["new_case"] * 3), evaluation={"method": "ridge", "target": "recovery_pct", "protocol": "interpolation", "fold": "interpolation", "seed": 1})
    payload["interpolation"]["models"]["ridge"]["recovery_pct"] = score
    seed_score = payload["mlp_seeds"]["scores"]["case-a"]["recovery_pct"][0]
    seed_score.update(copy.deepcopy(score))
    seed_score["evaluation"].update(method="mlp", fold="case-a", protocol="leave_one_case_out")
    assert not cs.errors("oreflow-learning-v2", payload)
    for diagnostic in [score["observable"], score["observable_by_case"]["new_case"],
                       payload["mlp_seeds"]["scores"]["case-a"]["recovery_pct"][0]["observable"]]:
        before = copy.deepcopy(diagnostic)
        diagnostic["observed_range"] = [0.0]
        assert cs.errors("oreflow-learning-v2", payload)
        diagnostic.clear()
        diagnostic.update(before)
        diagnostic["status"] = "unchecked"
        assert cs.errors("oreflow-learning-v2", payload)
        diagnostic.clear()
        diagnostic.update(before)
    assert not cs.errors("oreflow-learning-v2", payload)


def test_missing_consumed_gp_coverage_rejects():
    payload = json.loads((Path(__file__).parent / "fixtures/learning-v2.json").read_text(encoding="utf-8"))
    del payload["interpolation"]["models"]["gaussian_process"]["recovery_pct"]["coverage_95"]
    assert cs.errors("oreflow-learning-v2", payload)


def test_group_fold_requires_nonempty_case_ids():
    """Exercise the group component even when the bounded fixture has no group holdouts."""
    from jsonschema import Draft202012Validator

    payload = json.loads((Path(__file__).parent / "fixtures/learning-v2.json").read_text())
    schema = json.loads((ROOT / "docs/contracts/schemas/oreflow-learning-v2.schema.json").read_text())
    validator = Draft202012Validator({"$defs": schema["$defs"], "$ref": "#/$defs/GroupFold"})
    group = {**copy.deepcopy(payload["leave_one_case_out"][0]), "held_out_group": "fixture-group", "cases": ["case-a"]}
    assert not list(validator.iter_errors(group))
    group["cases"] = []
    assert list(validator.iter_errors(group))
