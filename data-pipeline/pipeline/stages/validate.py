"""Stage 8: scientific and artifact-level validation before release."""
from __future__ import annotations

from pathlib import Path
import json


def run(derived_dir: str | Path, expected_cases: int = 12, expected_variants: int = 72, expected_methods: int = 19) -> dict:
    root = Path(derived_dir)
    index = json.loads((root / "manifests" / "index.json").read_text(encoding="utf-8"))
    matrix = json.loads((root / "metrics" / "matrix.json").read_text(encoding="utf-8"))
    mass_balance: list[float] = []
    for entry in index["cases"]:
        artifact = json.loads((root / entry["artifact_path"]).read_text(encoding="utf-8"))
        for variant in artifact["variants"]:
            mass_balance.append(float(variant["metrics"]["metal_balance_pct"]))
    checks = {"case_count": index.get("n_cases") == expected_cases, "variant_count": index.get("n_variants") == expected_variants,
              "method_cells": len(matrix.get("rows", [])) == expected_variants * expected_methods,
              "mass_balance": bool(mass_balance) and max(abs(v - 100.0) for v in mass_balance) <= 1e-8}
    result = {"schema": "oreflow.validation/v1", "checks": checks, "status": "passed" if all(checks.values()) else "failed",
              "max_mass_balance_error_pct": max(abs(v - 100.0) for v in mass_balance) if mass_balance else None}
    (root / "validation.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if result["status"] != "passed":
        raise RuntimeError(f"validation failed: {checks}")
    return result
