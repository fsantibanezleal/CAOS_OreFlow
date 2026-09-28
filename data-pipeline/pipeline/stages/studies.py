"""The studies stage: the mechanism ablations and the uncertainty seed study of every nominal state (AB-03).

Both are counterfactual or repeated runs of the engine at a case's nominal state, not method records of a variant,
so they get their own record, ``studies.json``. The ablations take each mechanism away in turn
(``methods/ablations.py``). The seed study re-runs the nominal uncertainty record at eight declared seeds with the
default sample count, and reports how far its quantiles and its joint probability move between seeds: the design's
own sampling error, which a single seed cannot show.
"""
from __future__ import annotations

from typing import Any

from ..cases.catalog import CASE_BY_ID
from ..engine.constants import constant
from ..methods.ablations import SWITCHES, ablate
from ..methods.uncertainty import uncertainty

SCHEMA = "oreflow.studies/v1"
SEED_OUTPUTS = ("recovery_pct", "concentrate_grade")
QUANTILES = ("p05", "p50", "p95")


def seed_study(case_id: str) -> dict[str, Any]:
    case = CASE_BY_ID[case_id]
    seeds = [int(s) for s in constant("studies.seed_study_seeds")]
    samples = int(constant("uncertainty.samples"))
    per_seed = []
    for seed in seeds:
        record = uncertainty(case, case.nominal, samples=samples, seed=seed)
        per_seed.append({"seed": seed,
                         **{k: {q: record["outputs"][k][q] for q in QUANTILES} for k in SEED_OUTPUTS},
                         "all_constraints": record["probabilities"]["all_constraints"]})
    spread = {k: {q: max(r[k][q] for r in per_seed) - min(r[k][q] for r in per_seed) for q in QUANTILES} for k in SEED_OUTPUTS}
    spread["all_constraints"] = max(r["all_constraints"] for r in per_seed) - min(r["all_constraints"] for r in per_seed)
    return {"seeds": seeds, "samples": samples, "design": "Latin hypercube", "generator": "SplitMix64",
            "per_seed": per_seed, "spread": spread}


def study_case(case_id: str) -> dict[str, Any]:
    """One case's studies; the pipeline runs one worker per case."""
    case = CASE_BY_ID[case_id]
    return {"case_id": case_id, "ablations": ablate(case.ore, case.plant, case.nominal), "seed_study": seed_study(case_id)}


def build(cases: list[dict[str, Any]], version: str, digest: str) -> dict[str, Any]:
    return {
        "schema": SCHEMA, "engine_version": version, "contract_digest": digest,
        "switches": {name: {"removes": {"en": removes[0], "es": removes[1]}} for name, (removes, _, _) in SWITCHES.items()},
        "cases": {c["case_id"]: {"ablations": c["ablations"], "seed_study": c["seed_study"]} for c in cases},
    }
