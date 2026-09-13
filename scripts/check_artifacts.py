#!/usr/bin/env python3
"""Validate the complete OreFlow artifact and coverage contract."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"


def main() -> int:
    index_path = MANIFESTS / "index.json"
    errors: list[str] = []
    if not index_path.exists():
        print(f"FAIL: missing {index_path}"); return 1
    index = json.loads(index_path.read_text(encoding="utf-8"))
    if index.get("n_cases") != 12 or index.get("n_variants") != 72:
        errors.append(f"index coverage is {index.get('n_cases')} cases / {index.get('n_variants')} variants")
    for entry in index.get("cases", []):
        manifest_path = DERIVED / entry["manifest_path"]
        if not manifest_path.exists(): errors.append(f"missing manifest: {manifest_path}"); continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        artifact = DERIVED / manifest["artifact"]["path"]
        if not artifact.exists(): errors.append(f"missing artifact: {artifact}"); continue
        size = artifact.stat().st_size
        if size != manifest["artifact"]["bytes"]: errors.append(f"byte drift: {artifact}")
        if not size: errors.append(f"empty artifact: {artifact}")
        if manifest.get("lane") != manifest.get("gate", {}).get("lane"): errors.append(f"lane mismatch: {entry['case_id']}")
        data = json.loads(artifact.read_text(encoding="utf-8"))
        if len(data.get("variants", [])) != 6: errors.append(f"variant coverage: {entry['case_id']}")
        for variant in data.get("variants", []):
            if len(variant.get("method_outputs", [])) != 19: errors.append(f"method coverage: {entry['case_id']}:{variant.get('id')}")
    matrix_path = DERIVED / "metrics" / "matrix.json"
    if not matrix_path.exists(): errors.append("missing metrics/matrix.json")
    else:
        matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
        if len(matrix.get("rows", [])) != 12 * 6 * 19: errors.append(f"matrix rows {len(matrix.get('rows', []))}, expected 1368")
    if errors:
        print("CONTRACT 2 DRIFT:"); print("\n".join(f"  - {error}" for error in errors)); return 1
    print("CONTRACT 2 OK: 12 cases, 72 variants, 1368 method cells and manifests consistent."); return 0


if __name__ == "__main__": sys.exit(main())
