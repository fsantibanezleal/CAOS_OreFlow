"""AB-01 to AB-03: the mechanism ablations. Each switch is on by default and changes nothing when on, every ablated
state still closes its balances, and a case without the mechanism is not applicable rather than a zero effect."""
from __future__ import annotations

import json
from dataclasses import replace
from functools import lru_cache
from pathlib import Path

import pytest

from pipeline.cases.catalog import CASE_BY_ID, CASES
from pipeline.engine.circuit import simulate
from pipeline.methods.ablations import OUTPUTS, SWITCHES, ablate


@lru_cache(maxsize=None)
def _record(case_id: str) -> dict:
    case = CASE_BY_ID[case_id]
    return ablate(case.ore, case.plant, case.nominal)


def test_switches_default_on_and_inert():
    for case in CASES:
        if case.plant.flotation is None:
            continue
        assert case.plant.flotation.cleaner_tail_to_rougher is True  # the engine's default circuit
        explicit = replace(case.plant, flotation=replace(case.plant.flotation, cleaner_tail_to_rougher=True))
        a, b = simulate(case.ore, case.plant, case.nominal).metrics, simulate(case.ore, explicit, case.nominal).metrics
        assert a == b, case.id
    # the record's "on" state is the case itself
    soft = CASE_BY_ID["copper_porphyry_soft"]
    base = simulate(soft.ore, soft.plant, soft.nominal).metrics
    for name, entry in _record("copper_porphyry_soft").items():
        if entry["status"] == "computed":
            assert entry["on"] == {k: float(base[k]) for k in OUTPUTS}, name


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_closure_with_each_switch_off(case_id):
    for name, entry in _record(case_id).items():
        if entry["status"] != "computed":
            continue
        assert entry["balance"] <= 1e-9, (case_id, name, entry["balance"])
        assert "negative_mass" not in entry["flags"], (case_id, name)
        assert set(entry["delta"]) == set(OUTPUTS)
    # AB-02 as amended (W-03): the committed study record names every switch for the case, and declares each one
    study = json.loads((Path(__file__).resolve().parents[1] / "data" / "derived" / "studies.json").read_text(encoding="utf-8"))
    assert list(study["switches"]) == list(SWITCHES)
    assert list(study["cases"][case_id]["ablations"]) == list(SWITCHES)


def test_not_applicable_is_not_zero():
    magnetite = _record("iron_magnetite_fine")
    for name in ("entrainment", "cleaner_recirculation", "regrind", "gravity_bleed"):
        assert magnetite[name] == {"status": "not_applicable"}, name
    assert [c.id for c in CASES if _record(c.id)["gravity_bleed"]["status"] == "computed"] == ["gold_free_milling"]
    regrinds = {c.id for c in CASES if c.plant.flotation is not None and c.plant.flotation.regrind_energy_kwh_t > 0.0}
    assert {c.id for c in CASES if _record(c.id)["regrind"]["status"] == "computed"} == regrinds
    for case in CASES:
        assert list(_record(case.id)) == list(SWITCHES)
