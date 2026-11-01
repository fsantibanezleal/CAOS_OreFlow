#!/usr/bin/env python3
"""Collect same-release simulator evidence without importing the training stack."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import statistics
import sys
import types
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
MODEL_NAMES = {"ridge": "Ridge regression", "random_forest": "Random forest",
               "hist_gradient_boosting": "Histogram gradient boosting", "gaussian_process": "Gaussian process",
               "mlp": "Multilayer perceptron"}
TARGET_UNITS = {"recovery_pct": "percentage points", "log_upgrade": "log ratio (dimensionless)",
                "specific_energy_total_kwh_t": "kWh/t"}


def _require(condition, path, message):
    if not condition:
        raise ValueError(f"{path}: {message}")


def _integer(value, path, minimum=0):
    _require(type(value) is int and value >= minimum, path, f"integer >= {minimum} required")
    return value


def _fields(value, fields, path):
    _require(isinstance(value, dict), path, "object required")
    _require(set(fields).issubset(value), path, f"missing fields: {sorted(set(fields)-set(value))}")


def _number(value, path, minimum=None, maximum=None):
    valid = type(value) in (int, float)
    try:
        valid = valid and math.isfinite(value)
    except OverflowError:
        valid = False
    _require(valid, path, "finite number required")
    _require(minimum is None or value >= minimum, path, f"number below {minimum}")
    _require(maximum is None or value <= maximum, path, f"number above {maximum}")
    return value


def _finite_tree(value, path):
    if isinstance(value, dict):
        for key, child in value.items():
            _finite_tree(child, f"{path}/{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _finite_tree(child, f"{path}/{index}")
    elif type(value) in (int, float):
        _number(value, path)


def _pairs(pairs):
    value = {}
    for key, child in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON key {key!r}")
        value[key] = child
    return value


def _constant(value):
    raise ValueError(f"nonfinite JSON constant {value}")


def _parse(data, path):
    try:
        value = json.loads(data, object_pairs_hook=_pairs, parse_constant=_constant)
        _finite_tree(value, path)
        _require(isinstance(value, dict), path, "JSON object required")
        return value
    except (ValueError, UnicodeError) as exc:
        raise ValueError(f"{path}: {exc}") from exc


def _same(actual, expected, path):
    if expected is None or isinstance(expected, (str, bool)):
        okay = actual == expected and type(actual) is type(expected)
    elif isinstance(expected, (int, float)):
        okay = type(actual) in (int, float) and math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10)
    elif isinstance(expected, list):
        _require(isinstance(actual, list) and len(actual) == len(expected), path, "inconsistent list coverage")
        for index, (a, b) in enumerate(zip(actual, expected)):
            _same(a, b, f"{path}/{index}")
        return
    else:
        _require(isinstance(actual, dict) and set(actual) == set(expected), path, "inconsistent field coverage")
        for key in expected:
            _same(actual[key], expected[key], f"{path}/{key}")
        return
    _require(okay, path, f"inconsistent persisted value; expected {expected!r}, got {actual!r}")


def _aggregate(scores):
    accepted = [score for score in scores if score["valid_for_scoring"]]
    return {"attempted": len(scores), "scored": len(accepted), "rejected": len(scores)-len(accepted),
            "rmse_mean": statistics.mean(s["rmse"] for s in accepted) if accepted else None,
            "rmse_max": max(s["rmse"] for s in accepted) if accepted else None,
            "r2_median": statistics.median(s["r2"] for s in accepted) if accepted else None}


def _score_bounds(value, path):
    if isinstance(value, dict):
        if {"rmse", "mae", "r2", "rows", "valid_for_scoring"}.issubset(value) and value["valid_for_scoring"]:
            _number(value["rmse"], path + "/rmse", 0)
            _number(value["mae"], path + "/mae", 0, value["rmse"] + 1e-10)
            _number(value["r2"], path + "/r2", maximum=1)
        for key, child in value.items():
            _score_bounds(child, path + "/" + key)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _score_bounds(child, path + "/" + str(index))


def _support():
    modules = []
    provenance = []
    for relative in ["data-pipeline/pipeline/methods/observable.py", "scripts/check_artifacts.py",
                     "docs/contracts/schemas/oreflow-learning-v2.schema.json",
                     "data-pipeline/pipeline/engine/data/constants.json", "scripts/collect_results.py"]:
        path = ROOT / relative
        data = path.read_bytes()
        provenance.append({"path": relative, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
        if relative in ("data-pipeline/pipeline/methods/observable.py", "scripts/check_artifacts.py"):
            module = types.ModuleType("_result_" + path.stem)
            module.__file__ = str(path)
            exec(compile(data, str(path), "exec"), module.__dict__)
            modules.append(module)
        elif relative.endswith("constants.json"):
            constants = _parse(data, relative)["constants"]
    return modules[0], modules[1], constants, provenance


def _learning(record, case_ids, observable, checker, constants):
    where = "learning.json"
    for key in ("features", "targets", "models", "design", "settings", "identity", "interpolation", "guard",
                "leave_one_case_out", "transfer_groups", "leave_one_group_out", "equal_rows", "mlp_seeds", "summary",
                "common_cohorts", "final", "seconds"):
        _require(key in record, where + "/" + key, "required v2 field is missing")
    _require(record.get("reused", False) is False, where, "reused learning cannot supply fresh release results")
    _require(record["models"] == list(MODEL_NAMES), where, "unexpected model catalog")
    _require(record["targets"] == list(TARGET_UNITS), where, "unexpected target catalog")
    design = record["design"]
    _same(design["cases"], case_ids, where + "/design/cases")
    per_case = _integer(design["per_case"], where + "/design/per_case", 1)
    _integer(design["rows"], where + "/design/rows", 1)
    _same(design["rows"], per_case * len(case_ids), where + "/design/rows")
    seed = _integer(design["seed"], where + "/design/seed")
    groups = record["transfer_groups"]
    _require(set(groups) == set(case_ids) and all(isinstance(g, str) and g.strip() for g in groups.values()),
             where, "transfer group membership does not cover the case catalog")
    loco = record["leave_one_case_out"]
    _same([f["held_out"] for f in loco], case_ids, where + "/leave_one_case_out")
    group_members = {g: [c for c in case_ids if groups[c] == g] for g in dict.fromkeys(groups.values())}
    grouped = record["leave_one_group_out"]
    _same([f["held_out_group"] for f in grouped], [g for g, members in group_members.items() if len(members) > 1],
          where + "/leave_one_group_out")
    interpolation = record["interpolation"]
    protocols = [("interpolation", "interpolation", case_ids, interpolation)]
    for fold in loco:
        _same(fold["test_rows"], per_case, where + "/" + fold["held_out"] + "/test_rows")
        protocols.append(("leave_one_case_out", fold["held_out"], [fold["held_out"]], fold))
    for fold in grouped:
        members = group_members[fold["held_out_group"]]
        _same(fold["cases"], members, where + "/" + fold["held_out_group"] + "/cases")
        _same(fold["test_rows"], len(members)*per_case, where + "/group/test_rows")
        protocols.append(("transfer", fold["held_out_group"], members, fold))
    findings = observable.record_findings(record)
    _require(not findings, where, "; ".join(findings))
    _score_bounds(record, where)
    for protocol, fold_id, members, fold in protocols:
        context = f"{where}/{protocol}/{fold_id}"
        _integer(fold["train_rows"], context + "/train_rows", 1)
        _integer(fold["test_rows"], context + "/test_rows", 1)
        _same(fold["train_rows"] + fold["test_rows"], design["rows"], context + "/rows")
        _require(set(fold["models"]) == set(MODEL_NAMES), context, "incomplete model scores")
        for model in MODEL_NAMES:
            _require(set(fold["models"][model]) == set(TARGET_UNITS), context, "incomplete target scores")
            for target, score in fold["models"][model].items():
                _same(score["evaluation"], {"method": model, "target": target, "protocol": protocol,
                                           "fold": fold_id, "seed": seed}, context + "/evaluation")
                _same(score["rows"], fold["test_rows"], context + "/score/rows")
                if score["valid_for_scoring"]:
                    _number(score["rmse"], context + "/rmse", 0)
                    _number(score["mae"], context + "/mae", 0, score["rmse"] + 1e-10)
                    _number(score["r2"], context + "/r2", maximum=1)
                if model == "gaussian_process":
                    if score["valid_for_scoring"]:
                        _number(score["coverage_95"], context + "/coverage_95", 0, 1)
                    else:
                        _same(score["coverage_95"], None, context + "/coverage_95")
    # Pure checker shared with release validation; it imports no numerical stack.
    findings = checker.check_learning_cohorts(record)
    _require(not findings, where, "; ".join(findings))
    for target in TARGET_UNITS:
        baseline = interpolation["case_mean_baseline"][target]
        _same(baseline["evaluation"], {"method": "case_mean_baseline", "target": target,
                                      "protocol": "interpolation", "fold": "interpolation", "seed": seed}, where + "/baseline")
        for model in MODEL_NAMES:
            summary = record["summary"][model][target]
            for prefix in ("loco", "transfer"):
                for key in ("attempted", "scored", "rejected"):
                    _integer(summary[f"{prefix}_folds"][key], where + "/summary/" + model + "/" + key)
            score = interpolation["models"][model][target]
            for key, value in {"interpolation_rmse": score["rmse"], "interpolation_r2": score["r2"],
                               "interpolation_r2_within_case": score.get("r2_within_case"), "case_mean_r2": baseline["r2"]}.items():
                _same(summary[key], value, where + "/summary/" + model + "/" + target + "/" + key)
        accepted = [f["models"]["gaussian_process"][target] for f in loco
                    if f["models"]["gaussian_process"][target]["valid_for_scoring"]]
        rows = sum(s["rows"] for s in accepted)
        coverage = record["summary"]["gaussian_process"][target]
        expected = {"interpolation_coverage": interpolation["models"]["gaussian_process"][target]["coverage_95"],
                    "loco_coverage_pooled": sum(s["coverage_95"]*s["rows"] for s in accepted)/rows if rows else None,
                    "loco_coverage_worst": min(s["coverage_95"] for s in accepted) if accepted else None,
                    "loco_folds_below_80": sum(s["coverage_95"] < constants["learning.coverage_floor"]["value"] for s in accepted)}
        for key, value in expected.items():
            _same(coverage[key], value, where + "/summary/gaussian_process/" + target + "/" + key)
    seeds = record["mlp_seeds"]
    _require(seeds["seeds"] and len(set(seeds["seeds"])) == len(seeds["seeds"]), where, "duplicate or empty seeds")
    for value in seeds["seeds"]:
        _integer(value, where + "/mlp_seeds/seeds")
    expected_folds = ["interpolation"] + case_ids
    _require(set(seeds["scores"]) == set(expected_folds), where, "incomplete seed fold coverage")
    for target in TARGET_UNITS:
        for counts in seeds["summary"][target]["loco_folds"]:
            for key in ("attempted", "scored", "rejected"):
                _integer(counts[key], where + "/mlp_seeds/summary/" + key)
        expected = {"interpolation_rmse": [s["rmse"] for s in seeds["scores"]["interpolation"][target]],
                    "loco_rmse_mean": [], "loco_r2_median": [], "loco_folds": [],
                    "loco_rmse_by_case": {c: [s["rmse"] for s in seeds["scores"][c][target]] for c in case_ids}}
        for i, value in enumerate(seeds["seeds"]):
            for name in expected_folds:
                score = seeds["scores"][name][target][i]
                _same(score["rows"], interpolation["test_rows"] if name == "interpolation" else per_case,
                      where + "/mlp_seeds/rows")
            scores = [seeds["scores"][c][target][i] for c in case_ids]
            agg = _aggregate(scores)
            expected["loco_rmse_mean"].append(agg["rmse_mean"])
            expected["loco_r2_median"].append(agg["r2_median"])
            expected["loco_folds"].append({k: agg[k] for k in ("attempted", "scored", "rejected")})
        _same(seeds["summary"][target], expected, where + "/mlp_seeds/summary/" + target)
        _same(record["summary"]["mlp"][target]["seeds"], expected, where + "/summary/mlp/seeds/" + target)
    guard = record["guard"]
    _number(guard["threshold"], where + "/guard/threshold", 0)
    for key in ("false_alarm_rate", "false_accept_rate"):
        _number(guard[key], where + "/guard/" + key, 0, 1)
    for key in ("in_envelope_rows", "probe_rows"):
        _integer(guard[key], where + "/guard/" + key, 1)
    for feature, value in guard["false_accept_by_feature"].items():
        _number(value, where + "/guard/false_accept_by_feature/" + feature, 0, 1)
    _same(guard["in_envelope_rows"], interpolation["test_rows"], where + "/guard/in_envelope_rows")
    _require(bool(guard["false_accept_by_feature"]), where + "/guard", "no feature probe rates")
    _same(guard["probe_rows"], guard["in_envelope_rows"]*len(guard["false_accept_by_feature"]), where + "/guard/probe_rows")
    _same(guard["false_accept_rate"], statistics.mean(guard["false_accept_by_feature"].values()), where + "/guard/false_accept_rate")
    for probe in guard["acceptance_by_distance"]:
        _number(probe["distance"], where + "/guard/distance", 0)
        for key in ("upward", "downward"):
            _number(probe[key], where + "/guard/" + key, 0, 1)
    return protocols, group_members


def _optimization(case_id, variant, tolerance):
    path = f"cases/{case_id}.json/variants/{variant['id']}/optimization"
    opt = variant["methods"]["optimization"]
    status = opt["status"]
    _require(opt["method"] == "gps-progressive-barrier", path, "unexpected optimization method")
    _require(status in ("optimal", "infeasible", "base_refused"), path, "unknown endpoint status")
    _require(type(opt["screened"]) is bool, path, "screened boolean required")
    calls = _integer(opt["evaluations"], path + "/evaluations")
    start_calls = sum(_integer(s["evaluations"], path + "/starts/evaluations") for s in opt["starts"])
    if status != "base_refused":
        _same(calls, start_calls, path + "/exact call totals")
    optimum = opt.get("optimum")
    if status == "optimal":
        _require(isinstance(optimum, dict) and optimum.get("feasible") is True, path, "optimal endpoint is not feasible")
        constraints = opt["constraints"]
        scales = {"grade": constraints["grade"]["minimum"], "power": constraints["power"]["maximum_kw"]}
        if "water" in constraints:
            scales["water"] = constraints["water"]["maximum_m3_t"]
        _require(set(optimum["slacks"]) == set(scales), path, "incomplete endpoint constraint slacks")
        for name, scale in scales.items():
            _number(scale, path + "/constraint/" + name, 0)
            _require(optimum["slacks"][name] >= -tolerance * (scale if scale > 0 else 1), path,
                     f"optimal endpoint violates {name}")
        values = optimum["values"]
        expected_slacks = {"grade": values["grade"]-scales["grade"], "power": scales["power"]-values["required_power_kw"]}
        if "water" in scales:
            expected_slacks["water"] = scales["water"]-values["water_m3_t"]
        _same(optimum["slacks"], expected_slacks, path + "/endpoint/slacks")
        _require(set(optimum["decisions"]) == set(opt["decisions"]), path, "incomplete feasible decision vector")
    else:
        _same(optimum, None, path + "/optimum")
        if status == "infeasible":
            _require(opt["least_violating"].get("feasible") is False, path, "infeasible endpoint marked feasible")
    row = {"case_id": case_id, "variant": variant["id"], "method": "Generalized pattern search with progressive barrier",
           "status": status, "feasible": status == "optimal", "screened": opt["screened"],
           "exact_calls": calls, "exact_calls_unscreened": None, "difference_percent": None,
           "same_terminal_status": None, "same_feasible_endpoint": False, "matching_infeasible": False,
           "recovered_tph_difference": None, "recovered_tph_difference_percent": None,
           "screen_candidates": 0, "guard_rejected": 0, "interval_rejected": 0, "engine_audited_proposals": 0,
           "weight_path_exact_calls": sum(_integer(s["evaluations"], path + "/path/evaluations") for s in opt.get("path", [])),
           "endpoint": optimum, "least_violating": opt.get("least_violating"),
           "unscreened_reason": opt.get("unscreened_reason"), "without_screen": opt.get("without_screen")}
    if not opt["screened"]:
        _require("without_screen" not in opt, path, "unscreened record has a foreign paired comparison")
        return row
    plain = opt["without_screen"]
    plain_calls = _integer(plain["evaluations"], path + "/without_screen/evaluations")
    _same(sum(_integer(c, path + "/without_screen/starts") for c in plain["starts"]), plain_calls, path + "/plain exact call totals")
    _require(len(plain["starts"]) == len(opt["starts"]), path, "paired starts differ")
    _require(plain["status"] in ("optimal", "infeasible"), path, "invalid unscreened endpoint")
    if plain["status"] == "infeasible":
        _same(plain["decisions"], None, path + "/without_screen/decisions")
        _same(plain["recovered_tph"], None, path + "/without_screen/recovered_tph")
    else:
        _require(set(plain["decisions"]) == set(opt["decisions"]), path, "incomplete unscreened decision vector")
        _number(plain["recovered_tph"], path + "/without_screen/recovered_tph", 0)
    same_feasible = status == plain["status"] == "optimal" and all(
        abs(optimum["decisions"][name]-plain["decisions"][name]) <= 1e-6*max(1, abs(optimum["decisions"][name]))
        for name in opt["decisions"])
    row.update(exact_calls_unscreened=plain_calls, difference_percent=100*(calls/plain_calls-1) if plain_calls else None,
               same_terminal_status=status == plain["status"], same_feasible_endpoint=same_feasible,
               matching_infeasible=status == plain["status"] == "infeasible")
    if status == plain["status"] == "optimal":
        difference = optimum["recovered_tph"]-plain["recovered_tph"]
        row.update(recovered_tph_difference=difference,
                   recovered_tph_difference_percent=100*difference/plain["recovered_tph"] if plain["recovered_tph"] else None)
    columns = opt["proposal_columns"]
    _require(len(set(columns)) == len(columns), path, "duplicate proposal columns")
    engine, surrogate = columns.index("engine_recovery_pct"), columns.index("surrogate_recovery_pct")
    errors = []
    for start in opt["starts"]:
        screen = start["screen"]
        for key, destination in [("screened", "screen_candidates"), ("guard", "guard_rejected"), ("interval", "interval_rejected")]:
            row[destination] += _integer(screen["rejected"][key] if key in ("guard", "interval") else screen[key], path + "/screen/" + key)
        _same(screen["iterations"], start["iterations"], path + "/screen/iterations")
        _same(screen["proposed"], len(screen["proposals"]), path + "/screen/proposed")
        _require(sum(screen["rejected"].values()) <= screen["screened"], path, "screen rejection counts exceed candidates")
        for proposal in screen["proposals"]:
            _require(len(proposal) == len(columns), path, "proposal column count mismatch")
            if proposal[engine] is not None:
                errors.append(abs(proposal[engine]-proposal[surrogate]))
    row["engine_audited_proposals"] = len(errors)
    row["surrogate_mae_pp"] = statistics.mean(errors) if errors else None
    return row


def collect(derived: Path, expected_version: str | None = None) -> dict:
    """Read an immutable completed derived tree; reject mixed or dishonest evidence."""
    derived = Path(derived).resolve()
    inputs = {}

    def read(relative):
        _require(isinstance(relative, str), "manifest path", "relative string required")
        pure = PurePosixPath(relative)
        _require(isinstance(relative, str) and not pure.is_absolute() and ".." not in pure.parts
                 and "\\" not in relative and ":" not in relative, relative, "foreign or unsafe input path")
        path = (derived / relative).resolve()
        _require(path.is_relative_to(derived), relative, "input escapes derived root")
        try:
            data = path.read_bytes()
        except OSError as exc:
            raise ValueError(f"{relative}: missing or unreadable input: {exc}") from exc
        _require(relative not in inputs, relative, "duplicate input artifact reference")
        inputs[relative] = {"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        return _parse(data, relative)

    record = read("learning.json")
    _require(record.get("schema") == "oreflow.learning/v2", "learning.json",
             f"requires oreflow.learning/v2; found {record.get('schema')!r}; historical scores are not upgraded")
    version, digest = record.get("engine_version"), record.get("contract_digest")
    _require(isinstance(version, str) and version.strip(), "learning.json", "missing engine version identity")
    _require(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest), "learning.json", "invalid contract digest identity")
    _require(expected_version is None or version == expected_version, "learning.json", "expected engine version identity differs")

    def identity(value, schema, path):
        _require(value.get("schema") == schema, path, "wrong schema")
        _require(value.get("engine_version") == version and value.get("contract_digest") == digest, path, "engine version or contract digest identity differs")

    index = read("manifests/index.json")
    identity(index, "oreflow.index/v2", "manifests/index.json")
    _fields(index, ("cases", "n_cases", "n_variants"), "manifests/index.json")
    entries = index["cases"]
    _require(isinstance(entries, list), "manifests/index.json/cases", "case array required")
    for entry in entries:
        _fields(entry, ("case_id", "manifest_path", "artifact_path", "variants"), "manifests/index.json/cases")
    ids = [entry["case_id"] for entry in entries]
    _require(ids and all(isinstance(c, str) and c.strip() for c in ids) and len(set(ids)) == len(ids),
             "manifests/index.json", "empty or duplicate case catalog")
    _same(index["n_cases"], len(ids), "manifests/index.json/n_cases")
    _integer(index["n_cases"], "manifests/index.json/n_cases", 1)
    _integer(index["n_variants"], "manifests/index.json/n_variants", 1)
    observable, checker, constants, sources = _support()
    try:
        protocols, groups = _learning(record, ids, observable, checker, constants)
    except (KeyError, TypeError, IndexError, AttributeError) as exc:
        raise ValueError(f"learning.json: incomplete or malformed v2 evidence: {exc}") from exc
    cases, variants = [], []
    for entry in entries:
        case_id = entry["case_id"]
        manifest = read(entry["manifest_path"])
        identity(manifest, "oreflow.manifest/v2", entry["manifest_path"])
        _fields(manifest, ("case_id", "artifact", "variants"), entry["manifest_path"])
        _fields(manifest["artifact"], ("path", "schema", "sha256", "bytes"), entry["manifest_path"] + "/artifact")
        _same(manifest["case_id"], case_id, entry["manifest_path"] + "/case_id")
        _same(manifest["artifact"]["path"], entry["artifact_path"], entry["manifest_path"] + "/artifact/path")
        _same(manifest["artifact"]["schema"], "oreflow.case/v2", entry["manifest_path"] + "/artifact/schema")
        artifact = read(entry["artifact_path"])
        identity(artifact, "oreflow.case/v2", entry["artifact_path"])
        _fields(artifact, ("case_id", "variants", "title", "family"), entry["artifact_path"])
        _same(artifact["case_id"], case_id, entry["artifact_path"] + "/case_id")
        for key in ("sha256", "bytes"):
            _same(manifest["artifact"][key], inputs[entry["artifact_path"]][key], entry["artifact_path"] + "/" + key)
        rows = artifact["variants"]
        _require(isinstance(rows, list), entry["artifact_path"], "variant array required")
        for variant in rows:
            _fields(variant, ("id", "trace", "methods"), entry["artifact_path"] + "/variants")
            _fields(variant["trace"], ("metrics",), entry["artifact_path"] + "/trace")
            _require(isinstance(variant["trace"]["metrics"], dict), entry["artifact_path"] + "/metrics", "metric object required")
            for name, value in variant["trace"]["metrics"].items():
                _number(value, entry["artifact_path"] + "/metrics/" + name)
        variant_ids = [v["id"] for v in rows]
        _require(variant_ids and len(set(variant_ids)) == len(variant_ids), entry["artifact_path"], "empty or duplicate variants")
        _same(manifest["variants"], variant_ids, entry["manifest_path"] + "/variants")
        _same(entry["variants"], len(rows), entry["artifact_path"] + "/variant count")
        _integer(entry["variants"], entry["artifact_path"] + "/variant count", 1)
        cases.append({"case_id": case_id, "title": artifact["title"], "family": artifact["family"],
                      "variants": [{"id": v["id"], "metrics": v["trace"]["metrics"]} for v in rows]})
        for variant in rows:
            try:
                variants.append(_optimization(case_id, variant, constants["optimization.feasibility_tolerance"]["value"]))
            except (KeyError, TypeError, IndexError, AttributeError) as exc:
                raise ValueError(f"{entry['artifact_path']}/{variant['id']}: malformed optimizer evidence: {exc}") from exc
    _same(index["n_variants"], len(variants), "manifests/index.json/n_variants")
    expected = {entry["artifact_path"] for entry in entries} | {entry["manifest_path"] for entry in entries} | {"manifests/index.json"}
    actual = {p.relative_to(derived).as_posix() for folder in ("cases", "manifests") for p in (derived / folder).rglob("*.json")}
    _require(actual == expected, "manifests/index.json", f"incomplete catalog or unlisted artifacts: {sorted(actual ^ expected)}")

    scores, conditional, coverage = [], [], []
    transfer = []
    for protocol, case, members, fold in protocols:
        if protocol == "leave_one_case_out":
            group = record["transfer_groups"][case]
            if len(groups[group]) == 1:
                transfer.append(("transfer", group, [case], fold))
    all_protocols = protocols + transfer
    for protocol, fold_id, members, fold in all_protocols:
        for model in MODEL_NAMES:
            for target in TARGET_UNITS:
                score = fold["models"][model][target]
                scores.append({**score, "protocol": protocol, "fold": fold_id, "case_ids": members, "model": model, "target": target})
                if model == "gaussian_process":
                    coverage.append({"protocol": protocol, "fold": fold_id, "target": target, "rows": score["rows"],
                                     "status": score["status"], "coverage_95": score["coverage_95"]})
    for protocol in ("interpolation", "leave_one_case_out", "transfer"):
        for model in MODEL_NAMES:
            for target, unit in TARGET_UNITS.items():
                rows = [s for s in scores if (s["protocol"], s["model"], s["target"]) == (protocol, model, target)]
                conditional.append({"protocol": protocol, "model": model, "target": target, "unit": unit, **_aggregate(rows),
                                    "scored_rows": sum(s["rows"] for s in rows if s["valid_for_scoring"]),
                                    "rejected_rows": sum(s["rows"] for s in rows if not s["valid_for_scoring"]),
                                    "rejected_fold_ids": [s["fold"] for s in rows if not s["valid_for_scoring"]]})
    seed_scores = []
    for fold in ["interpolation"] + ids:
        for target in TARGET_UNITS:
            for seed, score in zip(record["mlp_seeds"]["seeds"], record["mlp_seeds"]["scores"][fold][target]):
                seed_scores.append({**score, "fold": fold, "target": target, "seed": seed})
    paired = [v for v in variants if v["screened"]]
    screened_calls, plain_calls = sum(v["exact_calls"] for v in paired), sum(v["exact_calls_unscreened"] for v in paired)
    result = {"schema": "oreflow.release-results/v1", "engine_version": version, "contract_digest": digest,
              "evidence_kind": "Authored simulator evidence; not measured plant validation",
              "provenance": {"inputs": sorted(inputs.values(), key=lambda p: p["path"]), "validation_sources": sources},
              "design": {**record["design"], "case_artifacts": len(cases), "variants": len(variants),
                         "case_folds": len(record["leave_one_case_out"]), "grouped_folds": len(record["leave_one_group_out"]),
                         "transfer_groups": len(groups), "seeds": len(record["mlp_seeds"]["seeds"])},
              "learning": {"model_names": MODEL_NAMES, "target_units": TARGET_UNITS, "conditional": conditional,
                           "identity": record["identity"], "settings": record["settings"],
                           "scores": scores, "common_cohorts": record["common_cohorts"], "summary": record["summary"],
                           "equal_rows": record["equal_rows"], "case_mean_baseline": record["interpolation"]["case_mean_baseline"],
                           "seeds": {"seeds": record["mlp_seeds"]["seeds"], "summary": record["mlp_seeds"]["summary"], "scores": seed_scores},
                           "gp_coverage": coverage, "guard": record["guard"]},
              "cases": cases, "optimization": {"variants": variants, "paired": {
                  "variants": len(paired), "exact_calls_screened": screened_calls, "exact_calls_unscreened": plain_calls,
                  "difference_percent": 100*(screened_calls/plain_calls-1) if plain_calls else None,
                  "same_terminal_status": sum(v["same_terminal_status"] for v in paired),
                  "same_feasible_endpoint": sum(v["same_feasible_endpoint"] for v in paired),
                  "matching_infeasible": sum(v["matching_infeasible"] for v in paired),
                  "same_terminal_outcome": sum(v["same_feasible_endpoint"] or v["matching_infeasible"] for v in paired),
                  "feasible_screened": sum(v["feasible"] for v in paired),
                  "feasible_unscreened": sum(v["without_screen"]["status"] == "optimal" for v in paired),
                  "screen_candidates": sum(v["screen_candidates"] for v in paired),
                  "engine_audited_proposals": sum(v["engine_audited_proposals"] for v in paired),
                  "surrogate_mae_pp": (sum(v["surrogate_mae_pp"]*v["engine_audited_proposals"] for v in paired
                                            if v["engine_audited_proposals"])/sum(v["engine_audited_proposals"] for v in paired)
                                       if any(v["engine_audited_proposals"] for v in paired) else None)}}}
    # Detect adoption or concurrent producer writes instead of mixing snapshots.
    for relative, evidence in inputs.items():
        _require(hashlib.sha256((derived / relative).read_bytes()).hexdigest() == evidence["sha256"], relative,
                 "input changed during collection; wait for a stable completed bake")
    _finite_tree(result, "results")
    return result


def _cell(value):
    if value is None:
        return "unavailable"
    if isinstance(value, float):
        return format(value, ".10g")
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)
    return str(value).replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def _table(headers, rows):
    return "\n".join(["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"] +
                     ["| " + " | ".join(_cell(v) for v in row) + " |" for row in rows])


def render_markdown(result: dict) -> str:
    """Render every evidence row without ranking unmatched surviving cohorts."""
    _finite_tree(result, "results")
    learning = result["learning"]
    names = learning["model_names"]
    sections = ["# OreFlow release result tables", f"Engine: {result['engine_version']}. Contract SHA256: `{result['contract_digest']}`.",
                result["evidence_kind"] + ". Conditional results use each model's surviving folds; only matched tables share fold IDs. "
                "No unqualified ranking across different surviving cohorts is implied.",
                "## Design", _table(["Quantity", "Value"], result["design"].items()),
                "## Algorithm identities", _table(["Algorithm", "Persisted implementation"],
                    [(names[model], identity) for model, identity in learning["identity"].items()]),
                "## Evaluation settings", _table(["Setting", "Value"], learning["settings"].items()),
                "## Input SHA256 provenance", _table(["Input", "Bytes", "SHA256"],
                    [(p["path"], p["bytes"], p["sha256"]) for p in result["provenance"]["inputs"]]),
                "## Collector and validation source SHA256", _table(["Source", "Bytes", "SHA256"],
                    [(p["path"], p["bytes"], p["sha256"]) for p in result["provenance"]["validation_sources"]]),
                "## Learning conditional summaries", _table(
                    ["Protocol", "Algorithm", "Target", "RMSE unit", "Attempted", "Scored", "Rejected", "Scored rows", "Rejected rows", "Mean RMSE", "Max RMSE", "Median R²", "Rejected folds"],
                    [(r["protocol"], names[r["model"]], r["target"], r["unit"], r["attempted"], r["scored"], r["rejected"],
                      r["scored_rows"], r["rejected_rows"], r["rmse_mean"], r["rmse_max"], r["r2_median"], r["rejected_fold_ids"])
                     for r in learning["conditional"]]),
                "## Every case/group score", "RMSE and MAE use the target unit; R² is dimensionless. Rejected metrics remain unavailable.",
                _table(["Protocol", "Fold", "Cases", "Algorithm", "Target", "Unit", "Status", "Rows", "RMSE", "MAE", "R²", "Affected rows", "Rejection"],
                       [(r["protocol"], r["fold"], r["case_ids"], names[r["model"]], r["target"], TARGET_UNITS[r["target"]],
                         r["status"], r["rows"], r["rmse"], r["mae"], r["r2"], r.get("rejection", {}).get("affected_rows"),
                         r.get("rejection", {}).get("reason")) for r in learning["scores"]])]
    matched = []
    for protocol, targets in learning["common_cohorts"].items():
        for target, cohort in targets.items():
            for model, score in cohort["models"].items():
                matched.append((protocol, target, TARGET_UNITS[target], names[model], cohort["attempted"], len(cohort["folds"]),
                                cohort["folds"], cohort["excluded"], score["rmse_mean"], score["r2_median"]))
    seed_summaries = []
    for target, summary in learning["seeds"]["summary"].items():
        for index, seed in enumerate(learning["seeds"]["seeds"]):
            counts = summary["loco_folds"][index]
            seed_summaries.append((target, TARGET_UNITS[target], seed, counts["attempted"], counts["scored"], counts["rejected"],
                                   summary["interpolation_rmse"][index], summary["loco_rmse_mean"][index], summary["loco_r2_median"][index]))
    gp_summaries = []
    for target in TARGET_UNITS:
        summary = learning["summary"]["gaussian_process"][target]
        rows = [r for r in learning["gp_coverage"] if r["protocol"] == "leave_one_case_out" and r["target"] == target
                and r["status"] == "scored"]
        counts = summary["loco_folds"]
        gp_summaries.append((target, counts["attempted"], counts["scored"], counts["rejected"], sum(r["rows"] for r in rows),
                             summary["interpolation_coverage"], summary["loco_coverage_pooled"], summary["loco_coverage_worst"],
                             summary["loco_folds_below_80"]))
    sections += ["## Within-case interpolation and case-mean baseline", _table(
        ["Algorithm", "Target", "RMSE unit", "Within-case R²", "Case-mean baseline R²", "Case-mean baseline RMSE"],
        [(names[model], target, TARGET_UNITS[target], summary["interpolation_r2_within_case"], summary["case_mean_r2"],
          learning["case_mean_baseline"][target]["rmse"]) for model, targets in learning["summary"].items() for target, summary in targets.items()]),
        "## Equal-training-row interpolation controls", "These refits use the Gaussian process training subset; they are separate controls.",
        _table(["Algorithm", "Target", "Unit", "Status", "Test rows", "RMSE", "MAE", "R²"],
            [(names[model], target, TARGET_UNITS[target], score["status"], score["rows"], score["rmse"], score["mae"], score["r2"])
             for model, targets in learning["equal_rows"].items() for target, score in targets.items()]),
        "## All-model matched cohorts", _table(
        ["Protocol", "Target", "RMSE unit", "Algorithm", "Attempted", "Matched", "Included folds", "Excluded folds", "Mean RMSE", "Median R²"], matched),
        "## Seed conditional summaries", _table(
            ["Target", "RMSE unit", "Seed", "Attempted folds", "Scored", "Rejected", "Interpolation RMSE", "Mean case-fold RMSE", "Median case-fold R²"], seed_summaries),
        "## Every seed score", _table(["Fold", "Seed", "Target", "Unit", "Status", "Rows", "RMSE", "MAE", "R²", "Affected rows"],
            [(r["fold"], r["seed"], r["target"], TARGET_UNITS[r["target"]], r["status"], r["rows"], r["rmse"], r["mae"], r["r2"],
              r.get("rejection", {}).get("affected_rows")) for r in learning["seeds"]["scores"]]),
        "## Gaussian process pooled case-fold coverage", _table(
            ["Target", "Attempted folds", "Scored", "Rejected", "Scored rows", "Interpolation coverage", "Row-weighted coverage", "Worst coverage", "Scored folds below 0.8"], gp_summaries),
        "## Gaussian process coverage", "Coverage is a fraction of the declared scored rows, not all attempted rows.",
        _table(["Protocol", "Fold", "Target", "Status", "Rows", "95% interval coverage"],
            [(r["protocol"], r["fold"], r["target"], r["status"], r["rows"], r["coverage_95"]) for r in learning["gp_coverage"]]),
        "## Autoencoder guard", _table(["Diagnostic", "Value"], learning["guard"].items()),
        "## Every case variant", _table(["Case", "Variant", "Simulator metrics (keys declare units)"],
            [(c["case_id"], v["id"], v["metrics"]) for c in result["cases"] for v in c["variants"]]),
        "## Paired optimizer totals", "Difference (%) = 100 × (screened exact calls / unscreened exact calls − 1). "
        "Positive values mean more calls. Screening candidates and engine-audited proposals are separate counts, "
        "not extra optimizer budgets. Weight-path calls are a separate study. Matching infeasible outcomes are not successful endpoints.",
        _table(["Quantity", "Value"], result["optimization"]["paired"].items()),
        "## Every optimizer variant", _table(
            ["Case", "Variant", "Status", "Feasible", "Paired", "Exact calls", "Unscreened exact calls", "Difference %", "Same feasible endpoint", "Matching infeasible", "Screen candidates", "Guard rejected", "Interval rejected", "Engine-audited proposals", "Weight-path exact calls"],
            [(r["case_id"], r["variant"], r["status"], r["feasible"], r["screened"], r["exact_calls"], r["exact_calls_unscreened"],
              r["difference_percent"], r["same_feasible_endpoint"], r["matching_infeasible"], r["screen_candidates"], r["guard_rejected"],
              r["interval_rejected"], r["engine_audited_proposals"], r["weight_path_exact_calls"]) for r in result["optimization"]["variants"]]),
        "## Optimizer endpoint evidence", "Recovered-metal differences use screened minus unscreened (t/h); "
        "percent differences use the unscreened recovered metal. Infeasible comparisons remain unavailable.",
        _table(["Case", "Variant", "Feasible decisions", "Recovered metal (t/h)", "Unscreened status", "Difference (t/h)", "Difference (%)", "Slacks (grade points, power kW, water m³/t)"],
            [(r["case_id"], r["variant"], (r["endpoint"] or {}).get("decisions"), (r["endpoint"] or {}).get("recovered_tph"),
              (r["without_screen"] or {}).get("status"), r["recovered_tph_difference"], r["recovered_tph_difference_percent"],
              (r["endpoint"] or {}).get("slacks")) for r in result["optimization"]["variants"]])]
    return "\n\n".join(sections) + "\n"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--derived", type=Path, required=True)
    parser.add_argument("--expected-version")
    parser.add_argument("--json", dest="json_path", type=Path)
    parser.add_argument("--markdown", type=Path)
    args = parser.parse_args(argv)
    try:
        outputs = [p for p in (args.json_path, args.markdown) if p is not None]
        paths = []
        for path in outputs:
            if str(path) == "-":
                continue
            path = path.expanduser().resolve()
            _require(not path.is_relative_to(ROOT), path, "output must be outside the repository")
            _require(not path.is_relative_to(args.derived.resolve()), path, "output must be outside input artifacts")
            _require(not path.exists(), path, "output already exists; use a fresh destination")
            paths.append(path)
        _require(len(paths) == len(set(paths)), "outputs", "JSON and Markdown destinations collide")
        _require(sum(str(p) == "-" for p in outputs) <= 1, "outputs", "only one format may use stdout")
        result = collect(args.derived, args.expected_version)
        content = json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + "\n"
        markdown = render_markdown(result)
        if not outputs:
            if hasattr(sys.stdout, "reconfigure"):
                sys.stdout.reconfigure(encoding="utf-8")
            print(markdown, end="")
        for path, text in ((args.json_path, content), (args.markdown, markdown)):
            if path is None:
                continue
            if str(path) == "-":
                if hasattr(sys.stdout, "reconfigure"):
                    sys.stdout.reconfigure(encoding="utf-8")
                print(text, end="")
            else:
                destination = path.expanduser().resolve()
                destination.parent.mkdir(parents=True, exist_ok=True)
                with destination.open("x", encoding="utf-8", newline="\n") as handle:
                    handle.write(text)
        return 0
    except (ValueError, OSError, KeyError, TypeError, IndexError, AttributeError) as exc:
        print(f"collect_results: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
