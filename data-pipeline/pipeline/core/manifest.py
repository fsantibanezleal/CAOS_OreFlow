"""Versioned CONTRACT-2 manifest builders."""
from __future__ import annotations

from .. import __version__
from .trace import TRACE_SCHEMA

MANIFEST_SCHEMA = "oreflow.manifest/v1"
INDEX_SCHEMA = "oreflow.index/v1"


def build_case_manifest(*, case, params, seed: int, artifact_rel: str, trace_bytes: int, gate: dict, flags: list[dict], metrics: dict) -> dict:
    names = ("feed_tph", "feed_grade_pct", "feed_p80_um", "hardness_kwh_t", "density_t_m3", "grind_p80_um",
             "classifier_cut_um", "flotation_time_min", "air_rate_m3_min", "reagent_gpt", "water_m3_t")
    return {"schema": MANIFEST_SCHEMA, "case_id": case.id, "category": case.category, "process_family": case.params.process_family,
            "real_or_synthetic": case.provenance, "expected_band": case.expected_band,
            "engine": {"package": "oreflow-pipeline", "version": __version__, "model": "integrated comminution-classification-flotation"},
            "params": {name: getattr(params, name) for name in names}, "seed": seed,
            "artifact": {"path": artifact_rel, "format": "json", "trace_schema": TRACE_SCHEMA, "bytes": trace_bytes},
            "lane": gate["lane"], "gate": gate, "flags": flags, "metrics": metrics}


def build_index(entries: list[dict]) -> dict:
    return {"schema": INDEX_SCHEMA, "engine_version": __version__, "n_cases": len(entries),
            "n_variants": sum(int(e.get("variants", 0)) for e in entries), "cases": sorted(entries, key=lambda e: e["case_id"])}
