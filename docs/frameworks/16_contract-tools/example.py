"""Validate real producer records and reject two nested mutations without changing artifacts."""
from __future__ import annotations

import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[3]


def load(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def check(name: str, relative: str, path: tuple[str, ...]) -> None:
    schema = load(f"docs/contracts/schemas/oreflow-{name}-v1.schema.json")
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    original = load(relative)
    validator.validate(original)
    malformed = copy.deepcopy(original)
    parent = malformed
    for key in path[:-1]:
        parent = parent[key]
    parent[path[-1]] = "invalid numeric value"
    errors = list(validator.iter_errors(malformed))
    assert errors, f"nested mutation was accepted: {name}"
    assert any(tuple(error.absolute_path) == path for error in errors), errors
    assert original != malformed
    validator.validate(original)
    print(f"{name}: shipped record accepted; nested mutation rejected at /{'/'.join(path)}")


if __name__ == "__main__":
    contract = load("data/derived/contract/operating_contract.json")
    case_id = next(iter(contract["cases"]))
    input_id = next(iter(contract["cases"][case_id]["inputs"]))
    check("contract", "data/derived/contract/operating_contract.json", ("cases", case_id, "inputs", input_id, "min"))
    check("learning", "data/derived/learning.json", ("interpolation", "models", "ridge", "recovery_pct", "rmse"))
