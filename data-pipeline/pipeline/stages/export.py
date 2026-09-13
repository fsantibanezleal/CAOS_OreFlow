"""Stage 6: write compact CONTRACT-2 artifacts and manifests."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ..core.gate import classify_lane
from ..core.manifest import build_case_manifest
from ..core.trace import build_trace
from ..io.formats import write_json


def _round_trace(result) -> dict[str, Any]:
    raw = build_trace(result)
    for key in ("size_um", "feed_psd", "crushed_psd", "ground_psd", "overflow_psd", "flotation_recovery"):
        raw[key] = [round(float(v), 7) for v in raw[key]]
    raw["metrics"] = {k: round(float(v), 7) for k, v in raw["metrics"].items()}
    return raw


def run_case(*, case, variants: list[dict[str, Any]], seed: int, run_ms: float, metrics: dict, derived_dir: str | Path, manifests_dir: str | Path) -> dict:
    case_artifact = {"schema": "oreflow.case/v1", "case_id": case.id, "category": case.category, "title": case.title,
                     "description": case.description, "expected_band": case.expected_band, "provenance": case.provenance,
                     "variants": variants}
    rel = f"cases/{case.id}.json"
    bytes_written = write_json(Path(derived_dir) / rel, case_artifact)
    gate = classify_lane(pure_python=False, wheels={"numpy", "scipy", "scikit-learn"}, run_ms=run_ms, trace_bytes=bytes_written)
    manifest = build_case_manifest(case=case, params=case.params, seed=seed, artifact_rel=rel, trace_bytes=bytes_written,
                                   gate=gate, flags=[], metrics=metrics)
    write_json(Path(manifests_dir) / f"{case.id}.json", manifest)
    return manifest
