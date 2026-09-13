"""Case and method registries exposed to pipeline tooling and documentation."""
from __future__ import annotations

from .cases.catalog import CASES
from .io.schema import Case
from .model.process import METHODS

_BY_ID: dict[str, Case] = {case.id: case for case in CASES}


def list_cases() -> list[Case]:
    return list(CASES)


def get_case(case_id: str) -> Case:
    if case_id not in _BY_ID:
        raise KeyError(f"unknown case: {case_id!r}; known: {sorted(_BY_ID)}")
    return _BY_ID[case_id]


def list_categories() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for case in CASES:
        out.setdefault(case.category, []).append(case.id)
    return out


def list_methods() -> list[dict]:
    return [dict(method) for method in METHODS]
