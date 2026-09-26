"""Read-only catalog, the operating contract and the bounded live simulation."""
from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from ..models.schemas import SimulationRequest
from ..services import content

PIPELINE_ROOT = Path(__file__).resolve().parents[2] / "data-pipeline"
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PIPELINE_ROOT))

router = APIRouter(prefix="/api")
CONTRACT_FILE = "contract/operating_contract.json"


@lru_cache(maxsize=1)
def operating_contract() -> dict[str, Any]:
    """The exported Contract 1 document, the same file the static build serves to the browser."""
    document = content.load_json(CONTRACT_FILE)
    if document is None:
        raise RuntimeError(f"{CONTRACT_FILE} is missing from the derived artifacts")
    return document


@router.get("/cases")
def list_cases() -> dict:
    return content.load_index()


@router.get("/benchmark")
def benchmark() -> dict:
    return content.load_json("benchmark.json") or {}


@router.get("/contract")
def contract() -> dict:
    return operating_contract()


@router.get("/cases/{case_id}")
def get_case(case_id: str) -> dict:
    data = content.load_json(f"cases/{case_id}.json")
    if data is None:
        raise HTTPException(status_code=404, detail="unknown case")
    return data


@router.get("/cases/{case_id}/manifest")
def get_manifest(case_id: str) -> dict:
    data = content.load_manifest(case_id)
    if data is None:
        raise HTTPException(status_code=404, detail="unknown case")
    return data


def _message(document: dict[str, Any], code: str) -> str:
    if code in document["messages"]:
        return document["messages"][code]["en"]
    rule = next(r for r in document["rules"] if r["id"] == code)
    return rule["message"]["en"]


@router.post("/simulate")
def simulate(request: SimulationRequest) -> Any:
    from pipeline.cases.catalog import CASE_BY_ID
    from pipeline.engine.circuit import simulate as run_circuit
    from pipeline.engine.model import operating_from_dict
    from pipeline.engine.trace import trace
    from pipeline.io.contract import validate

    document = operating_contract()
    result = validate(document, request.case_id, request.point)
    if not result["accepted"]:
        errors = [{**error, "message": _message(document, error["code"])} for error in result["errors"]]
        return JSONResponse(status_code=422, content={"schema": "oreflow.rejection/v1", "contract_digest": document["digest"],
                                                      "case_id": request.case_id, "errors": errors})
    case = CASE_BY_ID[request.case_id]
    point = operating_from_dict(result["point"])
    try:
        circuit = run_circuit(case.ore, case.plant, point)
    except Exception as exc:  # an accepted state must solve; report the failure instead of hiding it
        return JSONResponse(status_code=500, content={"schema": "oreflow.engine-error/v1", "case_id": request.case_id,
                                                      "point": result["point"], "message": f"{type(exc).__name__}: {exc}"})
    return {"schema": "oreflow.live/v2", "lane": "live-api", "contract_digest": document["digest"],
            "case_id": request.case_id, "trace": trace(circuit, point, case.plant.family)}
