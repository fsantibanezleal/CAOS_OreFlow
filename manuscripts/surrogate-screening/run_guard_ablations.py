"""Run matched optimizer ablations for the surrogate screen's two filters."""
from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "data-pipeline"))
from pipeline.cases.catalog import CASE_BY_ID  # noqa: E402
from pipeline.io.contract import build_contract  # noqa: E402
from pipeline import __version__  # noqa: E402
from pipeline.methods import optimization as optimization  # noqa: E402
from pipeline.methods.screen import Screen  # noqa: E402

CASES = ("copper_porphyry_soft", "copper_porphyry_hard", "iron_magnetite_fine", "gold_free_milling")
POLICIES = ("no_screen", "full", "without_reconstruction_guard", "without_interval_filter", "without_both_filters")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: run_guard_ablations.py <models-directory> <output.json>")
    models = Path(sys.argv[1]).resolve()
    target = Path(sys.argv[2]).resolve()
    Screen(models)  # fail early if the exported model and its Cholesky companion are incomplete
    contract = build_contract()
    digest = hashlib.sha256((models / "process_screen.json").read_bytes()).hexdigest()
    rows = []
    for case_id in CASES:
        case = CASE_BY_ID[case_id]
        cell = {"case": case_id}
        for policy in POLICIES:
            active = None if policy == "no_screen" else Screen(models)
            if active is not None and policy in ("without_reconstruction_guard", "without_interval_filter", "without_both_filters"):
                judge = active.judge

                def ablated(features, _judge=judge, _policy=policy):
                    result = _judge(features)
                    if _policy in ("without_reconstruction_guard", "without_both_filters"):
                        result["guard_error"] = 0.0
                    if _policy in ("without_interval_filter", "without_both_filters"):
                        result["half_width"] = 0.0
                    return result

                active.judge = ablated
            started = time.perf_counter()
            result = optimization.optimize(case, case.nominal, contract, path=False, screen=active)
            optimum = result.get("optimum") or {}
            starts = result.get("starts", [])
            screens = [s.get("screen", {}) for s in starts]
            proposals = [p for s in screens for p in s.get("proposals", [])]
            cell[policy] = {
                "status": result["status"], "evaluations": result["evaluations"],
                "recovered_tph": optimum.get("recovered_tph"),
                "decisions": optimum.get("decisions"),
                "screened_candidates": sum(s.get("screened", 0) for s in screens),
                "guard_rejections": sum(s.get("rejected", {}).get("guard", 0) for s in screens),
                "interval_rejections": sum(s.get("rejected", {}).get("interval", 0) for s in screens),
                "proposals": len(proposals), "improved": sum(bool(p[-1]) for p in proposals),
                "proposal_abs_error_pp": [abs(p[2]-p[1]) for p in proposals if p[2] is not None],
                "seconds": time.perf_counter() - started,
            }
            print(case_id, policy, cell[policy]["evaluations"], cell[policy]["recovered_tph"], flush=True)
        rows.append(cell)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"schema": "oreflow.screen-ablation/v1", "engine_version": __version__,
                                  "screen_sha256": digest, "cases": list(CASES), "policies": list(POLICIES), "rows": rows},
                                 indent=2, allow_nan=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
