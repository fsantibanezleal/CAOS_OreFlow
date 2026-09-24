"""The public live API must use the same circuit family as baked scenarios."""
from fastapi.testclient import TestClient

from app.main import app
from pipeline.cases.catalog import CASES


def test_live_api_infers_magnetic_family_from_known_case():
    case = next(case for case in CASES if case.id == "iron_magnetite_fine")
    response = TestClient(app).post("/api/simulate", json=case.params.__dict__ | {"process_family": None})
    assert response.status_code == 200
    metrics = response.json()["trace"]["metrics"]
    assert metrics["magnetic_recovery_pct"] > 0
    assert metrics["flotation_recovery_pct"] == 0
    assert metrics["cyclone_d50_um"] == 0


def test_live_api_rejects_invalid_family():
    case = CASES[0]
    response = TestClient(app).post("/api/simulate", json=case.params.__dict__ | {"process_family": "unknown"})
    assert response.status_code == 422
