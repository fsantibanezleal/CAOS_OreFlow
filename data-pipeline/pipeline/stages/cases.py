"""Stage: bake one case into its Contract 2 artifact.

For every variant: the engine trace (point, metrics, streams, topology, curves, kinetics, balance,
flags), the constrained optimization record (screened by the learned lane this bake exported) and the
uncertainty record; for the nominal variant also the Sobol sensitivity record. The artifact embeds the
ore and plant definitions, so the browser engine recomputes every variant from the artifact alone.
"""
from __future__ import annotations

from dataclasses import asdict
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..cases.catalog import CASE_BY_ID, SOURCES, variant_point
from ..engine.circuit import simulate
from ..engine.trace import trace
from ..methods.optimization import optimize
from ..methods.screen import Screen
from ..methods.uncertainty import sensitivity, uncertainty

SCHEMA = "oreflow.case/v2"


def _bilingual(pair: tuple[str, str]) -> dict[str, str]:
    return {"en": pair[0], "es": pair[1]}


@lru_cache(maxsize=2)
def _screen(models_dir: str) -> Screen:
    """One screen per worker process: the exports of this bake's learning stage."""
    return Screen(Path(models_dir))


def bake_case(case_id: str, contract: dict[str, Any], version: str, models_dir: str) -> dict[str, Any]:
    case = CASE_BY_ID[case_id]
    screen = _screen(models_dir)
    variants = []
    for variant in case.variants:
        point = variant_point(case, variant)
        result = simulate(case.ore, case.plant, point)
        methods: dict[str, Any] = {"optimization": optimize(case, point, contract, screen=screen), "uncertainty": uncertainty(case, point)}
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
        "kpi_sources": {k: _bilingual(v) for k, v in case.kpi_sources.items()},
        "definition": {"ore": asdict(case.ore), "plant": asdict(case.plant)},
        "nominal": asdict(case.nominal),
        "variants": variants,
    }
