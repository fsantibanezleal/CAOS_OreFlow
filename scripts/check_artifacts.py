#!/usr/bin/env python3
"""Validate the complete OreFlow artifact and coverage contract."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"


def main() -> int:
    index_path = MANIFESTS / "index.json"
    errors: list[str] = []
    if not index_path.exists():
        print(f"FAIL: missing {index_path}")
        return 1
    index = json.loads(index_path.read_text(encoding="utf-8"))
    if index.get("n_cases") != 12 or index.get("n_variants") != 72:
        errors.append(f"index coverage is {index.get('n_cases')} cases / {index.get('n_variants')} variants")
    for entry in index.get("cases", []):
        manifest_path = DERIVED / entry["manifest_path"]
        if not manifest_path.exists():
            errors.append(f"missing manifest: {manifest_path}")
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        artifact = DERIVED / manifest["artifact"]["path"]
        if not artifact.exists():
            errors.append(f"missing artifact: {artifact}")
            continue
        size = artifact.stat().st_size
        if size != manifest["artifact"]["bytes"]:
            errors.append(f"byte drift: {artifact}")
        if not size:
            errors.append(f"empty artifact: {artifact}")
        if manifest.get("lane") != manifest.get("gate", {}).get("lane"):
            errors.append(f"lane mismatch: {entry['case_id']}")
        data = json.loads(artifact.read_text(encoding="utf-8"))
        if len(data.get("variants", [])) != 6:
            errors.append(f"variant coverage: {entry['case_id']}")
        for variant in data.get("variants", []):
            methods = variant.get("method_outputs", [])
            if len(methods) != 21 or len({method.get("id") for method in methods}) != 21:
                errors.append(f"method coverage: {entry['case_id']}:{variant.get('id')}")
            if any(method.get("status") not in {"precomputed", "not-applicable", "unavailable"} for method in methods):
                errors.append(f"method status: {entry['case_id']}:{variant.get('id')}")
    matrix_path = DERIVED / "metrics" / "matrix.json"
    if not matrix_path.exists():
        errors.append("missing metrics/matrix.json")
    else:
        matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
        if len(matrix.get("rows", [])) != 12 * 6 * 21:
            errors.append(f"matrix rows {len(matrix.get('rows', []))}, expected 1512")
    particle_path = DERIVED / "source" / "hzdr_particle_benchmark.json"
    particle_onnx = ROOT / "models" / "particle_mlp.onnx"
    if not particle_path.is_file() or not particle_onnx.is_file():
        errors.append("missing HZDR particle benchmark or executable ONNX model")
    else:
        particle = json.loads(particle_path.read_text(encoding="utf-8"))
        protocol = particle.get("protocol", {})
        if particle.get("schema") != "oreflow.particle-benchmark/v1":
            errors.append("particle benchmark schema")
        if (protocol.get("train_rows"), protocol.get("test_rows")) != (68008, 29147):
            errors.append("particle train/test population")
        if len(protocol.get("features", [])) != 4 or len(particle.get("standardization", {}).get("mean", [])) != 4:
            errors.append("particle feature standardization")
        cases = particle.get("cases", [])
        if len(cases) != 4 or {case.get("case") for case in cases} != {"1", "2", "3", "4"}:
            errors.append("particle case coverage")
        for case in cases:
            if case.get("test_rows", 0) + case.get("excluded_test_rows", 0) != 29147:
                errors.append(f"particle comparable population: {case.get('case')}")
            for model_id in ("published_reference", "l1_logistic", "particle_mlp"):
                model = case.get("models", {}).get(model_id, {})
                if not all(math.isfinite(model.get(metric, float("nan"))) for metric in ("rmse", "mae", "bias")):
                    errors.append(f"particle metric: {case.get('case')}:{model_id}")
                thresholds = model.get("thresholds", [])
                if len(thresholds) != 101 or any(abs(row["threshold"] - i / 100) > 1e-9 for i, row in enumerate(thresholds)):
                    errors.append(f"particle thresholds: {case.get('case')}:{model_id}")
                elif any(thresholds[i + 1][field] > thresholds[i][field] + 1e-5 for field in ("selected_fraction", "expected_recovery") for i in range(100)):
                    errors.append(f"nonmonotone particle threshold: {case.get('case')}:{model_id}")
                if sum(row.get("count", 0) for row in model.get("calibration", [])) != case.get("test_rows"):
                    errors.append(f"particle calibration population: {case.get('case')}:{model_id}")
    if errors:
        print("CONTRACT 2 DRIFT:")
        print("\n".join(f"  - {error}" for error in errors))
        return 1
    print("CONTRACT 2 OK: 12 cases, 72 variants, 1512 method records; 4 HZDR particle experiments and ONNX model.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
