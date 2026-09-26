"""Shared, cached engine runs for the test suite (the engine is deterministic)."""
from __future__ import annotations

from dataclasses import replace
from functools import lru_cache

from pipeline.cases.catalog import CASE_BY_ID, CASES, variant_point
from pipeline.engine.circuit import CircuitResult, simulate
from pipeline.engine.model import OperatingPoint

FLOTATION_FAMILIES = {"rougher", "gravity_rougher", "deslime_rougher"}


@lru_cache(maxsize=None)
def run_variant(case_id: str, variant_id: str) -> CircuitResult:
    case = CASE_BY_ID[case_id]
    variant = next(v for v in case.variants if v["id"] == variant_id)
    return simulate(case.ore, case.plant, variant_point(case, variant))


def run_point(case_id: str, point: OperatingPoint, unlimited_power: bool = False) -> CircuitResult:
    case = CASE_BY_ID[case_id]
    plant = case.plant
    if unlimited_power:
        plant = replace(plant, mill=replace(plant.mill, installed_power_kw=1.0e12))
    return simulate(case.ore, plant, point)


def all_variants() -> list[tuple[str, str]]:
    return [(case.id, v["id"]) for case in CASES for v in case.variants]


def flotation_cases() -> list[str]:
    return [case.id for case in CASES if case.plant.family in FLOTATION_FAMILIES]
