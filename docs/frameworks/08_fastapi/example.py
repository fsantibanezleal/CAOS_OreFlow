"""FastAPI in OreFlow: the service driven in process with FastAPI's TestClient (no server, no network):
health, the catalog, the contract, an accepted and two rejected simulations, and the live trace compared
value for value with the engine run directly.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\08_fastapi\\example.py
Every printed claim is also asserted.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "data-pipeline"))

from app.main import create_app  # noqa: E402
from pipeline.cases.catalog import CASE_BY_ID  # noqa: E402
from pipeline.engine.circuit import simulate  # noqa: E402
from pipeline.engine.trace import trace  # noqa: E402

client = TestClient(create_app())
version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()

health = client.get("/healthz").json()
print("healthz:", health)
assert health == {"status": "ok", "service": "oreflow", "version": version}

index = client.get("/api/cases").json()
contract = client.get("/api/contract").json()
print(f"catalog: {index['n_cases']} cases, {index['n_variants']} variants; contract digest {contract['digest'][:12]}...")
assert (index["n_cases"], index["n_variants"]) == (12, 72) and index["contract_digest"] == contract["digest"]
assert client.get("/api/cases/not_a_case").status_code == 404

# an accepted state: two inputs changed, the other ten taken from the case's nominal point
point = {"target_p80_um": 120, "collector_gpt": 30}
reply = client.post("/api/simulate", json={"case_id": "copper_porphyry_soft", "point": point})
body = reply.json()
metrics, units = body["trace"]["metrics"], body["trace"]["metric_units"]
print(f"accepted ({reply.status_code}, {body['schema']}): recovery {metrics['recovery_pct']:.2f} {units['recovery_pct']}, "
      f"grade {metrics['concentrate_grade']:.2f} {units['concentrate_grade']}, balance {metrics['balance_max_relative_error']:.1e}")
assert reply.status_code == 200 and body["schema"] == "oreflow.live/v2" and body["contract_digest"] == contract["digest"]
assert metrics["balance_max_relative_error"] <= 1e-9

# the service adds nothing of its own: its trace is the engine's, value for value
case = CASE_BY_ID["copper_porphyry_soft"]
direct = case.nominal.with_values(target_p80_um=120.0, collector_gpt=30.0)
assert body["trace"] == json.loads(json.dumps(trace(simulate(case.ore, case.plant, direct), direct, case.plant.family)))
print("  identical to the engine run directly")

# two rejections, each with its code: a value outside the envelope and an input the circuit does not use
for bad in ({"throughput_tph": 5000}, {"gravity_bleed": 0.2}):
    reply = client.post("/api/simulate", json={"case_id": "copper_porphyry_soft", "point": bad})
    error = reply.json()["errors"][0]
    print(f"rejected ({reply.status_code}): {error['code']} on {error['input']}: {error['message']}"
          + (f" [{error['min']}, {error['max']}]" if "min" in error else ""))
    assert reply.status_code == 422 and reply.json()["schema"] == "oreflow.rejection/v1"

# a body of the wrong shape never reaches the contract: FastAPI's own 422
assert client.post("/api/simulate", json={"case_id": "copper_porphyry_soft", "point": [1, 2]}).status_code == 422
print("every check passed")
