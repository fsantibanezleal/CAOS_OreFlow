"""Single schema registry used by document and producer/consumer contract tests."""
from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]


def _schema_path(name: str) -> Path:
    matches = list((ROOT / "docs/contracts/schemas").glob(f"{name}.schema.json"))
    if not matches:
        raise OSError(f"unknown contract schema {name!r}")
    return matches[0]


def errors(name: str, document: object) -> list[str]:
    schema = json.loads(_schema_path(name).read_text(encoding="utf-8"))
    return [e.message for e in Draft202012Validator(schema).iter_errors(document)]


def component_errors(name: str, document: object) -> list[str]:
    return errors(name, document)
