"""PE-05 target and circulating load; PE-06 steady-state delivery; PE-07 power-limited mode."""
from __future__ import annotations

from dataclasses import replace

import numpy as np
import pytest

from engine_helpers import run_variant
from pipeline.cases.catalog import CASE_BY_ID, CASES
from pipeline.engine.circuit import simulate


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_target_and_circulating_load_met(case_id):
    result = run_variant(case_id, "nominal")
    g = result.grinding
    assert not g.power_limited
    assert abs(g.p80_um / g.target_p80_um - 1.0) < 0.005
    assert abs(g.circulating_load / CASE_BY_ID[case_id].nominal.circulating_load - 1.0) < 0.005


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_overflow_equals_new_feed_by_mineral(case_id):
    result = run_variant(case_id, "nominal")
    s = result.streams
    for mineral in result.ore.ids:
        delivered = s["cyclone_overflow"].mineral_tph(mineral)
        if "gravity_concentrate" in s:
            delivered += s["gravity_concentrate"].mineral_tph(mineral)
        assert np.isclose(delivered, s["new_feed"].mineral_tph(mineral), rtol=1e-9, atol=1e-12)


def test_power_limited_mode():
    case = CASE_BY_ID["copper_porphyry_soft"]
    required = run_variant(case.id, "nominal").metrics["required_mill_power_kw"]
    plant = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=0.7 * required))
    result = simulate(case.ore, plant, case.nominal)
    m = result.metrics
    assert m["power_limited"] == 1.0
    assert m["mill_power_kw"] == pytest.approx(0.7 * required, rel=1e-9)
    assert m["p80_um"] > case.nominal.target_p80_um * 1.05
    assert any(flag["code"] == "power_limited" for flag in result.flags)
