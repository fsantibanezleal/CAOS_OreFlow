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
