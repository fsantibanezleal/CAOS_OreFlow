"""Read-only access to compact derived artifacts with a traversal guard."""
from __future__ import annotations

import json
from pathlib import Path

from ..config import REPO_ROOT, Settings


def _derived() -> Path:
    return (REPO_ROOT / Settings().data_dir).resolve()


def load_json(rel: str) -> dict | None:
    root = _derived()
    target = (root / rel).resolve()
    if root not in target.parents and target != root:
        return None
    try:
        return json.loads(target.read_text(encoding="utf-8")) if target.exists() else None
    except (OSError, json.JSONDecodeError):
        return None


def load_index() -> dict:
    return load_json("manifests/index.json") or {"schema": "oreflow.index/v2", "cases": []}


def load_manifest(case_id: str) -> dict | None:
    return load_json(f"manifests/{case_id}.json")
