"""Published-example oracles: Moly-Cop base case (PE-08), GMG worked examples (PE-09), Laplante gravity
trend (PE-18), Zandrivierspoort grind-grade trend (PE-19). Each is a published example, not plant data.
The records come from pipeline.methods.oracles, the same computation the benchmark stores."""
from __future__ import annotations

from pipeline.methods import oracles


def test_molycop_base_case():
    # BallSim_Direct base case: 504 t/h, F80 6913 um, P80 169.4 um, CL 277%, gross 8.56 kWh/t, with the
    # BallParam_Direct default breakage parameters.
    record = oracles.molycop()
    assert abs(record["relative_error"]["p80_um"]) <= 0.005
    assert abs(record["relative_error"]["circulating_load"]) <= 0.005
    assert abs(record["relative_error"]["gross_specific_energy_kwh_t"]) <= 0.20
    assert record["within_tolerance"]


def test_gmg_examples():
    record = oracles.gmg()
    assert record["within_tolerance"]
    assert [round(r["engine_operating_work_index_kwh_t"], 1) for r in record["examples"]] == [14.4, 11.7]


def test_laplante_trend():
    # gravity gold recovery rises with the fraction of underflow treated, with diminishing returns, and
    # gold circulating load far exceeds the ore's, as in the Laplante and Staunton simulator example
    record = oracles.laplante()
    assert record["rising"] and record["diminishing"] and record["gold_above_ore"]


def test_zandrivierspoort_trend():
    # Muthaphuli (2014): a finer grind raises the LIMS concentrate Fe grade (64.9% at 80% -75 um,
    # 69.0% at 80% -45 um)
    record = oracles.zandrivierspoort()
    coarse, fine = record["engine"]["concentrate_fe_pct"]
    assert record["finer_grind_raises_grade"] and fine - coarse > 1.5
    assert 62.0 < coarse < 67.0 and 66.0 < fine < 71.0
