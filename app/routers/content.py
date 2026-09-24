"""Read-only catalog and bounded live simulation routes."""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..models.schemas import SimRequest
from ..services import content

PIPELINE_ROOT = Path(__file__).resolve().parents[2] / "data-pipeline"
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PIPELINE_ROOT))

router = APIRouter(prefix="/api")


@router.get("/cases")
def list_cases() -> dict:
    return content.load_index()


@router.get("/benchmark")
def benchmark() -> dict:
    return content.load_json("benchmark.json") or {}


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


@router.post("/simulate")
def simulate(request: SimRequest) -> dict:
    from pipeline.cases.catalog import CASES
    from pipeline.io.contract import validate_rows
    from pipeline.model.process import simulate as run_model

    raw = request.model_dump()
    if raw["process_family"] is None:
        known_case = next((case for case in CASES if case.id == request.case_id.split(":", 1)[0]), None)
        raw["process_family"] = known_case.params.process_family if known_case else "rougher"
    report = validate_rows([raw])
    if not report.accepted:
        raise HTTPException(status_code=422, detail={"rejected": report.rejected, "flagged": report.flagged})
    result = run_model(report.accepted[0])
    return {"schema": "oreflow.live/v1", "lane": "live-api", "flags": report.flagged, "trace": {"schema": "oreflow.trace/v1", "case_id": result.case_id, "size_um": result.size_um, "feed_psd": result.feed_psd, "crushed_psd": result.crushed_psd, "ground_psd": result.ground_psd, "overflow_psd": result.overflow_psd, "flotation_recovery": result.flotation_recovery, "metrics": result.metrics}}
