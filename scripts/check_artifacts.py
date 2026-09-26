#!/usr/bin/env python3
"""Validate the shipped OreFlow artifacts (Contract 1 and Contract 2) without the scientific stack.

Standard library only, so CI runs it before any install (ADR-0074). It recomputes what can be
recomputed from the stored records instead of trusting them: the contract digest from the contract
file, every unit's mineral, species and water balance from the stored stream records along the
stored topology (PE-02), byte counts and SHA-256 of every artifact, and the internal consistency of
the kinetic, optimization, uncertainty, sensitivity and learning records.
Usage: python scripts/check_artifacts.py [--derived DIR] [--models DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONSTANTS = ROOT / "data-pipeline" / "pipeline" / "engine" / "data" / "constants.json"
N_CASES, N_VARIANTS = 12, 72
BALANCE_TOLERANCE = 1e-9          # PE-02
KINETIC_MODELS = ["first_order", "kelsall", "klimpel", "gamma", "stretched_exponential"]
LEARNING_MODELS = ["ridge", "random_forest", "hist_gradient_boosting", "gaussian_process", "mlp"]
BENCHMARK_METRICS = ("recovery_pct", "concentrate_grade", "head_grade", "recovered_primary_tph",
                     "specific_energy_total_kwh_t", "mill_power_kw", "p80_um", "water_intensity_m3_t")


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _constant(key: str):
    return _load(CONSTANTS)["constants"][key]["value"]


def _relative(a: float, b: float) -> float:
    scale = max(abs(a), abs(b))
    return abs(a - b) / scale if scale > 0.0 else 0.0


def _finite(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def contract_digest(document: dict) -> str:
    body = json.dumps({k: v for k, v in document.items() if k != "digest"}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def check_contract(derived: Path) -> tuple[list[str], str | None]:
    errors: list[str] = []
    path = derived / "contract" / "operating_contract.json"
    if not path.is_file():
        return [f"missing {path.name}"], None
    contract = _load(path)
    digest = contract.get("digest")
    if contract.get("schema") != "oreflow.contract/v1":
        errors.append("contract schema")
    if contract_digest(contract) != digest:
        errors.append("contract digest does not match its content")
    if len(contract.get("cases", {})) != N_CASES:
        errors.append("contract case coverage")
    probes_path = derived / "contract" / "contract_probes.json"
    if not probes_path.is_file() or _load(probes_path).get("digest") != digest:
        errors.append("contract probes missing or built from another contract")
    return errors, digest


def recheck_balance(trace: dict) -> float:
    """Worst relative closure over every unit and the whole circuit, from the stored records only."""
    streams = trace["streams"]
    units = trace["metric_units"]
    minerals = sorted({m for s in streams.values() for m in s["minerals_tph"]})
    species = sorted({sp for s in streams.values() for sp in s["grades"]})
    divisor = {sp: (100.0 if units.get(f"concentrate_{sp}") == "%" else 1.0e6) for sp in species}

    def closure(inputs: list[dict], outputs: list[dict], water_added: float) -> float:
        worst = _relative(sum(s["water_tph"] for s in inputs) + water_added, sum(s["water_tph"] for s in outputs))
        for m in minerals:
            worst = max(worst, _relative(sum(s["minerals_tph"].get(m, 0.0) for s in inputs),
                                         sum(s["minerals_tph"].get(m, 0.0) for s in outputs)))
        for sp in species:
            flow = lambda group: sum(s["solids_tph"] * s["grades"].get(sp, 0.0) / divisor[sp] for s in group)  # noqa: E731
            worst = max(worst, _relative(flow(inputs), flow(outputs)))
        return worst

    worst = 0.0
    for unit in trace["topology"]:
        worst = max(worst, closure([streams[n] for n in unit["inputs"]], [streams[n] for n in unit["outputs"]],
                                   unit["water_added_tph"]))
    products = [streams[n] for n in trace["concentrates"] + trace["tails"]]
    added = sum(unit["water_added_tph"] for unit in trace["topology"])
    return max(worst, closure([streams["crusher_feed"]], products, added))


def check_variant(case_id: str, family: str, variant: dict) -> list[str]:
    errors: list[str] = []
    where = f"{case_id}:{variant.get('id')}"
    trace = variant.get("trace", {})
    if trace.get("schema") != "oreflow.trace/v2":
        return [f"{where}: trace schema"]
    if not all(_finite(v) for v in trace["metrics"].values()):
        errors.append(f"{where}: non-finite metric")
    if any(f["code"] in ("negative_mass", "non_finite_output") for f in trace["flags"]):
        errors.append(f"{where}: engine flag {[f['code'] for f in trace['flags']]}")
    recomputed = recheck_balance(trace)
    if recomputed > BALANCE_TOLERANCE or trace["balance"]["max_relative_error"] > BALANCE_TOLERANCE:
        errors.append(f"{where}: balance {recomputed:.2e} recomputed, {trace['balance']['max_relative_error']:.2e} stored")
    kinetics = trace["methods"]["kinetics"]
    if family == "magnetic":
        if kinetics.get("status") != "not_applicable":
            errors.append(f"{where}: kinetics should be not applicable")
    else:
        if [m["id"] for m in kinetics.get("models", [])] != KINETIC_MODELS:
            errors.append(f"{where}: kinetic model set")
        exact = kinetics.get("bank", {}).get("exact_true_flotation_pct", float("nan"))
        for m in kinetics.get("models", []):
            if not m["converged"]:
                errors.append(f"{where}: kinetic fit {m['id']} did not converge")
            if abs(m["lumping_error_pct"] - (m["bank_projection_pct"] - exact)) > 1e-9:
                errors.append(f"{where}: kinetic lumping error {m['id']}")
    methods = variant.get("methods", {})
    opt = methods.get("optimization", {})
    if opt.get("status") == "optimal":
        optimum = opt.get("optimum") or {}
        limits = {"grade": opt["constraints"]["grade"]["minimum"], "power": opt["constraints"]["power"]["maximum_kw"],
                  "water": opt["constraints"].get("water", {}).get("maximum_m3_t")}
        if not optimum.get("feasible"):
            errors.append(f"{where}: optimum reported but not feasible")
        for name, slack in optimum.get("slacks", {}).items():
            if limits.get(name) and slack / limits[name] < -_constant("optimization.feasibility_tolerance"):
                errors.append(f"{where}: optimum violates {name}")
    elif opt.get("status") == "infeasible":
        if opt.get("optimum") is not None or "least_violating" not in opt:
            errors.append(f"{where}: infeasible record shape")
    else:
        errors.append(f"{where}: optimization status {opt.get('status')}")
    unc = methods.get("uncertainty", {})
    if unc.get("samples") != _constant("uncertainty.samples"):
        errors.append(f"{where}: uncertainty sample count")
    for name, out in unc.get("outputs", {}).items():
        if not out["p05"] <= out["p50"] <= out["p95"]:
            errors.append(f"{where}: quantile order {name}")
    if any(not 0.0 <= p <= 1.0 for p in unc.get("probabilities", {}).values()):
        errors.append(f"{where}: probability outside [0, 1]")
    has_sobol = "sensitivity" in methods
    if has_sobol != (variant["id"] == "nominal"):
        errors.append(f"{where}: Sobol record belongs to the nominal variant only")
    return errors


def check_cases(derived: Path, version: str, digest: str | None) -> list[str]:
    errors: list[str] = []
    index_path = derived / "manifests" / "index.json"
    if not index_path.is_file():
        return ["missing manifests/index.json"]
    index = _load(index_path)
    if index.get("schema") != "oreflow.index/v2" or index.get("n_cases") != N_CASES or index.get("n_variants") != N_VARIANTS:
        errors.append(f"index coverage {index.get('n_cases')} cases, {index.get('n_variants')} variants")
    if index.get("engine_version") != version or index.get("contract_digest") != digest:
        errors.append("index engine version or contract digest")
    for entry in index.get("cases", []):
        manifest_path = derived / entry["manifest_path"]
        if not manifest_path.is_file():
            errors.append(f"missing manifest {entry['manifest_path']}")
            continue
        manifest = _load(manifest_path)
        artifact_path = derived / manifest["artifact"]["path"]
        if not artifact_path.is_file():
            errors.append(f"missing artifact {manifest['artifact']['path']}")
            continue
        data = artifact_path.read_bytes()
        if len(data) != manifest["artifact"]["bytes"] or hashlib.sha256(data).hexdigest() != manifest["artifact"]["sha256"]:
            errors.append(f"byte or hash drift {manifest['artifact']['path']}")
        artifact = json.loads(data.decode("utf-8"))
        if artifact.get("schema") != "oreflow.case/v2" or artifact.get("engine_version") != version \
                or artifact.get("contract_digest") != digest:
            errors.append(f"{entry['case_id']}: artifact schema, version or contract")
        variants = artifact.get("variants", [])
        if len(variants) != 6 or len({v["id"] for v in variants}) != 6 or variants[0]["id"] != "nominal":
            errors.append(f"{entry['case_id']}: variant coverage")
        for variant in variants:
            errors += check_variant(entry["case_id"], artifact["family"], variant)
    # a file the index does not list would still be copied into the site: stale bakes fail here
    listed = {"cases": {entry["artifact_path"] for entry in index.get("cases", [])},
              "manifests": {entry["manifest_path"] for entry in index.get("cases", [])} | {"manifests/index.json"}}
    for folder, expected in listed.items():
        for path in sorted((derived / folder).glob("*.json")):
            if f"{folder}/{path.name}" not in expected:
                errors.append(f"stray artifact {folder}/{path.name}: not in the index")
    return errors


def check_learning(derived: Path, models: Path, version: str, digest: str | None) -> list[str]:
    path = derived / "learning.json"
    if not path.is_file():
        return ["missing learning.json"]
    record = _load(path)
    errors: list[str] = []
    if record.get("schema") != "oreflow.learning/v1" or record.get("models") != LEARNING_MODELS:
        errors.append("learning schema or model set")
    if record.get("engine_version") != version or record.get("contract_digest") != digest:
        errors.append("learning record belongs to another engine version or contract")
    if not record.get("identity", {}).get("hist_gradient_boosting", "").endswith("HistGradientBoostingRegressor"):
        errors.append("gradient boosting is not HistGradientBoostingRegressor")
    folds = record.get("leave_one_case_out", [])
    if len(folds) != N_CASES or len({f["held_out"] for f in folds}) != N_CASES:
        errors.append("leave-one-case-out coverage")
    guard = record.get("guard", {})
    if not (_finite(guard.get("threshold")) and 0.0 <= guard.get("false_alarm_rate", -1) <= 1.0
            and 0.0 <= guard.get("false_accept_rate", -1) <= 1.0):
        errors.append("guard threshold or rates")
    for target in record.get("targets", []):
        gp = record.get("interpolation", {}).get("models", {}).get("gaussian_process", {}).get(target, {})
        if not 0.0 <= gp.get("coverage_95", -1) <= 1.0:
            errors.append(f"GP coverage {target}")
    tolerance = _constant("learning.onnx_tolerance")
    for export in record.get("final", {}).get("exports", {}).values():
        file = models / export["path"]
        if not file.is_file() or file.stat().st_size != export["bytes"] or export["max_abs_difference"] > tolerance:
            errors.append(f"ONNX export {export['path']}")
    return errors


def check_benchmark(derived: Path, version: str, digest: str | None) -> list[str]:
    path = derived / "benchmark.json"
    if not path.is_file():
        return ["missing benchmark.json"]
    b = _load(path)
    errors: list[str] = []
    if b.get("schema") != "oreflow.benchmark/v2" or b.get("case_count") != N_CASES or b.get("variant_count") != N_VARIANTS:
        errors.append("benchmark schema or coverage")
    if b.get("engine_version") != version or b.get("contract_digest") != digest:
        errors.append("benchmark engine version or contract digest")
    o = b.get("oracles", {})
    checks = [o.get("molycop", {}).get("within_tolerance"), o.get("gmg", {}).get("within_tolerance"),
              o.get("laplante", {}).get("rising"), o.get("laplante", {}).get("diminishing"),
              o.get("laplante", {}).get("gold_above_ore"), o.get("zandrivierspoort", {}).get("finer_grind_raises_grade")]
    if not all(checks):
        errors.append("an oracle check failed")
    # the per-variant summaries the Compare view plots must be the case artifacts' own metrics
    for case in b.get("cases", []):
        artifact_path = derived / "cases" / f"{case.get('case_id')}.json"
        if not artifact_path.is_file():
            errors.append(f"benchmark case without an artifact: {case.get('case_id')}")
            continue
        variants = _load(artifact_path).get("variants", [])
        if set(case.get("variants", {})) != {v["id"] for v in variants}:
            errors.append(f"benchmark variant coverage: {case.get('case_id')}")
            continue
        for v in variants:
            row = case["variants"][v["id"]]
            for key in BENCHMARK_METRICS:
                if row.get(key) != v["trace"]["metrics"].get(key):
                    errors.append(f"benchmark {case['case_id']}:{v['id']} {key} differs from the case artifact")
    return errors


def check_particles(derived: Path, models: Path) -> list[str]:
    errors: list[str] = []
    path = derived / "source" / "hzdr_particle_benchmark.json"
    if not path.is_file() or not (models / "particle_mlp.onnx").is_file():
        return ["missing HZDR particle benchmark or its ONNX model"]
    particle = _load(path)
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
            if not all(_finite(model.get(metric, float("nan"))) for metric in ("rmse", "mae", "bias")):
                errors.append(f"particle metric: {case.get('case')}:{model_id}")
            thresholds = model.get("thresholds", [])
            if len(thresholds) != 101 or any(abs(row["threshold"] - i / 100) > 1e-9 for i, row in enumerate(thresholds)):
                errors.append(f"particle thresholds: {case.get('case')}:{model_id}")
            elif any(thresholds[i + 1][field] > thresholds[i][field] + 1e-5 for field in ("selected_fraction", "expected_recovery")
                     for i in range(100)):
                errors.append(f"nonmonotone particle threshold: {case.get('case')}:{model_id}")
            if sum(row.get("count", 0) for row in model.get("calibration", [])) != case.get("test_rows"):
                errors.append(f"particle calibration population: {case.get('case')}:{model_id}")
    return errors


def check_geomet(derived: Path) -> list[str]:
    errors: list[str] = []
    path = derived / "source" / "geomet_lct_benchmark.json"
    if not path.is_file():
        return ["missing measured GeoMet LCT benchmark"]
    geomet = _load(path)
    source = geomet.get("source", {})
    models = {"train_mean", "ridge", "random_forest", "gaussian_process"}
    if geomet.get("schema") != "oreflow.geomet-lct/v1" or (source.get("raw_rows"), source.get("usable_rows"), source.get("holes")) != (53, 52, 29):
        errors.append("GeoMet source population or schema")
    if source.get("sha256") != "e7968c250c1ccc17b63da6d9624473dd92b32a7ba8d8772e70070a0115e42eda":
        errors.append("GeoMet source SHA256")
    for name, n_folds in (("hole", 5), ("zone", 3)):
        protocol = geomet.get("protocols", {}).get(name, {})
        if len(protocol.get("folds", [])) != n_folds or len(protocol.get("rows", [])) != 52:
            errors.append(f"GeoMet {name} coverage")
        if set(protocol.get("scores", {})) != models:
            errors.append(f"GeoMet {name} model matrix")
        for model in protocol.get("scores", {}).values():
            if not all(_finite(model.get(key, float("nan"))) for key in ("mae_pp", "rmse_pp", "bias_pp", "r2")):
                errors.append(f"GeoMet {name} invalid score")
        for row in protocol.get("rows", []):
            if set(row.get("predictions_pct", {})) != models:
                errors.append(f"GeoMet {name} incomplete prediction")
        boot = protocol.get("paired_bootstrap", {})
        if boot.get("unit") != "complete hole" or len(boot.get("rmse_differences", {})) != 6:
            errors.append(f"GeoMet {name} paired bootstrap")
    return errors


def run(derived: Path, models: Path) -> list[str]:
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    contract_errors, digest = check_contract(derived)
    return (contract_errors + check_cases(derived, version, digest) + check_learning(derived, models, version, digest)
            + check_benchmark(derived, version, digest) + check_particles(derived, models) + check_geomet(derived))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--derived", type=Path, default=ROOT / "data" / "derived")
    parser.add_argument("--models", type=Path, default=ROOT / "models")
    args = parser.parse_args()
    errors = run(args.derived, args.models)
    if errors:
        print("ARTIFACT DRIFT:")
        print("\n".join(f"  - {error}" for error in errors[:200]))
        return 1
    print(f"ARTIFACTS OK: contract, {N_CASES} cases, {N_VARIANTS} variants with recomputed balances and method records; "
          "learning, benchmark, HZDR particle and GeoMet lanes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
