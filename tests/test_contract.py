"""PE-30: one operating contract, exported once, interpreted identically by the API and the browser;
PE-30b: every state the contract accepts is solved by the engine with closed balances."""
from __future__ import annotations

import json
import math

import numpy as np
import pytest

from pipeline.cases.catalog import CASE_BY_ID, CASES
from pipeline.engine.circuit import simulate
from pipeline.engine.model import InfeasibleState, OPERATING_FIELDS, operating_from_dict
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
        # T-50: the Spanish help names the solver in Spanish
        assert "solver" not in spec.help[1], spec.name
    # E-15: the cut mode's cyclone cluster is sized again for every cut, never the plant's fixed hardware
    cut_help = next(s for s in INPUTS if s.name == "d50c_um").help
    assert "hardware and pressure" not in cut_help[0] and "sized again for every cut" in cut_help[0]
    assert "se dimensiona de nuevo para cada corte" in cut_help[1]
    for case in CASES:
        entry = document["cases"][case.id]
        assert entry["family"] == case.plant.family
        assert set(entry["inputs"]) == {s.name for s in INPUTS if case.plant.family in s.families}
        assert validate(document, case.id, {})["accepted"], case.id
        for name, bounds in entry["inputs"].items():
            # the classifier cut's nominal is its off value, the target mode (CM-01)
            assert bounds["min"] <= entry["nominal"][name] <= bounds["max"] or entry["nominal"][name] == bounds.get("off")


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
    # K-04: a JSON integer beyond double range is not finite, as the browser reads it (0.08.001 raised OverflowError)
    assert validate(document, "copper_porphyry_soft", {"throughput_tph": 10 ** 400})["errors"][0]["code"] == "not_finite"
    # K-03: a JavaScript prototype member is an unknown input in both validators
    for name in ("constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"):
        assert validate(document, "copper_porphyry_soft", {name: 1.0})["errors"][0]["code"] == "unknown_input", name
    assert validate(document, "nope", {})["errors"][0]["code"] == "unknown_case"
    at_limit = validate(document, "phosphate_clay", {"target_p80_um": 80.0, "deslime_cut_um": 40.0})
    assert at_limit["accepted"]
    above = validate(document, "phosphate_clay", {"target_p80_um": 79.0, "deslime_cut_um": 40.0})
    assert above["errors"] == [{"code": "deslime_cut_above_half_target", "input": "deslime_cut_um", "value": 40.0, "max": 39.5}]
    several = validate(document, "phosphate_clay", {"deslime_cut_um": 99.0, "unknown": 1, "jg_cm_s": "x"})
    assert sorted(e["code"] for e in several["errors"]) == ["not_a_number", "out_of_range", "unknown_input"]


def _envelope_states(document: dict, case_id: str, samples: int) -> list[dict]:
    """Both corners in both modes, every input at each bound alone, and seeded uniform states that pass the rules, half
    of them in the target mode. Until 0.09.000 both corners and every seeded state set the classifier cut, so the target
    mode, every case's nominal, was never solved with two inputs off nominal (review of 2026-10-04, K-06)."""
    inputs = document["cases"][case_id]["inputs"]
    off = {n: b["off"] for n, b in inputs.items() if "off" in b}
    states = [{n: b["min"] for n, b in inputs.items()}, {n: b["max"] for n, b in inputs.items()}]
    states += [{**state, **off} for state in states]
    for name, bounds in inputs.items():
        states += [{name: bounds["min"]}, {name: bounds["max"]}]
    rng = np.random.default_rng(20260926)
    corners = len(states)
    while len(states) < corners + samples:
        state = {}
        for name, bounds in inputs.items():
            value = bounds["min"] + rng.random() * (bounds["max"] - bounds["min"])
            state[name] = int(round(value)) if isinstance(bounds["min"], int) else float(value)
        if (len(states) - corners) % 2 == 0:
            state.update(off)
        if validate(document, case_id, state)["accepted"]:
            states.append(state)
    return states


def test_the_envelope_gate_solves_the_target_mode_off_nominal():
    """K-06: the gate holds target-mode states with two or more inputs off nominal (none before 0.09.000)."""
    document = build_contract()
    for case in CASES:
        nominal = document["cases"][case.id]["nominal"]
        target = [s for s in _envelope_states(document, case.id, samples=8)
                  if s.get("d50c_um", 0) == 0 and sum(1 for k, v in s.items() if v != nominal.get(k)) >= 2]
        assert len(target) >= 5, case.id


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
        try:
            circuit = simulate(case.ore, case.plant, point)
        except InfeasibleState as refusal:   # E-01: the engine refuses a cut-mode state with no steady state
            assert refusal.code in ("power_unreachable_at_cut", "circulating_load_above_bound", "deslime_cut_above_half_p80"), (state, refusal)
            assert point.d50c_um > 0.0, (state, refusal)   # the target mode is never refused
            continue
        body = trace(circuit, point, case.plant.family)
        json.dumps(body, allow_nan=False)
        codes = {f["code"] for f in body["flags"]}
        assert not codes & {"negative_mass", "non_finite_output"}, (state, body["flags"])
        assert circuit.balance["max_relative_error"] <= 1e-9, (state, circuit.balance["max_relative_error"])
        assert circuit.metrics["species_consistency_error"] <= 1e-9, (state, circuit.metrics["species_consistency_error"])
        assert 0.0 < circuit.metrics["recovery_pct"] < 100.0, state


def test_contract_file_location():
    assert CONTRACT_PATH.parts[-3:] == ("derived", "contract", "operating_contract.json")


# UQ-07, OP-10: the method controls, and the one validator the browser repeats. frontend/src/test/contract.test.ts holds
# the same probe table, so the two languages give the same verdict on every probe.
CONTROL_PROBES = [
    ("uncertainty_seed", 20260926, True, None), ("uncertainty_seed", 0, True, None),
    ("uncertainty_seed", 9007199254740991, True, None), ("uncertainty_seed", 9007199254740992, False, "out_of_range"),
    ("uncertainty_seed", -1, False, "out_of_range"), ("uncertainty_seed", 1.5, False, "not_integer"),
    ("uncertainty_seed", "7", False, "not_a_number"), ("uncertainty_seed", float("nan"), False, "not_finite"),
    ("uncertainty_samples", 128, True, None), ("uncertainty_samples", 32, True, None), ("uncertainty_samples", 512, True, None),
    ("uncertainty_samples", 100, False, "off_step"), ("uncertainty_samples", 16, False, "out_of_range"),
    ("uncertainty_samples", 544, False, "out_of_range"), ("uncertainty_bins", 10, False, "unknown_input"),
    ("optimizer_weight_pct", 100, True, None), ("optimizer_weight_pct", 0, True, None), ("optimizer_weight_pct", 55, True, None),
    ("optimizer_weight_pct", 52, False, "off_step"), ("optimizer_weight_pct", 105, False, "out_of_range"),
    ("optimizer_weight_pct", -5, False, "out_of_range"), ("optimizer_weight_pct", 0.75, False, "not_integer"),
]


def test_uncertainty_controls_declared():
    from pipeline.engine.constants import constant
    from pipeline.io.contract import build_contract, validate_control

    contract = build_contract()
    controls = contract["controls"]
    assert controls["uncertainty_seed"]["default"] == int(constant("uncertainty.seed"))
    assert controls["uncertainty_samples"]["default"] == int(constant("uncertainty.samples"))
    assert controls["optimizer_weight_pct"]["default"] == 100 * constant("optimization.weight_default")
    assert [controls["optimizer_weight_pct"][k] for k in ("min", "max", "step")] == constant("optimization.weight_pct_bounds")
    for spec in controls.values():
        assert spec["label"]["en"] and spec["label"]["es"] and spec["help"]["en"] and spec["help"]["es"]
        assert validate_control(contract, next(k for k, v in controls.items() if v is spec), spec["default"])["accepted"]
    assert "off_step" in contract["messages"]
    for name, value, accepted, code in CONTROL_PROBES:
        verdict = validate_control(contract, name, value)
        assert verdict["accepted"] == accepted, (name, value, verdict)
        if code:
            assert verdict["errors"][0]["code"] == code, (name, value, verdict)


def test_weights_declared():
    """OP-10: the optimizer's weight control is declared from its constants, and the validator holds its step."""
    from pipeline.engine.constants import constant
    from pipeline.io.contract import build_contract, validate_control

    contract = build_contract()
    spec = contract["controls"]["optimizer_weight_pct"]
    assert spec["integer"] and spec["unit"] == "%"
    assert [spec["min"], spec["max"], spec["step"]] == constant("optimization.weight_pct_bounds")
    # every recorded weight is a value of the control, so the workbench can re-run each step of the path
    for weight in [constant("optimization.weight_default"), *constant("optimization.weight_path")]:
        assert validate_control(contract, "optimizer_weight_pct", round(100 * weight))["accepted"]
        assert round(100 * weight) / 100 == weight


def test_cut_mode_declared():
    """CM-01: the classifier cut is declared for every case, bounded by factors of the cut the target mode solves at
    the nominal state, with 0 (the nominal) as the target mode; the learned lane keeps sampling the target mode."""
    from pipeline.cases.catalog import CASES, nominal_cut
    from pipeline.io.contract import INPUT_BY_NAME, build_contract, validate

    contract = build_contract()
    spec = INPUT_BY_NAME["d50c_um"]
    assert spec.bounds == "solved" and (spec.low, spec.high) == (0.8, 1.6)
    for case in CASES:
        bounds = contract["cases"][case.id]["inputs"]["d50c_um"]
        cut = nominal_cut(case.id)
        assert bounds["reference"] == cut and bounds["off"] == 0.0
        assert bounds["min"] == pytest.approx(0.8 * cut, rel=1e-11) and bounds["max"] == pytest.approx(1.6 * cut, rel=1e-11)
        assert contract["cases"][case.id]["nominal"]["d50c_um"] == 0.0
        assert validate(contract, case.id, {"d50c_um": 0.0})["accepted"]
        assert validate(contract, case.id, {"d50c_um": bounds["min"]})["accepted"]
        assert validate(contract, case.id, {"d50c_um": 0.5 * cut})["errors"][0]["code"] == "out_of_range"
    from pipeline.methods.learning import design_states
    states = design_states(CASES[0], contract, 8, 1)
    assert all(s["point"]["d50c_um"] == 0.0 for s in states)
