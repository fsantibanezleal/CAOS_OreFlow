"""PE-02: conservation computed from the named streams, independently of the solver."""
from __future__ import annotations

import numpy as np
import pytest

from engine_helpers import all_variants, run_variant


@pytest.mark.parametrize("case_id,variant_id", all_variants())
def test_unit_and_circuit_closure_all_variants(case_id, variant_id):
    result = run_variant(case_id, variant_id)
    assert result.balance["max_relative_error"] < 1e-9, result.balance
    assert result.metrics["species_consistency_error"] < 1e-10
    assert not any(flag["code"] == "negative_mass" for flag in result.flags)


@pytest.mark.parametrize("case_id,variant_id", [v for v in all_variants() if v[1].startswith("cut_")])
def test_cut_mode_closure(case_id, variant_id):
    """CM-05: every unit and the circuit close within 1e-9 relative in the cut mode."""
    result = run_variant(case_id, variant_id)
    assert result.metrics["cut_mode"] == 1.0
    assert result.balance["max_relative_error"] < 1e-9, result.balance
    assert result.metrics["species_consistency_error"] < 1e-10


def _audit_of(result):
    from pipeline.engine.balance import audit

    units = [(u["unit"], [result.streams[n] for n in u["inputs"]], [result.streams[n] for n in u["outputs"]], u["water_added_tph"])
             for u in result.topology]
    return audit(units, result.ore)


def test_the_audit_sees_a_size_class_error():
    """K-01: a stream shifted by one size class at a non-breakage unit must fail the audit; 0.08.001 audited totals only
    and passed a 1% to 8% per-class error at 1e-13."""
    import numpy as np

    result = run_variant("copper_porphyry_soft", "nominal")
    assert _audit_of(result)["max_relative_error"] < 1e-9
    host = result.ore.host
    shifted = result.streams["cyclone_overflow"].solids[host]
    original = shifted.copy()
    try:
        result.streams["cyclone_overflow"].solids[host] = np.roll(original, 1)
        assert _audit_of(result)["max_relative_error"] > 1e-3
    finally:
        result.streams["cyclone_overflow"].solids[host] = original


@pytest.mark.parametrize("case_id", ["copper_porphyry_soft", "nickel_sulphide", "phosphate_clay"])
def test_the_breakage_equations_are_audited(case_id):
    """K-01: the mill (and the regrind where there is one) is audited by its own steady state, T^-1(e) p = m per class."""
    result = run_variant(case_id, "nominal")
    units = result.balance["units"]
    assert 0.0 <= units["mill_equation"] < 1e-12
    if result.flotation is not None and "regrind_product" in result.streams:
        assert 0.0 <= units["regrind_equation"] < 1e-12


def test_negative_mass_is_judged_against_the_mineral_own_flow():
    """K-10: a trace mineral's negative class is reported; 0.08.001 judged every class against the throughput and passed
    -2.3e-7 t/h of electrum, 7% of its stream's electrum."""
    from pipeline.engine.balance import nonnegative
    from pipeline.engine.constants import constant

    result = run_variant("gold_free_milling", "nominal")
    streams = dict(result.streams)
    tail = streams["rougher_tail"]
    electrum = tail.solids["electrum"].copy()
    try:
        tail.solids["electrum"][int(np.argmin(electrum))] = -0.07 * float(electrum.sum())
        assert "rougher_tail" in nonnegative(streams, float(constant("numerics.negative_mass_tolerance")))
    finally:
        tail.solids["electrum"] = electrum
