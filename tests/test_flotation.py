"""PE-13 to PE-17: flotation banks, rate from Sb, Savassi entrainment, recycle, stage recoveries."""
from __future__ import annotations

import math

import numpy as np
import pytest

from engine_helpers import flotation_cases, run_variant
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.flotation import bank, bubble_surface_flux, rate_constants, savassi_entrainment
from pipeline.engine.grid import grid
from pipeline.engine.model import Bank
from pipeline.engine.species import species_defs


def test_bank_reduces_to_tanks_in_series():
    n = grid().n
    k = {"a": np.linspace(0.05, 2.0, n)}
    no_entrainment = np.zeros(n)
    bank_def = Bank(cell_volume_m3=100.0, gas_holdup=0.12)
    flow = 30.0
    result = bank(k, no_entrainment, 8, bank_def, flow, 50.0, 0.0)
    tau_bank = 8 * bank_def.cell_volume_m3 * (1.0 - bank_def.gas_holdup) / flow
    expected = 1.0 - np.power(8.0 / (8.0 + k["a"] * tau_bank), 8)
    assert np.allclose(result.recovery["a"], expected, rtol=1e-12)
    assert result.water_recovery == 0.0


def test_rate_follows_bubble_surface_flux():
    case = CASE_BY_ID["copper_porphyry_soft"]
    plant = case.plant.flotation
    sbs = [bubble_surface_flux(jg, plant) for jg in (0.6, 1.0, 1.4, 2.0)]
    assert all(a < b for a, b in zip(sbs, sbs[1:]))
    assert bubble_surface_flux(1.5, plant) == pytest.approx(60.0 * 1.5 / (plant.d32_base_mm + plant.d32_slope_mm_per_cm_s * 1.5))
    result = run_variant(case.id, "nominal")
    defs = species_defs(result.ore)
    k1 = rate_constants(result.ore, defs, 40.0, 25.0)
    k2 = rate_constants(result.ore, defs, 80.0, 25.0)
    for key in k1:
        assert np.allclose(k2[key], 2.0 * k1[key])


def test_savassi_entrainment():
    xi = 30.0
    size = grid().size
    ent = savassi_entrainment(xi, 1.0)
    assert np.all(np.diff(ent[::-1]) <= 1e-12)
    log_size = np.log(size[::-1])
    assert float(np.interp(math.log(xi), log_size, ent[::-1])) == pytest.approx(0.2, abs=0.01)
    assert ent[-1] > 0.9 and ent[0] < 1e-100


@pytest.mark.parametrize("case_id", flotation_cases())
def test_cleaner_recycle_converges(case_id):
    case = CASE_BY_ID[case_id]
    for variant in case.variants:
        f = run_variant(case_id, variant["id"]).flotation
        assert f.residual_tph < 1e-10, (case_id, variant["id"], f.residual_tph, f.iterations)


def test_stage_and_overall_recovery_are_distinct():
    for case_id in ("gold_free_milling", "phosphate_clay"):
        m = run_variant(case_id, "nominal").metrics
        assert abs(m["flotation_recovery_pct"] - m["recovery_pct"]) > 1.0
    for case_id in flotation_cases():
        m = run_variant(case_id, "nominal").metrics
        assert m["rougher_recovery_pct"] != pytest.approx(m["recovery_pct"], abs=0.05)
        assert m["cleaner_recovery_pct"] < 100.0
