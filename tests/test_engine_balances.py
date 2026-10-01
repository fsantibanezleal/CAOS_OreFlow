"""PE-02: conservation computed from the named streams, independently of the solver."""
from __future__ import annotations

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
