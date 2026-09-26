"""PE-30: the live API applies Contract 1 exactly as the exported interpreter does, and the trace it
returns is the engine's trace for the validated state."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from pipeline.cases.catalog import CASES
from pipeline.engine.circuit import simulate
from pipeline.engine.trace import trace
from pipeline.io.contract import PROBES_PATH, decode_value, load_contract

client = TestClient(app)


def _post(case_id: str, point: dict) -> object:
    # Raw text keeps NaN and infinity tokens, which the HTTP client's json= encoder rejects.
    body = json.dumps({"case_id": case_id, "point": point}, allow_nan=True)
    return client.post("/api/simulate", content=body, headers={"content-type": "application/json"})


def test_api_and_contract_agree():
    probes = json.loads(PROBES_PATH.read_text(encoding="utf-8"))["probes"]
    digest = load_contract()["digest"]
    for probe in probes:
        values = {k: decode_value(v) for k, v in probe["values"].items()}
        response = _post(probe["case_id"], values)
        expected = probe["expected"]
        if expected["accepted"]:
            assert response.status_code == 200, (probe, response.text[:300])
            assert response.json()["contract_digest"] == digest
            continue
        assert response.status_code == 422, (probe, response.status_code, response.text[:300])
        body = response.json()
        assert body["schema"] == "oreflow.rejection/v1" and body["contract_digest"] == digest
        assert sorted([e["code"], e["input"] or ""] for e in body["errors"]) == expected["errors"], probe
        assert all(e["message"] for e in body["errors"])


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_live_trace_equals_engine(case_id):
    case = next(c for c in CASES if c.id == case_id)
    response = _post(case_id, {})
    assert response.status_code == 200
    body = response.json()
    assert body["schema"] == "oreflow.live/v2" and body["lane"] == "live-api"
    expected = trace(simulate(case.ore, case.plant, case.nominal), case.nominal, case.plant.family)
    assert body["trace"] == json.loads(json.dumps(expected))


def test_contract_route_serves_the_export():
    response = client.get("/api/contract")
    assert response.status_code == 200
    assert response.json() == load_contract()


def test_malformed_request_is_rejected_by_type():
    response = client.post("/api/simulate", json={"case_id": "copper_porphyry_soft", "point": [1, 2]})
    assert response.status_code == 422
    response = client.post("/api/simulate", json={"point": {}})
    assert response.status_code == 422


def test_engine_failure_is_reported(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("solver diverged")

    monkeypatch.setattr("pipeline.engine.circuit.simulate", boom)
    response = _post("copper_porphyry_soft", {})
    assert response.status_code == 500
    body = response.json()
    assert body["schema"] == "oreflow.engine-error/v1" and "solver diverged" in body["message"]
