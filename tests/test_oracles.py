"""Published-example oracles: Moly-Cop base case (PE-08), GMG worked examples (PE-09), Laplante gravity
trend (PE-18), Zandrivierspoort grind-grade trend (PE-19). Each is a published example, not plant data.
The records come from pipeline.methods.oracles, the same computation the benchmark stores."""
from __future__ import annotations

import pytest

from pipeline.engine.grid import grid
from pipeline.methods import oracles


def test_molycop_base_case():
    """PE-08: the BallSim_Direct base case with every published input and its own breakage parameters. P80 and the
    circulating load are inputs the solver meets. The net specific energy is compared with the published 3,885 kW over
    504 t/h within 20%; the corrected cut, the water bypass and the overflow distribution with the published classifier
    state. Until 0.08.000 the oracle used another example's parameter guesses, an authored feed and classifier, and
    compared with the gross energy (E-05, E-08)."""
    record = oracles.molycop()
    for key in ("p80_um", "circulating_load"):
        assert abs(record["inputs"][key]["relative_error"]) <= 1e-6, key
    c = record["comparison"]
    assert c["net_specific_energy_kwh_t"]["published"] == pytest.approx(3885.0 / 504.0)
    assert abs(c["net_specific_energy_kwh_t"]["relative_error"]) <= 0.20 and record["within_tolerance"]
    assert abs(c["cut_um"]["relative_error"]) < 0.05
    assert abs(c["water_bypass"]["engine"] - c["water_bypass"]["published"]) < 0.005
    assert c["overflow_passing_max_abs_difference_pct"] < 1.0


def test_molycop_feed_is_the_published_distribution():
    pub = oracles.oracle_data()["molycop"]["published"]
    feed = oracles.molycop_feed()
    assert feed.sum() == pytest.approx(1.0)
    # the top sieve (100% at 25.4 mm) carries the grid's class-width interpolation, 0.63 points; the rest is within 0.3
    gaps = [abs(got - want) for got, want in zip(oracles.passing_at(feed, pub["size_um"]), pub["feed_passing_pct"])]
    assert gaps[0] < 1.0 and max(gaps[1:]) < 0.3, gaps
    assert abs(grid().p80(feed) / pub["feed_f80_um"] - 1.0) < 0.01


def test_plitt_sizing_is_a_stated_failure():
    """E-07: the engine's uncalibrated Plitt equations miss both published classifier states, and the cluster sized from
    the cut is smaller than the published one. The factors that reproduce each state differ in the ratio of Moly-Cop's
    own printed constants (a2 on the cut, a1 on the pressure), so the form matches and only the calibration is missing."""
    sizing = oracles.molycop()["sizing"]
    for name, example in sizing["examples"].items():
        assert example["plitt_at_published_flow"]["cut_um"] > 1.3 * example["published"]["d50c_um"], name
        assert example["plitt_at_published_flow"]["pressure_kpa"] > 1.5 * example["published"]["pressure_kpa"], name
        assert example["sized_for_published_cut"]["cyclones"] < example["published"]["cyclones"], name
    r = sizing["ratio"]
    assert abs(r["engine_cut"] / r["molycop_a2"] - 1.0) < 0.1
    assert abs(r["engine_pressure"] / r["molycop_a1"] - 1.0) < 0.1


def test_gmg_examples():
    record = oracles.gmg()
    assert record["within_tolerance"]
    assert [round(r["engine_operating_work_index_kwh_t"], 1) for r in record["examples"]] == [14.4, 11.7]


def test_laplante_like_for_like():
    """E-11: the published simulator example run like for like, with the tolerances set before the first run. The
    declared run (Snip's measured GRG) misses: even a perfect unit leaves the GRG recovery 5 to 10 points low, because
    GRG finer than about 37 um escapes the cyclone. Without the GRG finer than 25 um the printed recovery returns
    within about a point from the 20% row on. The record says which, and the trends and the shape check hold."""
    record = oracles.laplante()
    pub, e, w = record["published"], record["engine"], record["without_grg_below_25um"]
    assert pub["grg_circulating_load_pct"] == [2016.31, 1125.32, 784.35, 602.84, 511.11, 412.63]
    assert pub["bleed_stream"] == "mill_discharge"
    tol = record["tolerance"]
    for series in (e, w):
        stated = (all(abs(x) <= tol["grg_recovery_points"] for x in series["grg_recovery_difference_points"])
                  and all(abs(x) <= tol["grg_circulating_load_relative"] for x in series["grg_circulating_load_relative_error"]))
        assert series["within_tolerance"] == stated
    assert e["fit_at_bound"] and e["max_recovery"] == 1.0
    assert all(-11.0 < x < -5.0 for x in e["grg_recovery_difference_points"])
    assert not w["fit_at_bound"] and all(abs(x) < 1.5 for x in w["grg_recovery_difference_points"][1:])
    assert all(abs(x - q) < 1.5 for x, q in zip(e["discharge_grg_below_150um_pct"], pub["discharge_grg_below_150um_pct"]))
    assert record["rising"] and record["diminishing"] and record["grg_above_ore_without_gravity"]
    for x, q in zip(e["gold_recovery_pct"], e["grg_recovery_pct"]):
        assert x == pytest.approx(pub["grg_share_of_gold"] * q, abs=0.05)   # plus the pyrite gold in the unit's gangue yield


def test_zandrivierspoort_trend():
    # Muthaphuli (2014): a finer grind raises the LIMS concentrate Fe grade (64.9% at 80% -75 um,
    # 69.0% at 80% -45 um)
    record = oracles.zandrivierspoort()
    coarse, fine = record["engine"]["concentrate_fe_pct"]
    assert record["finer_grind_raises_grade"] and fine - coarse > 1.5
    assert 62.0 < coarse < 67.0 and 66.0 < fine < 71.0
    # E-10: the gap, the silica and the rougher stage at 75 um are recorded; the 45 um point is a regrind product
    assert record["gap_fe_pct_points"] == [e - q for e, q in zip(record["engine"]["concentrate_fe_pct"], record["published"]["concentrate_fe_pct"])]
    silica = record["engine"]["concentrate_silica_pct"]
    assert silica[1] < silica[0]
    rougher = record["engine"]["rougher_75"]
    assert 90.0 < rougher["magnetite_recovery_pct"] <= 100.0 and rougher["concentrate_fe_pct"] < coarse
    assert "regrind" in record["published"]["grinds"][1] and record["published"]["grind_75_passing_pct"] == 66.8
