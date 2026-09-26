"""PE-30: one operating contract, exported once, interpreted identically by the API and the browser;
PE-30b: every state the contract accepts is solved by the engine with closed balances."""
from __future__ import annotations

import json
import math

import numpy as np
import pytest

from pipeline.cases.catalog import CASE_BY_ID, CASES
from pipeline.engine.circuit import simulate
from pipeline.engine.model import OPERATING_FIELDS, operating_from_dict
from pipeline.engine.trace import trace
from pipeline.io.contract import (CONTRACT_PATH, FAMILIES, INPUTS, PROBES_PATH, build_contract, decode_value, load_contract,
                                  probe_document, validate, verdict)

BANNED = (chr(0x2014), chr(0x2192))   # em dash and right arrow (ADR-0067 and the product style)


def test_export_matches_validator():
    committed = load_contract()
    fresh = json.loads(json.dumps(build_contract()))
    assert committed == fresh, "data/derived/contract/operating_contract.json is stale: rerun export_contract()"
    probes = json.loads(PROBES_PATH.read_text(encoding="utf-8"))
    assert probes == json.loads(json.dumps(probe_document(committed))), "contract_probes.json is stale"
    for probe in probes["probes"]:
        values = {k: decode_value(v) for k, v in probe["values"].items()}
        assert verdict(validate(committed, probe["case_id"], values)) == probe["expected"], probe
    codes = {code for p in probes["probes"] for code, _ in p["expected"]["errors"]}
    expected_codes = {"unknown_case", "unknown_input", "not_applicable", "not_a_number", "not_finite", "not_integer",
                      "out_of_range"} | {rule["id"] for rule in committed["rules"]}
    assert codes == expected_codes
    assert any(p["expected"]["accepted"] for p in probes["probes"])


def test_declaration_covers_the_operating_point():
    assert tuple(spec.name for spec in INPUTS) == OPERATING_FIELDS
    document = build_contract()
    for spec in INPUTS:
        assert set(spec.families) <= set(FAMILIES)
        assert spec.low <= spec.high and spec.step > 0.0
        for text in (*spec.label, *spec.help):
            assert text.strip() and not any(ch in text for ch in BANNED)
    for case in CASES:
        entry = document["cases"][case.id]
        assert entry["family"] == case.plant.family
        assert set(entry["inputs"]) == {s.name for s in INPUTS if case.plant.family in s.families}
        assert validate(document, case.id, {})["accepted"], case.id
        for name, bounds in entry["inputs"].items():
            assert bounds["min"] <= entry["nominal"][name] <= bounds["max"]


def test_validator_branches():
    document = build_contract()
    soft = document["cases"]["copper_porphyry_soft"]["inputs"]
    ok = validate(document, "copper_porphyry_soft", {"throughput_tph": soft["throughput_tph"]["max"], "rougher_cells": 10.0})
    assert ok["accepted"] and ok["point"]["rougher_cells"] == 10 and isinstance(ok["point"]["rougher_cells"], int)
    high = validate(document, "copper_porphyry_soft", {"throughput_tph": soft["throughput_tph"]["max"] * 1.001})
    assert high["errors"] == [{"code": "out_of_range", "input": "throughput_tph", "value": soft["throughput_tph"]["max"] * 1.001,
                               "min": soft["throughput_tph"]["min"], "max": soft["throughput_tph"]["max"]}]
    assert validate(document, "copper_porphyry_soft", {"gravity_bleed": 0})["accepted"]
    assert validate(document, "copper_porphyry_soft", {"gravity_bleed": 0.2})["errors"][0]["code"] == "not_applicable"
    assert validate(document, "iron_magnetite_fine", {"collector_gpt": 30.0})["errors"][0]["code"] == "not_applicable"
    assert validate(document, "copper_porphyry_soft", {"rougher_cells": 8.5})["errors"][0]["code"] == "not_integer"
    assert validate(document, "copper_porphyry_soft", {"jg_cm_s": True})["errors"][0]["code"] == "not_a_number"
    assert validate(document, "copper_porphyry_soft", {"jg_cm_s": math.nan})["errors"][0]["code"] == "not_finite"
    assert validate(document, "nope", {})["errors"][0]["code"] == "unknown_case"
    at_limit = validate(document, "phosphate_clay", {"target_p80_um": 80.0, "deslime_cut_um": 40.0})
    assert at_limit["accepted"]
    above = validate(document, "phosphate_clay", {"target_p80_um": 79.0, "deslime_cut_um": 40.0})
    assert above["errors"] == [{"code": "deslime_cut_above_half_target", "input": "deslime_cut_um", "value": 40.0, "max": 39.5}]
    several = validate(document, "phosphate_clay", {"deslime_cut_um": 99.0, "unknown": 1, "jg_cm_s": "x"})
    assert sorted(e["code"] for e in several["errors"]) == ["not_a_number", "out_of_range", "unknown_input"]


def _envelope_states(document: dict, case_id: str, samples: int) -> list[dict]:
    """Both corners, every input at each bound alone, and seeded uniform states that pass the rules."""
    inputs = document["cases"][case_id]["inputs"]
    states = [{n: b["min"] for n, b in inputs.items()}, {n: b["max"] for n, b in inputs.items()}]
    for name, bounds in inputs.items():
        states += [{name: bounds["min"]}, {name: bounds["max"]}]
    rng = np.random.default_rng(20260926)
    while len(states) < 2 + 2 * len(inputs) + samples:
        state = {}
        for name, bounds in inputs.items():
            value = bounds["min"] + rng.random() * (bounds["max"] - bounds["min"])
            state[name] = int(round(value)) if isinstance(bounds["min"], int) else float(value)
        if validate(document, case_id, state)["accepted"]:
            states.append(state)
    return states


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_engine_solves_the_envelope(case_id):
    document = build_contract()
    case = CASE_BY_ID[case_id]
    for state in _envelope_states(document, case_id, samples=8):
        result = validate(document, case_id, state)
        if not result["accepted"]:
            assert [e["code"] for e in result["errors"]] == ["deslime_cut_above_half_target"], (state, result)
            continue
        point = operating_from_dict(result["point"])
        circuit = simulate(case.ore, case.plant, point)
        body = trace(circuit, point, case.plant.family)
        json.dumps(body, allow_nan=False)
        codes = {f["code"] for f in body["flags"]}
        assert not codes & {"negative_mass", "non_finite_output"}, (state, body["flags"])
        assert circuit.balance["max_relative_error"] <= 1e-9, (state, circuit.balance["max_relative_error"])
        assert circuit.metrics["species_consistency_error"] <= 1e-9, (state, circuit.metrics["species_consistency_error"])
        assert 0.0 < circuit.metrics["recovery_pct"] < 100.0, state


def test_contract_file_location():
    assert CONTRACT_PATH.parts[-3:] == ("derived", "contract", "operating_contract.json")
