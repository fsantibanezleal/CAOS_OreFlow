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

import numpy as np
from scipy.optimize import brentq
from scipy.stats import spearmanr

from dataclasses import replace

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


# S-01 to S-09 (review of 2026-10-02, verified forms). The 720 t/h gap is set by the host circuit and an unknown
# laboratory grind, so the record keeps the gap as a curve against the assumed grind with the mill sized for it and
# the flotation residence held at 720 t/h, and states every authored choice beside the effect it has.
ASSUMED_P80_UM = (75.0, 106.0, 150.0, 160.0, 165.0, 170.0, 200.0, 250.0, 300.0)
SIZED_POWER_KW = 1.0e7        # a mill large enough that no sample is power-limited
RATIO_GRID = {"bornite": (0.62, 0.8), "chalcocite_to_bornite": (0.67, 1.0, 1.5, 2.5)}
WORK_INDEX_SHIFT = 2.25       # kWh/t: the nearest-neighbour difference among the comminution samples


def _stats(engine: list[float], measured: list[float]) -> dict[str, float]:
    e, m = np.asarray(engine), np.asarray(measured)
    gap = e - m
    return {"mean_gap_pp": float(gap.mean()), "rmse_pp": float(math.sqrt(float(np.mean(gap ** 2)))),
            "pearson": float(np.corrcoef(e, m)[0, 1]) if e.std() > 0.0 else 0.0,
            "spearman": float(spearmanr(e, m).statistic) if e.std() > 0.0 else 0.0, "engine_sd_pp": float(e.std(ddof=1))}


def sensitivity(samples: list[dict[str, Any]], comminution: list[dict[str, Any]]) -> dict[str, Any]:
    """The comparison's dependence on the host, the assumed grind, the residence and the authored choices."""
    case = CASE_BY_ID[rs.CASE_ID]
    hard = CASE_BY_ID["copper_porphyry_hard"]
    measured = [x["measured_recovery_pct"] for x in samples]
    sized = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=SIZED_POWER_KW))

    def recoveries(p80: float | None = None, plant=None, point_of=None, ore_of=None) -> list[float]:
        out = []
        for x in samples:
            head, wi = x["assays_pct"]["Cu"], x["work_index"]["value"]
            ore = ore_of(x) if ore_of else rs.sample_ore(x["allocation"], head, wi)
            point = point_of(x) if point_of else rs.sample_point(head, wi)
            if p80 is not None:
                point = point.with_values(target_p80_um=p80)
            m = simulate(ore, plant or case.plant, point).metrics
            if plant is sized and m["power_limited"] == 1.0:
                raise ValueError("the sized mill must never be power-limited")
            out.append(m["recovery_pct"])
        return out

    out: dict[str, Any] = {"measured_population_sd_pp": float(np.std(measured)),
                           "labels": {"ratios": "every correlation holds with the declared floatability ratios",
                                      "residence": "the flotation banks keep their volumes, so residence is the 720 t/h residence"}}
    # the gap against the assumed laboratory grind (S-03), the mill sized so the grind is met at 720 t/h
    out["gap_by_assumed_p80"] = [{"p80_um": p, **_stats(recoveries(p, sized), measured)} for p in ASSUMED_P80_UM]
    # the residence share (S-03): each sample at the throughput where the case's own mill reaches 150 um
    target = []
    for x in samples:
        head, wi = x["assays_pct"]["Cu"], x["work_index"]["value"]
        ore = rs.sample_ore(x["allocation"], head, wi)

        def excess(tph: float) -> float:
            m = simulate(ore, case.plant, rs.sample_point(head, wi).with_values(throughput_tph=tph, target_p80_um=150.0)).metrics
            return m["required_mill_power_kw"] / case.plant.mill.installed_power_kw - 1.0
        target.append(brentq(excess, 50.0, case.nominal.throughput_tph, xtol=1e-6))
    at_target = recoveries(150.0, point_of=lambda x: rs.sample_point(x["assays_pct"]["Cu"], x["work_index"]["value"]).with_values(
        throughput_tph=target[samples.index(x)]))
    sized_150 = next(r for r in out["gap_by_assumed_p80"] if r["p80_um"] == 150.0)
    out["target_grind_throughput"] = {"tph": {"min": min(target), "median": float(np.median(target)), "max": max(target)},
                                      **_stats(at_target, measured),
                                      "residence_share_pp": _stats(at_target, measured)["mean_gap_pp"] - sized_150["mean_gap_pp"]}
    # the host (S-01): the hard porphyry's circuit at its own nominal state, the soft ore template kept
    out["hosts"] = {
        "soft_720_record": _stats(recoveries(), measured),
        "hard_nominal": _stats(recoveries(plant=hard.plant, point_of=lambda x: hard.nominal.with_values(
            head_grade=x["assays_pct"]["Cu"], work_index_kwh_t=x["work_index"]["value"])), measured),
        "soft_720_sized_150": sized_150,
    }
    # the authored choices (S-04, S-06, S-07), at 720 t/h and with the mill sized for 150 um
    grid = []
    for bn in RATIO_GRID["bornite"]:
        for cc in RATIO_GRID["chalcocite_to_bornite"]:
            ore_of = (lambda bn_, cc_: lambda x: rs.sample_ore(x["allocation"], x["assays_pct"]["Cu"], x["work_index"]["value"], bn_, cc_))(bn, cc)
            grid.append({"bornite": bn, "chalcocite_to_bornite": cc, "at_720": _stats(recoveries(ore_of=ore_of), measured),
                         "sized_150": _stats(recoveries(150.0, sized, ore_of=ore_of), measured)})
    out["ratio_grid"] = grid
    alternative = {x["id"]: rs.allocate_alternative(x["assays_pct"]["Cu"] * 1e4, x["assays_pct"]["S"] * 1e4, x["assays_pct"]["Fe"] * 1e4) for x in samples}
    alt_ore = lambda x: rs.sample_ore(alternative[x["id"]], x["assays_pct"]["Cu"], x["work_index"]["value"])  # noqa: E731
    no_mag = lambda x: rs.sample_ore(x["allocation"], x["assays_pct"]["Cu"], x["work_index"]["value"], drop_magnetite=True)  # noqa: E731
    out["allocation_alternative"] = {"at_720": _stats(recoveries(ore_of=alt_ore), measured),
                                     "sized_150": _stats(recoveries(150.0, sized, ore_of=alt_ore), measured)}
    out["no_magnetite"] = {"at_720": _stats(recoveries(ore_of=no_mag), measured), "sized_150": _stats(recoveries(150.0, sized, ore_of=no_mag), measured)}
    # the work index (S-09): a uniform bias against the assignment's alternatives
    values = sorted(c["work_index_kwh_t"] for c in comminution)
    median = float(np.median(values))

    def with_wi(f):
        def point(x):
            return rs.sample_point(x["assays_pct"]["Cu"], f(x))

        def ore(x):
            return rs.sample_ore(x["allocation"], x["assays_pct"]["Cu"], f(x))
        return point, ore

    def nearest_any(x):
        return min(comminution, key=lambda c: (math.dist(c["xyz"], x["xyz"]), c["source_row"]))["work_index_kwh_t"]

    runs = {}
    for name, f in (("deposit_median_for_all", lambda x: median), ("global_nearest", nearest_any),
                    ("all_minus_shift", lambda x: x["work_index"]["value"] - WORK_INDEX_SHIFT),
                    ("all_plus_shift", lambda x: x["work_index"]["value"] + WORK_INDEX_SHIFT)):
        point, ore = with_wi(f)
        runs[name] = recoveries(point_of=point, ore_of=ore)
    base = recoveries()
    per_kwh = [(p - m) / (2.0 * WORK_INDEX_SHIFT) for p, m in zip(runs["all_plus_shift"], runs["all_minus_shift"])]
    out["work_index"] = {"shift_kwh_t": WORK_INDEX_SHIFT,
                         **{name: {"mean_gap_pp": float(np.mean(np.asarray(v) - np.asarray(measured)))} for name, v in runs.items()},
                         "recovery_per_kwh_t_median": float(np.median(per_kwh)),
                         "pearson_recovery_work_index_720": float(np.corrcoef(base, [x["work_index"]["value"] for x in samples])[0, 1])}
    return out


def build(derived: Path, version: str, digest: str, with_sensitivity: bool = True) -> dict[str, Any]:
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
        "sensitivity": sensitivity(samples, comminution) if with_sensitivity else None,
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
