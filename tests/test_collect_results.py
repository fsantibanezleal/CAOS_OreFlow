"""Small authored v2 evidence and adversarial changes, never historical scores."""
from __future__ import annotations

import copy
import hashlib
import json
import statistics
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from collect_results import collect, render_markdown  # noqa: E402 -- standalone scripts are not installed packages


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, allow_nan=False), encoding="utf-8")


def refresh_summaries(record):
    """Build fixture summaries from its explicit tiny cells, not release numbers."""
    folds = record["leave_one_case_out"]
    groups = record["transfer_groups"]
    transfer = record["leave_one_group_out"] + [
        {**f, "held_out_group": groups[f["held_out"]]} for f in folds
        if list(groups.values()).count(groups[f["held_out"]]) == 1]
    for protocol, key, prefix, rows in [("leave_one_case_out", "held_out", "loco", folds),
                                        ("transfer", "held_out_group", "transfer", transfer)]:
        for target in record["targets"]:
            common = [f for f in rows if all(f["models"][m][target]["valid_for_scoring"] for m in record["models"])]
            record["common_cohorts"][protocol][target] = {
                "attempted": len(rows), "folds": [f[key] for f in common],
                "excluded": [f[key] for f in rows if f not in common], "models": {}}
            for model in record["models"]:
                accepted = [f["models"][model][target] for f in rows if f["models"][model][target]["valid_for_scoring"]]
                summary = record["summary"][model][target]
                summary[f"{prefix}_folds"] = {"attempted": len(rows), "scored": len(accepted), "rejected": len(rows)-len(accepted)}
                for suffix, metric, function in [("rmse_mean", "rmse", statistics.mean), ("rmse_max", "rmse", max),
                                                  ("r2_median", "r2", statistics.median)]:
                    summary[f"{prefix}_{suffix}"] = function([s[metric] for s in accepted]) if accepted else None
                record["common_cohorts"][protocol][target]["models"][model] = {
                    "rmse_mean": statistics.mean([f["models"][model][target]["rmse"] for f in common]) if common else None,
                    "r2_median": statistics.median([f["models"][model][target]["r2"] for f in common]) if common else None}
    for target in record["targets"]:
        gp = record["summary"]["gaussian_process"][target]
        accepted = [f["models"]["gaussian_process"][target] for f in folds
                    if f["models"]["gaussian_process"][target]["valid_for_scoring"]]
        gp.update(interpolation_coverage=record["interpolation"]["models"]["gaussian_process"][target]["coverage_95"],
                  loco_coverage_pooled=statistics.mean(s["coverage_95"] for s in accepted) if accepted else None,
                  loco_coverage_worst=min(s["coverage_95"] for s in accepted) if accepted else None, loco_folds_below_80=0)


def optimizer(status="optimal", screened=True, calls=6, plain=4):
    endpoint = {"decisions": {"target_p80_um": 100}, "feasible": status == "optimal", "recovered_tph": 3,
                "values": {"grade": 20, "required_power_kw": 80, "water_m3_t": 1, "energy_kwh_t": 2},
                "slacks": {"grade": 1 if status == "optimal" else -1, "power": 20, "water": 1}, "active": []}
    result = {"method": "gps-progressive-barrier", "status": status, "screened": screened, "evaluations": calls,
              "decisions": ["target_p80_um"], "optimum": endpoint if status == "optimal" else None,
              "constraints": {"grade": {"minimum": 19}, "power": {"maximum_kw": 100}, "water": {"maximum_m3_t": 2}},
              "starts": [{"evaluations": calls, "iterations": 1, "stop": "mesh"}], "path": []}
    if status != "optimal":
        result["least_violating"] = endpoint
    if screened:
        result["starts"][0]["screen"] = {"screened": 12, "rejected": {"guard": 2, "interval": 3},
                                                  "proposed": 1, "improved": 1, "iterations": 1,
                                                  "proposals": [[1, 81, 80]]}
        result["proposal_columns"] = ["iteration", "surrogate_recovery_pct", "engine_recovery_pct"]
        result["without_screen"] = {"status": status, "evaluations": plain, "starts": [plain],
                                    "decisions": endpoint["decisions"] if status == "optimal" else None,
                                    "recovered_tph": 3 if status == "optimal" else None}
    else:
        result["unscreened_reason"] = "cut_mode"
    return result


def update_case(derived, case_id, mutate):
    path = derived / "cases" / f"{case_id}.json"
    record = json.loads(path.read_text())
    mutate(record)
    write_json(path, record)
    manifest_path = derived / "manifests" / f"{case_id}.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["artifact"].update(bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    write_json(manifest_path, manifest)


@pytest.fixture
def bundle(tmp_path):
    derived = tmp_path / "derived"
    record = json.loads((ROOT / "tests/contracts/fixtures/learning-v2.json").read_text())
    record["transfer_groups"] = {"case-a": "ore-a", "case-b": "ore-b"}
    for model in record["models"]:
        for target in record["targets"]:
            record["interpolation"]["models"][model][target]["r2_within_case"] = 0.4
            record["summary"][model][target]["case_mean_r2"] = 0.5
            if model == "mlp":
                record["summary"][model][target]["seeds"] = copy.deepcopy(record["mlp_seeds"]["summary"][target])
    refresh_summaries(record)
    write_json(derived / "learning.json", record)
    index = {"schema": "oreflow.index/v2", "engine_version": record["engine_version"],
             "contract_digest": record["contract_digest"], "n_cases": 2, "n_variants": 4, "cases": []}
    for case_id in record["design"]["cases"]:
        artifact = {"schema": "oreflow.case/v2", "case_id": case_id, "engine_version": record["engine_version"],
                    "contract_digest": record["contract_digest"], "family": "rougher", "title": {"en": case_id},
                    "variants": [
                        {"id": "nominal", "trace": {"metrics": {"recovery_pct": 80, "specific_energy_total_kwh_t": 2}},
                         "methods": {"optimization": optimizer("optimal" if case_id == "case-a" else "infeasible")}},
                        {"id": "cut", "trace": {"metrics": {"recovery_pct": 79, "specific_energy_total_kwh_t": 3}},
                         "methods": {"optimization": optimizer(screened=False)}}]}
        path = derived / "cases" / f"{case_id}.json"
        write_json(path, artifact)
        manifest = {"schema": "oreflow.manifest/v2", "case_id": case_id,
                    "engine_version": record["engine_version"], "contract_digest": record["contract_digest"],
                    "variants": [v["id"] for v in artifact["variants"]],
                    "artifact": {"path": f"cases/{case_id}.json", "schema": "oreflow.case/v2",
                                 "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}}
        write_json(derived / "manifests" / f"{case_id}.json", manifest)
        index["cases"].append({"case_id": case_id, "title": {"en": case_id}, "family": "rougher", "variants": 2,
                               "manifest_path": f"manifests/{case_id}.json", "artifact_path": f"cases/{case_id}.json"})
    write_json(derived / "manifests/index.json", index)
    return derived


def change_learning(bundle, mutate):
    path = bundle / "learning.json"
    record = json.loads(path.read_text())
    mutate(record)
    write_json(path, record)


def test_complete_source_backed_tables_and_immutable_inputs(bundle):
    before = {p.relative_to(bundle).as_posix(): p.read_bytes() for p in bundle.rglob("*.json")}
    result = collect(bundle, expected_version="fixture")
    assert result["engine_version"] == "fixture"
    assert result["design"]["rows"] == 4
    rows = result["learning"]["conditional"]
    mlp = next(r for r in rows if r["model"] == "mlp" and r["target"] == "recovery_pct" and r["protocol"] == "leave_one_case_out")
    assert (mlp["attempted"], mlp["scored"], mlp["rejected"]) == (2, 1, 1)
    assert mlp["rejected_fold_ids"] == ["case-b"] and mlp["rmse_mean"] == 1
    rejected = next(r for r in result["learning"]["scores"] if r["model"] == "mlp" and r["target"] == "recovery_pct"
                    and r["protocol"] == "leave_one_case_out" and r["fold"] == "case-b")
    assert rejected["rmse"] is None and rejected["rejection"]["affected_rows"] == 2
    assert result["learning"]["common_cohorts"]["leave_one_case_out"]["recovery_pct"]["folds"] == ["case-a"]
    assert len(result["learning"]["scores"]) == 75  # 5 models × 3 targets × (interpolation + 2 case + 2 transfer)
    for source in result["provenance"]["inputs"]:
        assert source["sha256"] == hashlib.sha256(before[source["path"]]).hexdigest()
    assert len(result["provenance"]["inputs"]) == len(before) == 6
    assert {p.relative_to(bundle).as_posix(): p.read_bytes() for p in bundle.rglob("*.json")} == before
    assert result == collect(bundle)
    markdown = render_markdown(result)
    assert markdown == render_markdown(collect(bundle))
    for text in ["rejected-transfer", "case-b", "Gaussian process", "kWh/t", "percentage points", "conditional", "matched", "SHA256"]:
        assert text in markdown
    assert "unavailable" in markdown and "not measured plant validation" in markdown


def test_optimizer_pairing_cost_and_infeasible_agreement(bundle):
    result = collect(bundle)["optimization"]
    paired = result["paired"]
    assert (paired["variants"], paired["exact_calls_screened"], paired["exact_calls_unscreened"]) == (2, 12, 8)
    assert paired["difference_percent"] == 50
    assert paired["same_feasible_endpoint"] == 1 and paired["matching_infeasible"] == 1
    assert paired["screen_candidates"] == 24
    assert paired["surrogate_mae_pp"] == 1 and paired["engine_audited_proposals"] == 2
    assert paired["same_terminal_outcome"] == 2 and paired["feasible_screened"] == paired["feasible_unscreened"] == 1
    assert len(result["variants"]) == 4
    failed = next(r for r in result["variants"] if r["case_id"] == "case-b" and r["variant"] == "nominal")
    assert failed["feasible"] is False and failed["same_feasible_endpoint"] is False
    assert failed["status"] == "infeasible"


def test_negative_call_difference_is_reported_as_measured(bundle):
    for case in ["case-a", "case-b"]:
        update_case(bundle, case, lambda r: r["variants"][0]["methods"].update(optimization=optimizer(calls=2, plain=4)))
    assert collect(bundle)["optimization"]["paired"]["difference_percent"] == -50


@pytest.mark.parametrize("field", ["engine_version", "contract_digest"])
@pytest.mark.parametrize("file", ["learning.json", "manifests/index.json", "manifests/case-a.json", "cases/case-a.json"])
def test_adversarial_mixed_identity_refused(bundle, file, field):
    if file.startswith("cases/"):
        update_case(bundle, "case-a", lambda r: r.update({field: "foreign"}))
    else:
        path = bundle / file
        record = json.loads(path.read_text())
        record[field] = "foreign"
        write_json(path, record)
    with pytest.raises(ValueError, match="identity|digest|version"):
        collect(bundle, expected_version="fixture")


def test_adversarial_v1_is_refused_without_relabelling(bundle):
    change_learning(bundle, lambda r: r.update(schema="oreflow.learning/v1"))
    with pytest.raises(ValueError, match=r"learning.json.*v2.*v1"):
        collect(bundle)


@pytest.mark.parametrize("file", ["cases/case-a.json", "manifests/case-a.json", "learning.json"])
def test_adversarial_missing_input_names_precise_path(bundle, file):
    (bundle / file).unlink()
    with pytest.raises(ValueError, match=file.replace("/", r"[/\\]")):
        collect(bundle)


@pytest.mark.parametrize("mutation", ["duplicate", "count", "missing-case", "foreign-path", "hash", "unlisted", "variant-count"])
def test_adversarial_catalog_corruption_refused(bundle, mutation):
    path = bundle / "manifests/index.json"
    record = json.loads(path.read_text())
    if mutation == "duplicate":
        record["cases"][1] = copy.deepcopy(record["cases"][0])
    elif mutation == "count":
        record["n_variants"] = 5
    elif mutation == "missing-case":
        record["cases"].pop()
        record["n_cases"] = 1
        record["n_variants"] = 2
    elif mutation == "foreign-path":
        record["cases"][0]["artifact_path"] = "../foreign.json"
    elif mutation == "hash":
        with (bundle / "cases/case-a.json").open("a") as handle:
            handle.write(" ")
    elif mutation == "unlisted":
        write_json(bundle / "cases/old.json", {})
    else:
        record["cases"][0]["variants"] = 3
    write_json(path, record)
    with pytest.raises(ValueError):
        collect(bundle)


@pytest.mark.parametrize("mutation", ["rejected-zero", "score-status", "summary", "denominator", "evaluation", "missing-model", "group-membership", "seed-summary"])
def test_adversarial_dishonest_scores_and_cohorts_refused(bundle, mutation):
    def mutate(r):
        rejected = r["leave_one_case_out"][1]["models"]["mlp"]["recovery_pct"]
        if mutation == "rejected-zero":
            rejected["rmse"] = 0
        elif mutation == "score-status":
            rejected["valid_for_scoring"] = True
        elif mutation == "summary":
            r["summary"]["ridge"]["recovery_pct"]["loco_rmse_mean"] = 99
        elif mutation == "denominator":
            r["summary"]["mlp"]["recovery_pct"]["loco_folds"]["scored"] = 2
        elif mutation == "evaluation":
            rejected["evaluation"]["fold"] = "different-fold"
        elif mutation == "missing-model":
            del r["leave_one_case_out"][0]["models"]["ridge"]
        elif mutation == "group-membership":
            r["transfer_groups"]["ghost"] = "foreign"
        else:
            r["mlp_seeds"]["summary"]["recovery_pct"]["loco_rmse_mean"][0] = 99
    change_learning(bundle, mutate)
    with pytest.raises(ValueError, match="learning.json"):
        collect(bundle)


def test_adversarial_empty_admissible_set_stays_null_and_keeps_hard_folds(bundle):
    def mutate(r):
        for target in r["targets"]:
            bad = copy.deepcopy(r["leave_one_case_out"][1]["models"]["mlp"][target])
            for model in r["models"]:
                for fold in r["leave_one_case_out"]:
                    score = copy.deepcopy(bad)
                    score["evaluation"].update(method=model, fold=fold["held_out"])
                    if model == "gaussian_process":
                        score["coverage_95"] = None
                    fold["models"][model][target] = score
        refresh_summaries(r)
        for target in r["targets"]:
            r["summary"]["gaussian_process"][target].update(loco_coverage_pooled=None, loco_coverage_worst=None)
    change_learning(bundle, mutate)
    result = collect(bundle)
    cohort = result["learning"]["common_cohorts"]["leave_one_case_out"]["recovery_pct"]
    assert cohort["folds"] == [] and cohort["excluded"] == ["case-a", "case-b"]
    assert all(row["rmse_mean"] is None for row in cohort["models"].values())
    assert "unavailable" in render_markdown(result)


@pytest.mark.parametrize("mutation", ["false-feasible", "bad-start-count", "bad-plain-count"])
def test_adversarial_optimizer_dishonesty_refused(bundle, mutation):
    def mutate(r):
        o = r["variants"][0]["methods"]["optimization"]
        if mutation == "false-feasible":
            o["optimum"]["feasible"] = False
        elif mutation == "bad-start-count":
            o["evaluations"] += 1
        else:
            o["without_screen"]["evaluations"] += 1
    update_case(bundle, "case-a", mutate)
    with pytest.raises(ValueError, match="case-a"):
        collect(bundle)


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "1e999"])
def test_adversarial_all_input_numbers_are_finite(bundle, bad):
    path = bundle / "learning.json"
    path.write_text(path.read_text().replace('"seconds": 0', f'"seconds": {bad}', 1))
    with pytest.raises(ValueError, match="learning.json"):
        collect(bundle)


def test_cli_external_json_markdown_and_stdout(bundle, tmp_path):
    outputs = tmp_path / "output"
    result = subprocess.run([sys.executable, "-S", str(ROOT / "scripts/collect_results.py"), "--derived", str(bundle),
                             "--expected-version", "fixture", "--json", str(outputs / "results.json"),
                             "--markdown", str(outputs / "results.md")], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert not result.stdout
    assert json.loads((outputs / "results.json").read_text())["engine_version"] == "fixture"
    assert (outputs / "results.md").read_text(encoding="utf-8") == render_markdown(collect(bundle))
    stdout = subprocess.run([sys.executable, str(ROOT / "scripts/collect_results.py"), "--derived", str(bundle), "--json", "-"],
                            capture_output=True, text=True, encoding="utf-8")
    assert stdout.returncode == 0 and json.loads(stdout.stdout)["schema"] == "oreflow.release-results/v1"


@pytest.mark.parametrize("destination", ["repository", "input"])
def test_adversarial_cli_refuses_unsafe_output_without_modifying_input(bundle, destination):
    path = ROOT / "must-not-create-results.json" if destination == "repository" else bundle / "learning.json"
    before = path.read_bytes() if path.exists() else None
    result = subprocess.run([sys.executable, str(ROOT / "scripts/collect_results.py"), "--derived", str(bundle), "--json", str(path)],
                            capture_output=True, text=True)
    assert result.returncode != 0 and ("outside" in result.stderr or "input" in result.stderr)
    assert (path.read_bytes() if path.exists() else None) == before


@pytest.mark.parametrize("mutation", ["gp-pooled", "gp-cell", "guard-rate", "guard-denominator", "seed-identity", "seed-denominator"])
def test_adversarial_uncertainty_evidence_refused(bundle, mutation):
    def mutate(r):
        if mutation == "gp-pooled":
            r["summary"]["gaussian_process"]["recovery_pct"]["loco_coverage_pooled"] = 0.1
        elif mutation == "gp-cell":
            r["leave_one_case_out"][0]["models"]["gaussian_process"]["recovery_pct"]["coverage_95"] = 1.1
        elif mutation == "guard-rate":
            r["guard"]["false_accept_by_feature"]["feature"] = 2
        elif mutation == "guard-denominator":
            r["guard"]["probe_rows"] = 3
        elif mutation == "seed-identity":
            r["mlp_seeds"]["scores"]["case-a"]["recovery_pct"][0]["evaluation"]["seed"] = 900
        else:
            r["mlp_seeds"]["summary"]["recovery_pct"]["loco_folds"][0]["scored"] = 2
    change_learning(bundle, mutate)
    with pytest.raises(ValueError, match="learning.json"):
        collect(bundle)


def three_case_bundle(bundle):
    record = json.loads((bundle / "learning.json").read_text())
    record["design"]["cases"].append("case-c")
    record["design"]["rows"] = 6
    record["interpolation"]["train_rows"] = 4
    extra = copy.deepcopy(record["leave_one_case_out"][0])
    extra["held_out"] = "case-c"
    for targets in extra["models"].values():
        for score in targets.values():
            score["evaluation"]["fold"] = "case-c"
    record["leave_one_case_out"].append(extra)
    for fold in record["leave_one_case_out"]:
        fold["train_rows"] = 4
    grouped = copy.deepcopy(record["leave_one_case_out"][0])
    grouped.pop("held_out")
    grouped.update(held_out_group="shared", cases=["case-a", "case-b"], train_rows=2, test_rows=4)
    for targets in grouped["models"].values():
        for score in targets.values():
            score["rows"] = score["observable"]["rows"] = 4
            score["evaluation"].update(protocol="transfer", fold="shared")
    record["leave_one_group_out"] = [grouped]
    record["transfer_groups"] = {"case-a": "shared", "case-b": "shared", "case-c": "solo"}
    seeds = record["mlp_seeds"]
    seeds["scores"]["case-c"] = copy.deepcopy(seeds["scores"]["case-a"])
    for scores in seeds["scores"]["case-c"].values():
        for score in scores:
            score["evaluation"]["fold"] = "case-c"
    for target in record["targets"]:
        seeds["summary"][target]["loco_rmse_by_case"]["case-c"] = [1, 1]
        seeds["summary"][target]["loco_folds"] = [{"attempted": 3, "scored": 2, "rejected": 1} for _ in seeds["seeds"]]
        record["summary"]["mlp"][target]["seeds"] = copy.deepcopy(seeds["summary"][target])
    refresh_summaries(record)
    write_json(bundle / "learning.json", record)
    artifact = json.loads((bundle / "cases/case-a.json").read_text())
    artifact.update(case_id="case-c", title={"en": "case-c"})
    write_json(bundle / "cases/case-c.json", artifact)
    manifest = json.loads((bundle / "manifests/case-a.json").read_text())
    manifest.update(case_id="case-c")
    manifest["artifact"].update(path="cases/case-c.json", bytes=(bundle / "cases/case-c.json").stat().st_size,
                                sha256=hashlib.sha256((bundle / "cases/case-c.json").read_bytes()).hexdigest())
    write_json(bundle / "manifests/case-c.json", manifest)
    index = json.loads((bundle / "manifests/index.json").read_text())
    entry = copy.deepcopy(index["cases"][0])
    entry.update(case_id="case-c", title={"en": "case-c"}, manifest_path="manifests/case-c.json", artifact_path="cases/case-c.json")
    index["cases"].append(entry)
    index.update(n_cases=3, n_variants=6)
    write_json(bundle / "manifests/index.json", index)


def test_grouped_and_singleton_transfer_denominators_are_distinct(bundle):
    three_case_bundle(bundle)
    result = collect(bundle)
    assert result["design"]["case_folds"] == 3 and result["design"]["transfer_groups"] == 2
    assert result["design"]["grouped_folds"] == 1
    cohort = result["learning"]["common_cohorts"]["transfer"]["recovery_pct"]
    assert cohort["attempted"] == 2 and cohort["folds"] == ["shared", "solo"]
    rows = [s for s in result["learning"]["scores"] if s["protocol"] == "transfer" and s["model"] == "mlp"
            and s["target"] == "recovery_pct"]
    assert [(r["fold"], r["rows"], r["case_ids"]) for r in rows] == [
        ("shared", 4, ["case-a", "case-b"]), ("solo", 2, ["case-c"])]


def test_adversarial_group_members_cannot_be_omitted(bundle):
    three_case_bundle(bundle)
    change_learning(bundle, lambda r: r["leave_one_group_out"][0]["cases"].pop())
    with pytest.raises(ValueError, match="learning.json.*cases"):
        collect(bundle)


def test_adversarial_output_cannot_drop_null_rows_or_input_hashes(bundle):
    result = collect(bundle)
    markdown = render_markdown(result)
    rejected = [s for s in result["learning"]["scores"] if s["status"] == "rejected-transfer"]
    assert len(rejected) == 6 and all(s["rmse"] is None for s in rejected)
    assert markdown.count("rejected-transfer") == 12  # six main and six seed cells
    for source in result["provenance"]["inputs"]:
        assert source["sha256"] in markdown
    assert "different surviving cohorts" in markdown
    assert "Scored rows" in markdown and "Affected rows" in markdown


def test_adversarial_duplicate_json_keys_refused(bundle):
    path = bundle / "learning.json"
    path.write_text(path.read_text().replace('"engine_version": "fixture"', '"engine_version": "fixture", "engine_version": "forged"'))
    with pytest.raises(ValueError, match="learning.json.*duplicate"):
        collect(bundle)


@pytest.mark.parametrize("file,field", [("manifests/index.json", "cases"), ("manifests/case-a.json", "artifact"),
                                      ("cases/case-a.json", "variants")])
def test_adversarial_missing_required_fields_name_input(bundle, file, field):
    path = bundle / file
    record = json.loads(path.read_text())
    record.pop(field)
    write_json(path, record)
    with pytest.raises(ValueError, match=file.replace("/", r"[/\\]")):
        collect(bundle)


def test_adversarial_junction_output_into_repository_refused(bundle, tmp_path):
    link = tmp_path / "repository-link"
    try:
        link.symlink_to(ROOT, target_is_directory=True)
    except OSError:
        result = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(ROOT)], capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
    destination = link / "must-not-create-results.json"
    result = subprocess.run([sys.executable, str(ROOT / "scripts/collect_results.py"), "--derived", str(bundle),
                             "--json", str(destination)], capture_output=True, text=True)
    assert result.returncode == 1 and "outside the repository" in result.stderr
    assert not destination.exists()


def test_adversarial_existing_outputs_are_never_overwritten(bundle, tmp_path):
    output = tmp_path / "results.json"
    output.write_text("preserve this")
    result = subprocess.run([sys.executable, str(ROOT / "scripts/collect_results.py"), "--derived", str(bundle),
                             "--json", str(output)], capture_output=True, text=True)
    assert result.returncode == 1 and "already exists" in result.stderr
    assert output.read_text() == "preserve this"
