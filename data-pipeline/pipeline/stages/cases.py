"""Stage: bake one case into its Contract 2 artifact.

For every variant: the engine trace (point, metrics, streams, topology, curves, kinetics, balance,
flags), the constrained optimization record and the uncertainty record; for the nominal variant
also the Sobol sensitivity record. The artifact embeds the ore and plant definitions, so the browser
engine recomputes every variant from the artifact alone.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any

from ..cases.catalog import CASE_BY_ID, SOURCES, variant_point
from ..engine.circuit import simulate
from ..engine.trace import trace
from ..methods.optimization import optimize
from ..methods.uncertainty import sensitivity, uncertainty

SCHEMA = "oreflow.case/v2"


def _bilingual(pair: tuple[str, str]) -> dict[str, str]:
    return {"en": pair[0], "es": pair[1]}


def bake_case(case_id: str, contract: dict[str, Any], version: str) -> dict[str, Any]:
    case = CASE_BY_ID[case_id]
    variants = []
    for variant in case.variants:
        point = variant_point(case, variant)
        result = simulate(case.ore, case.plant, point)
        methods: dict[str, Any] = {"optimization": optimize(case, point, contract), "uncertainty": uncertainty(case, point)}
        if variant["id"] == "nominal":
            methods["sensitivity"] = sensitivity(case, point)
        variants.append({"id": variant["id"], "label": _bilingual(variant["label"]), "change": dict(variant["change"]),
                         "point": asdict(point), "trace": trace(result, point, case.plant.family), "methods": methods})
    return {
        "schema": SCHEMA,
        "engine_version": version,
        "contract_digest": contract["digest"],
        "case_id": case.id,
        "category": case.category,
        "family": case.plant.family,
        "title": _bilingual(case.title),
        "description": _bilingual(case.description),
        "question": _bilingual(case.question),
        "provenance": case.provenance,
        "notes": list(case.notes),
        "sources": {key: SOURCES[key] for key in case.sources},
        "kpi_ranges": {k: list(v) for k, v in case.kpi_ranges.items()},
        "definition": {"ore": asdict(case.ore), "plant": asdict(case.plant)},
        "nominal": asdict(case.nominal),
        "variants": variants,
    }
