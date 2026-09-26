"""Stage: assemble the benchmark from this run's case records, the oracles and the learning record.

Nothing here is recomputed from files on disk: every number comes from the records produced by the
same bake, so the benchmark cannot mix two engine versions.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

SCHEMA = "oreflow.benchmark/v2"
# the head grade makes the upgrade ratio unit-free across payables; recovered metal and water compare plants
HEADLINE = ("recovery_pct", "concentrate_grade", "head_grade", "recovered_primary_tph", "specific_energy_total_kwh_t",
            "mill_power_kw", "p80_um", "water_intensity_m3_t")


def _case_summary(artifact: dict[str, Any]) -> dict[str, Any]:
    nominal = next(v for v in artifact["variants"] if v["id"] == "nominal")
    metrics = nominal["trace"]["metrics"]
    kpis = {}
    for key, (low, high) in artifact["kpi_ranges"].items():
        value = metrics[key]
        kpis[key] = {"value": value, "range": [low, high], "within": bool(low <= value <= high)}
    variants = {}
    for v in artifact["variants"]:
        m = v["trace"]["metrics"]
        variants[v["id"]] = {**{k: m[k] for k in HEADLINE}, "power_limited": bool(m["power_limited"]),
                             "flags": [f["code"] for f in v["trace"]["flags"]],
                             "balance_max_relative_error": v["trace"]["balance"]["max_relative_error"]}
    return {"case_id": artifact["case_id"], "family": artifact["family"], "category": artifact["category"],
            "kpis": kpis, "variants": variants}


def _kinetics(artifacts: list[dict[str, Any]]) -> dict[str, Any]:
    per_model: dict[str, dict[str, list[float]]] = {}
    for artifact in artifacts:
        for v in artifact["variants"]:
            record = v["trace"]["methods"]["kinetics"]
            if record.get("status") != "computed":
                continue
            for m in record["models"]:
                entry = per_model.setdefault(m["id"], {"lumping": [], "rmse": [], "converged": []})
                entry["lumping"].append(m["lumping_error_pct"])
                entry["rmse"].append(m["rmse_pct"])
                entry["converged"].append(1.0 if m["converged"] else 0.0)
    return {model: {"fits": len(e["rmse"]), "mean_abs_lumping_error_pct": float(np.mean(np.abs(e["lumping"]))),
                    "worst_abs_lumping_error_pct": float(np.max(np.abs(e["lumping"]))),
                    "mean_rmse_pct": float(np.mean(e["rmse"])), "converged_share": float(np.mean(e["converged"]))}
            for model, e in per_model.items()}


def _optimization(artifacts: list[dict[str, Any]]) -> dict[str, Any]:
    out = {}
    for artifact in artifacts:
        rows = {}
        for v in artifact["variants"]:
            record = v["methods"]["optimization"]
            optimum = record.get("optimum")
            rows[v["id"]] = {"status": record["status"], "base_feasible": record["base"]["feasible"],
                             "gain_pct": record.get("gain_pct"), "active": optimum["active"] if optimum else [],
                             "decisions": optimum["decisions"] if optimum else None, "evaluations": record["evaluations"]}
        out[artifact["case_id"]] = rows
    return out


def _uncertainty(artifacts: list[dict[str, Any]]) -> dict[str, Any]:
    out = {}
    for artifact in artifacts:
        nominal = next(v for v in artifact["variants"] if v["id"] == "nominal")
        u = nominal["methods"]["uncertainty"]
        s = nominal["methods"]["sensitivity"]
        dominant = {}
        for output, idx in s["indices"].items():
            if "ST" in idx:
                dominant[output] = max(idx["ST"], key=idx["ST"].get)
        out[artifact["case_id"]] = {
            "recovery_pct": {k: u["outputs"]["recovery_pct"][k] for k in ("p05", "p50", "p95")},
            "concentrate_grade": {k: u["outputs"]["concentrate_grade"][k] for k in ("p05", "p50", "p95")},
            "probabilities": u["probabilities"], "dominant_input": dominant}
    return out


def _lane(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return {"path": path.name, "schema": data.get("schema")}


def build(artifacts: list[dict[str, Any]], oracles: dict[str, Any], learning: dict[str, Any] | None, derived: Path,
          version: str, digest: str) -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "engine_version": version,
        "contract_digest": digest,
        "protocol": ("Twelve authored cases with six single-factor variants each, simulated by the steady-state engine; "
                     "oracles are published examples, not plant data; the learned lane is scored by interpolation and "
                     "leave-one-case-out on engine states."),
        "case_count": len(artifacts),
        "variant_count": sum(len(a["variants"]) for a in artifacts),
        "cases": [_case_summary(a) for a in artifacts],
        "oracles": oracles,
        "kinetics": _kinetics(artifacts),
        "optimization": _optimization(artifacts),
        "uncertainty": _uncertainty(artifacts),
        "learning": None if learning is None else {
            "summary": learning["summary"], "identity": learning["identity"],
            "guard": {k: learning["guard"][k] for k in ("threshold", "false_alarm_rate", "false_accept_rate")},
            "design_rows": learning["design"]["rows"], "device": learning["final"]["mlp_training"]["device"]},
        "lanes": {"particles": _lane(derived / "source" / "hzdr_particle_benchmark.json"),
                  "geomet": _lane(derived / "source" / "geomet_lct_benchmark.json")},
    }
