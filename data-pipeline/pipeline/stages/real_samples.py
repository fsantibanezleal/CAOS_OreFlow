"""Stage: the real-sample record (RS-01 to RS-05).

Every usable GeoMet locked-cycle sample runs through the soft porphyry's circuit on its own ore (the normative
mineralogy of its assays) and work index, at the case's nominal operating point. The record keeps, per sample, the
ore and the point the browser needs to repeat the run (RS-06), the engine's metrics and flags, the measured
locked-cycle recovery, and the GeoMet lane's out-of-fold predictions for the same sample (hole folds). The
difference between the engine and the measurement is a comparison of a simulated plant with a laboratory
locked-cycle test, not a calibration: nothing in the engine is fitted to these samples.
"""
from __future__ import annotations

import json
import math
import statistics
from dataclasses import asdict
from pathlib import Path
from typing import Any

from ..cases import real_samples as rs
from ..cases.catalog import CASE_BY_ID
from ..engine.circuit import simulate
from ..engine.constants import constant

SCHEMA = "oreflow.real_samples/v1"
HEADLINE = ("recovery_pct", "concentrate_grade", "p80_um", "specific_energy_total_kwh_t", "mill_power_kw", "mass_pull_pct")


def _geomet_predictions(derived: Path) -> dict[int, dict[str, Any]]:
    path = derived / "source" / "geomet_lct_benchmark.json"
    lane = json.loads(path.read_text(encoding="utf-8"))
    return {int(row["source_row"]): {"fold": row["fold"], "predictions_pct": row["predictions_pct"]}
            for row in lane["protocols"]["hole"]["rows"]}


def build(derived: Path, version: str, digest: str) -> dict[str, Any]:
    comminution, excluded_c = rs.comminution_samples()
    samples, excluded_f = rs.locked_cycle_samples(comminution)
    lane = _geomet_predictions(derived)
    case = CASE_BY_ID[rs.CASE_ID]
    rows = []
    for s in samples:
        ore = rs.sample_ore(s["allocation"], s["assays_pct"]["Cu"], s["work_index"]["value"])
        point = rs.sample_point(s["assays_pct"]["Cu"], s["work_index"]["value"])
        result = simulate(ore, case.plant, point)
        rows.append({**s, "ore": asdict(ore), "point": asdict(point), "metrics": result.metrics,
                     "flags": [f["code"] for f in result.flags],
                     "balance_error": result.balance["max_relative_error"],
                     "geomet_lane": lane.get(s["source_row"])})
    diffs = [r["metrics"]["recovery_pct"] - r["measured_recovery_pct"] for r in rows]
    lane_rows = [r for r in rows if r["geomet_lane"]]
    lane_diffs = {m: [r["geomet_lane"]["predictions_pct"][m] - r["measured_recovery_pct"] for r in lane_rows]
                  for m in (lane_rows[0]["geomet_lane"]["predictions_pct"] if lane_rows else {})}

    def rmse(values: list[float]) -> float:
        return math.sqrt(sum(v * v for v in values) / len(values))

    return {
        "schema": SCHEMA, "engine_version": version, "contract_digest": digest, "case_id": rs.CASE_ID,
        "source": {"title": "GeoMet dataset", "record": rs.RECORD, "doi": "10.5281/zenodo.7051975",
                   "paper_doi": "10.1007/s11004-022-10013-1", "license": "CC BY 4.0",
                   "tables": {name: {"file": pin["file"].replace("geomet-", ""), "md5": pin["md5"], "sha256": pin["sha256"]}
                              for name, pin in rs.SOURCES.items()}},
        "labels": {
            "bond_columns": "inferred from the Bond test (the paper is paywalled): A the closing screen, M the grindability, F80 and P80",
            "allocation": "assumption: sulphur-limited normative mineralogy in moles",
            "magnetite": "assumption: the iron left after the sulphides; the assays do not identify it",
            "authored": "the circuit, the breakage, the liberation and the flotation parameters are the soft porphyry's; "
                        "bornite and chalcocite float at declared ratios to chalcopyrite",
            "comparison": "a simulated plant at the case's operating point against a laboratory locked-cycle test, not a calibration",
        },
        "floatability_ratios": {"bornite": float(constant("minerals.bornite_floatability_ratio")),
                                "chalcocite_to_bornite": float(constant("minerals.chalcocite_to_bornite_floatability_ratio"))},
        "plant": asdict(case.plant),
        "comminution": comminution,
        "excluded": excluded_c + excluded_f,
        "samples": rows,
        "summary": {
            "samples": len(rows), "comminution_samples": len(comminution),
            "work_index_kwh_t": {"min": min(c["work_index_kwh_t"] for c in comminution),
                                 "max": max(c["work_index_kwh_t"] for c in comminution),
                                 "median": statistics.median(c["work_index_kwh_t"] for c in comminution)},
            "bands": {band: sum(1 for r in rows if r["allocation"]["band"] == band)
                      for band in ("chalcopyrite_pyrite", "chalcopyrite_bornite", "bornite_chalcocite")},
            "work_index_assignment": {how: sum(1 for r in rows if r["work_index"]["how"] == how) for how in ("nearest_in_hole", "deposit_median")},
            "engine_minus_measured_pp": {"mean": sum(diffs) / len(diffs), "rmse": rmse(diffs), "min": min(diffs), "max": max(diffs)},
            "geomet_lane_minus_measured_pp": {m: {"mean": sum(v) / len(v), "rmse": rmse(v)} for m, v in lane_diffs.items()},
            "power_limited": sum(1 for r in rows if r["metrics"]["power_limited"] == 1.0),
        },
    }
