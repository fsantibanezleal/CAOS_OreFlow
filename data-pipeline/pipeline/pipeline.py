"""OreFlow bake: contract, cases, learning, benchmark, manifests and validation (design section 11a).

The index and the benchmark are built from this run's records only, never from files already on
disk, so a partial bake cannot ship as complete; the bake ends by running the artifact checks and
fails if any fails.
"""
from __future__ import annotations

import argparse
import faulthandler
import hashlib
import importlib.util
import json
import multiprocessing
import os
import time
import warnings
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from . import __version__
from .cases.catalog import CASES
from .io.contract import export_contract

REPO_ROOT = Path(__file__).resolve().parents[2]
DERIVED = REPO_ROOT / "data" / "derived"
MODELS = REPO_ROOT / "models"
STAGES = ("contract", "cases", "learning", "benchmark", "manifests", "validation")
HEADLINE = ("recovery_pct", "concentrate_grade", "specific_energy_total_kwh_t", "p80_um", "mill_power_kw")


def _log(message: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


def write_json(path: Path, document: Any) -> tuple[int, str]:
    data = json.dumps(document, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return len(data), hashlib.sha256(data).hexdigest()


def _bake(args: tuple[str, dict[str, Any], str]) -> dict[str, Any]:
    from .stages.cases import bake_case

    return bake_case(*args)


def _checker():
    spec = importlib.util.spec_from_file_location("check_artifacts", REPO_ROOT / "scripts" / "check_artifacts.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_all(output: Path | None = None, models: Path | None = None, workers: int | None = None) -> dict[str, Any]:
    from .methods import learning, oracles
    from .stages import benchmark

    derived = Path(output) if output else DERIVED
    models_dir = Path(models) if models else MODELS
    timings: dict[str, float] = {}

    t = time.perf_counter()
    contract = export_contract(derived / "contract" / "operating_contract.json", derived / "contract" / "contract_probes.json")
    digest = contract["digest"]
    timings["contract"] = time.perf_counter() - t

    t = time.perf_counter()
    ids = [case.id for case in CASES]
    workers = workers or min(len(ids), max(1, (os.cpu_count() or 2) // 2))
    for variable in ("OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "OMP_NUM_THREADS"):
        os.environ.setdefault(variable, "1")   # small dense solves: one thread per worker process
    jobs = [(case_id, contract, __version__) for case_id in ids]
    _log(f"cases: {len(jobs)} cases on {workers} worker(s)")
    by_id: dict[str, dict[str, Any]] = {}
    if workers > 1:
        with ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context("spawn")) as pool:
            futures = {pool.submit(_bake, job): job[0] for job in jobs}
            for future in as_completed(futures):
                by_id[futures[future]] = future.result()
                _log(f"  case {futures[future]} baked ({len(by_id)}/{len(jobs)}, {time.perf_counter() - t:.0f}s)")
    else:
        for job in jobs:
            by_id[job[0]] = _bake(job)
            _log(f"  case {job[0]} baked ({len(by_id)}/{len(jobs)}, {time.perf_counter() - t:.0f}s)")
    artifacts = [by_id[case_id] for case_id in ids]     # catalog order, whatever the completion order
    timings["cases"] = time.perf_counter() - t

    t = time.perf_counter()
    _log("learning: design, protocols and exports")
    record = learning.run(contract, models_dir)
    record["engine_version"], record["contract_digest"] = __version__, digest
    write_json(derived / "learning.json", record)
    timings["learning"] = time.perf_counter() - t

    _log(f"learning done ({time.perf_counter() - t:.0f}s)")
    t = time.perf_counter()
    bench = benchmark.build(artifacts, oracles.all_oracles(), record, derived, __version__, digest)
    write_json(derived / "benchmark.json", bench)
    timings["benchmark"] = time.perf_counter() - t

    t = time.perf_counter()
    # every catalog case is rewritten below; a case the catalog no longer has must not ship from an older bake
    produced = {artifact["case_id"] for artifact in artifacts}
    for folder in ("cases", "manifests"):
        for stale in sorted((derived / folder).glob("*.json")):
            if stale.stem not in produced and stale.name != "index.json":
                _log(f"  removing stale {folder}/{stale.name}")
                stale.unlink()
    entries = []
    for artifact in artifacts:
        rel = f"cases/{artifact['case_id']}.json"
        size, sha = write_json(derived / rel, artifact)
        nominal = artifact["variants"][0]["trace"]["metrics"]
        manifest = {
            "schema": "oreflow.manifest/v2", "case_id": artifact["case_id"], "category": artifact["category"],
            "family": artifact["family"], "title": artifact["title"], "engine_version": __version__, "contract_digest": digest,
            "artifact": {"path": rel, "bytes": size, "sha256": sha, "schema": artifact["schema"]},
            "variants": [v["id"] for v in artifact["variants"]],
            "nominal": {key: nominal[key] for key in HEADLINE},
            "kpis": {key: {"value": nominal[key], "range": list(r), "within": bool(r[0] <= nominal[key] <= r[1])}
                     for key, r in artifact["kpi_ranges"].items()},
        }
        write_json(derived / "manifests" / f"{artifact['case_id']}.json", manifest)
        entries.append({"case_id": artifact["case_id"], "category": artifact["category"], "family": artifact["family"],
                        "title": artifact["title"], "manifest_path": f"manifests/{artifact['case_id']}.json",
                        "artifact_path": rel, "variants": len(artifact["variants"])})
    index = {"schema": "oreflow.index/v2", "engine_version": __version__, "contract_digest": digest,
             "n_cases": len(entries), "n_variants": sum(e["variants"] for e in entries), "cases": entries}
    write_json(derived / "manifests" / "index.json", index)
    timings["manifests"] = time.perf_counter() - t

    t = time.perf_counter()
    _log("validation: artifact checks")
    errors = _checker().run(derived, models_dir)
    timings["validation"] = time.perf_counter() - t
    validation = {"schema": "oreflow.validation/v2", "engine_version": __version__, "contract_digest": digest,
                  "passed": not errors, "errors": errors, "stages": list(STAGES), "workers": workers,
                  "seconds": timings}
    write_json(derived / "validation.json", validation)
    if errors:
        raise SystemExit("bake failed validation:\n" + "\n".join(f"  - {e}" for e in errors[:50]))
    return validation


def main() -> None:
    parser = argparse.ArgumentParser(prog="oreflow.pipeline", description="Bake every OreFlow artifact.")
    parser.add_argument("--output", type=Path, help="sandbox derived directory (default data/derived)")
    parser.add_argument("--models", type=Path, help="sandbox models directory (default models)")
    parser.add_argument("--workers", type=int, help="case worker processes (default half the cores, at most 12)")
    args = parser.parse_args()
    # joblib probes physical cores with a Windows tool that may be absent and falls back to logical cores
    warnings.filterwarnings("ignore", message="Could not find the number of physical cores", category=UserWarning)
    # a bake that is still running after 45 minutes prints every thread's stack once, so a stall shows its place
    faulthandler.dump_traceback_later(45 * 60, exit=False)
    result = run_all(args.output, args.models, args.workers)
    faulthandler.cancel_dump_traceback_later()
    print(f"oreflow bake {__version__}: stages {' -> '.join(STAGES)}; "
          + ", ".join(f"{k} {v:.0f}s" for k, v in result["seconds"].items()) + "; validation passed")
