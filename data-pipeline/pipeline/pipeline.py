"""Explicit OreFlow pipeline: ingest -> dataset -> features -> train -> infer -> evaluate -> export -> validate."""
from __future__ import annotations

import argparse
import time
from pathlib import Path

from . import registry
from .core.manifest import build_index
from .core.trace import build_trace
from .io.formats import write_json
from .model.process import METHODS, variant_params
from .stages import evaluate, export, feature_extraction, infer, preprocess, train, validate

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW = REPO_ROOT / "data" / "raw"
DERIVED = REPO_ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"
MODELS = REPO_ROOT / "models"
STAGES = ("preprocess", "dataset", "feature_extraction", "train", "infer", "evaluate", "export", "validate")


def _params_dict(p) -> dict:
    return {name: getattr(p, name) for name in ("feed_tph", "feed_grade_pct", "feed_p80_um", "hardness_kwh_t", "density_t_m3", "grind_p80_um", "classifier_cut_um", "flotation_time_min", "air_rate_m3_min", "reagent_gpt", "water_m3_t")}


def _variant_payload(case, variant, bundle):
    p = variant_params(case.params, variant["overrides"], f"{case.id}:{variant['id']}")
    if p.grind_p80_um >= p.feed_p80_um:
        p = variant_params(p, {"grind_p80_um": p.feed_p80_um * 0.25}, p.case_id)
    result = infer.run(p, bundle)
    return {"id": variant["id"], "label": variant["label"], "params": _params_dict(p), "trace": build_trace(result), "metrics": result.metrics, "method_outputs": result.method_outputs}


def run_all(seed: int = 42, output_root: str | Path | None = None) -> list[dict]:
    derived = Path(output_root).resolve() if output_root else DERIVED
    manifests = derived / "manifests"
    models = (derived / "models") if output_root else MODELS
    raw = (REPO_ROOT / "data" / "raw")
    source = preprocess.run(raw, derived)
    dataset = feature_extraction.run(seed=seed, samples=720)
    write_json(derived / "features.json", dataset)
    bundle = train.run(dataset, models, seed=seed)
    evaluation = evaluate.run(bundle, seed=seed)
    entries = []
    matrix_rows = []
    started = time.perf_counter()
    for case in registry.list_cases():
        variant_payloads = [_variant_payload(case, variant, bundle) for variant in case.variants]
        for payload in variant_payloads:
            for method in payload["method_outputs"]:
                matrix_rows.append({"case_id": case.id, "category": case.category, "variant_id": payload["id"], "method_id": method["id"], "tier": method["tier"], "value": method["value"], "unit": method["unit"]})
        export.run_case(case=case, variants=variant_payloads, seed=seed, run_ms=(time.perf_counter() - started) * 1000.0,
                        metrics={"nominal": variant_payloads[0]["metrics"], "evaluation": evaluation}, derived_dir=derived, manifests_dir=manifests)
        entries.append({"case_id": case.id, "category": case.category, "title": case.title, "manifest_path": f"manifests/{case.id}.json", "artifact_path": f"cases/{case.id}.json", "variants": len(variant_payloads), "methods": len(METHODS)})
    write_json(manifests / "index.json", build_index(entries))
    write_json(derived / "metrics" / "matrix.json", {"schema": "oreflow.metrics/v1", "rows": matrix_rows, "methods": list(METHODS), "evaluation": evaluation})
    benchmark = {"schema": "oreflow.benchmark/v1", "protocol": "12 cases x 6 variants x 19 methods; truth is the declared process simulator; test set is disjoint parameter perturbations",
                 "case_count": len(entries), "variant_count": sum(e["variants"] for e in entries), "method_count": len(METHODS),
                 "source": source, "evaluation": evaluation, "method_matrix_path": "metrics/matrix.json", "compute": bundle["registry"]["compute"]}
    write_json(derived / "benchmark.json", benchmark)
    validate.run(derived)
    return entries


def precompute(case_id: str, seed: int = 42, output_root: str | Path | None = None) -> dict:
    # A single-case invocation still trains from the same complete design split,
    # ensuring its learned result is never fitted on that case's baked output.
    all_entries = run_all(seed=seed, output_root=output_root)
    return next(e for e in all_entries if e["case_id"] == case_id)


def main() -> None:
    ap = argparse.ArgumentParser(prog="oreflow.pipeline")
    ap.add_argument("case", nargs="?", default="all", help="case id, or all")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--output", type=Path, help="sandbox output root")
    args = ap.parse_args()
    entries = run_all(seed=args.seed, output_root=args.output) if args.case == "all" else [precompute(args.case, args.seed, args.output)]
    print(f"oreflow pipeline: {len(entries)} case(s), stages={' -> '.join(STAGES)}")
    for e in entries:
        print(f"  {e['case_id']:24s} {e['variants']} variants x {e['methods']} methods")
