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


def test_bond_feed_factor_disclosure():
    """E-18: the Methodology's figures for the oversize-feed factor the Bond requirement leaves out (Rowland's EF4 at
    F0 = 4000 (13/Wi)^0.5 um) and the efficiency ratios with and without it."""
    import math

    from pipeline.cases.catalog import CASES

    ratio, ef4, eff, eff4 = [], [], [], []
    for case in CASES:
        m = run_variant(case.id, "nominal").metrics
        wi, feed, product = case.nominal.work_index_kwh_t, m["crusher_p80_um"], m["p80_um"]
        assert feed == pytest.approx(8418.0, abs=1.0)
        f0 = 4000.0 * math.sqrt(13.0 / wi)
        rr = feed / product
        factor = (rr + (wi - 7.0) * (feed - f0) / f0) / rr
        ratio.append(feed / f0), ef4.append(factor), eff.append(m["bond_efficiency_ratio"]), eff4.append(m["bond_efficiency_ratio"] * factor)
    assert (round(min(ratio), 1), round(max(ratio), 1)) == (1.7, 2.5)
    assert (round(min(ef4), 2), round(max(ef4), 2)) == (1.02, 1.34)
    assert (round(min(eff), 2), round(max(eff), 2)) == (0.83, 0.91)
    assert (round(min(eff4), 2), round(max(eff4), 2)) == (0.88, 1.17)


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


def test_bond_efficiency_is_qualified_below_70_um():
    """C-02: GMG01-MP-2021 qualifies the Bond efficiency below about 70 um; the magnetite nominal (60 um) carries the flag,
    a coarser one does not."""
    codes = [f["code"] for f in run_variant("iron_magnetite_fine", "nominal").flags]
    assert "bond_efficiency_fine_product" in codes
    assert "bond_efficiency_fine_product" not in [f["code"] for f in run_variant("copper_porphyry_soft", "nominal").flags]
