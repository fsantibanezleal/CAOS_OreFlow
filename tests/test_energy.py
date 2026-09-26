"""PE-09 Bond and operating work index (GMG worked example); PE-10 comparison laws."""
from __future__ import annotations

import pytest

from engine_helpers import run_variant
from pipeline.engine.comminution import bond_energy, operating_work_index
from pipeline.engine.energy import kick, rittinger
from pipeline.methods import oracles


def test_gmg_worked_example():
    # GMG01-MP-2021 sections 4.2.1 and 4.2.2, from the oracle record the benchmark stores
    record = oracles.gmg()
    assert record["within_tolerance"]
    first = record["examples"][0]
    assert first["specific_energy_kwh_t"] == pytest.approx(7.0)
    assert operating_work_index(first["specific_energy_kwh_t"], 2500.0, 212.0) == pytest.approx(14.4, abs=0.05)
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
