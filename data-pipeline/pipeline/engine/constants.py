"""Declared engine constants, atomic weights and mineral data.

The numbers live in ``engine/data/*.json`` with a unit and a source for each entry. Python reads
them here; the TypeScript engine imports the same files, so both engines share one source of
truth. ``scripts/check_units.py`` rejects undeclared numeric literals in the engine modules.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"


@lru_cache(maxsize=None)
def _load(name: str) -> dict[str, Any]:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def constant(key: str) -> Any:
    """Return the declared value of an engine constant (float, int or list)."""
    entry = _load("constants.json")["constants"].get(key)
    if entry is None:
        raise KeyError(f"undeclared engine constant: {key}")
    return entry["value"]


def constants_table() -> dict[str, dict[str, Any]]:
    return dict(_load("constants.json")["constants"])


def atomic_weights() -> dict[str, float]:
    return dict(_load("atomic_weights.json")["weights"])


def oxide_table() -> dict[str, dict[str, str]]:
    return dict(_load("atomic_weights.json")["oxides"])


def mineral_table() -> dict[str, dict[str, Any]]:
    return dict(_load("minerals.json")["minerals"])
