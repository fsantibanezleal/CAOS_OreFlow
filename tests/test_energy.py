"""PE-09 Bond and operating work index (GMG worked example); PE-10 comparison laws."""
from __future__ import annotations

import pytest

from engine_helpers import run_variant
from pipeline.engine.comminution import bond_energy, operating_work_index
from pipeline.engine.energy import kick, rittinger


def test_gmg_worked_example():
    # GMG01-MP-2021 section 4.2.1: 3150 kW, 450 t/h, F80 2500 um, P80 212 um, test Wi 16.1 kWh/t.
    w = 3150.0 / 450.0
    assert w == pytest.approx(7.0)
    assert operating_work_index(w, 2500.0, 212.0) == pytest.approx(14.4, abs=0.05)
    # Section 4.2.2: W 8.56 kWh/t, F80 19300 um, P80 155 um gives 11.7 kWh/t.
    assert operating_work_index(8.56, 19300.0, 155.0) == pytest.approx(11.7, abs=0.05)
    assert bond_energy(16.1, 1000.0, 212.0) == pytest.approx(5.97, abs=0.01)


def test_laws_calibrated_and_not_summed():
    wi = 14.0
    reference = bond_energy(wi, 10000.0, 150.0)
    assert rittinger(wi, 10000.0, 150.0) == pytest.approx(reference, rel=1e-12)
    assert kick(wi, 10000.0, 150.0) == pytest.approx(reference, rel=1e-12)
    fine = (rittinger(wi, 10000.0, 40.0), bond_energy(wi, 10000.0, 40.0), kick(wi, 10000.0, 40.0))
    assert fine[0] > fine[1] > fine[2]
    m = run_variant("copper_porphyry_soft", "nominal").metrics
    total = m["specific_energy_crushing_kwh_t"] + m["specific_energy_grinding_kwh_t"] + m["specific_energy_regrind_kwh_t"]
    assert m["specific_energy_total_kwh_t"] == pytest.approx(total, rel=1e-12)
    assert m["specific_energy_total_kwh_t"] < total + 0.5 * m["energy_rittinger_kwh_t"]
