"""Single schema registry used by document and producer/consumer contract tests."""
from __future__ import annotations

import json
import math
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
    def invalid_numbers(value: object, at: str = "$") -> list[str]:
        # Python's JSON decoder accepts NaN/Infinity, and JSON Schema's bounds alone
        # do not reject NaN. Match the browser's finite IEEE-754 number boundary.
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            try:
                finite = math.isfinite(value)
            except OverflowError:
                finite = False
            return [] if finite else [f"{at}: number must be finite and JSON-compatible"]
        if isinstance(value, dict):
            return [error for key, item in value.items() for error in invalid_numbers(item, f"{at}.{key}")]
        if isinstance(value, list):
            return [error for index, item in enumerate(value) for error in invalid_numbers(item, f"{at}[{index}]")]
        return []

    return invalid_numbers(document) + [e.message for e in Draft202012Validator(schema).iter_errors(document)]


def component_errors(name: str, document: object) -> list[str]:
    return errors(name, document)
