"""E-11 (review of 2026-10-02): gravity-recoverable gold on the published model's structure (Laplante, Woodcock and
Noaparast 1995, as Vincent 1997 states it). GRG enters liberated with a GRG test's sizes, breaks at Banisi's slower
rate, classifies with the density correction fitted to the measured GRG partitions, and the unit may treat a share
of the mill discharge as the published example does. Until 0.08.000 the gold rode the crushed rock and its liberation
model, classified with Stokes' exponent, and the gold case recovered 13.7 to 31.7% where the published model
recovers 64.1 to 77.1%."""
from __future__ import annotations

import math
from dataclasses import replace

import numpy as np
import pytest

from pipeline.cases.catalog import CASE_BY_ID, SNIP_GRG, SNIP_GRG_CLASSES, SNIP_GRG_SIEVES_UM, GRG_LOWER_UM
from pipeline.engine.circuit import simulate
from pipeline.engine.constants import constant
from pipeline.engine.cyclone import corrected_cut, reduced_partition
from pipeline.engine.grid import grid
from pipeline.engine.grinding import grg_slowdown
from pipeline.methods import oracles

GOLD = CASE_BY_ID["gold_free_milling"]


def _at_discharge(bleed: float):
    plant = replace(GOLD.plant, gravity=replace(GOLD.plant.gravity, position="mill_discharge"))
    return simulate(GOLD.ore, plant, GOLD.nominal.with_values(gravity_bleed=bleed))


def test_grg_enters_with_its_own_sizes():
    """The gold case's GRG enters the mill with Snip's measured sizes, not the crushed rock's."""
    result = simulate(GOLD.ore, GOLD.plant, GOLD.nominal)
    feed = result.streams["new_feed"].solids["electrum"]
    got = oracles.passing_at(feed, list(SNIP_GRG_SIEVES_UM))
    total = sum(SNIP_GRG_CLASSES)
    want = [100.0 * (total - sum(SNIP_GRG_CLASSES[:i + 1])) / total for i in range(len(SNIP_GRG_SIEVES_UM))]
    assert max(abs(a - b) for a, b in zip(got, want)) < 0.7
    below = grid().upper < GRG_LOWER_UM
    assert float(np.sum(feed[1:][below[:-1]])) == 0.0   # nothing finer than the laboratory Knelson's limit
    assert result.streams["crusher_feed"].solids["electrum"] == pytest.approx(feed, rel=0, abs=0)


def test_the_oracle_and_the_case_declare_the_same_grg():
    record = oracles.oracle_data()["laplante"]["grg"]
    assert tuple(record["size_um"]) == SNIP_GRG_SIEVES_UM and tuple(record["class_pct_of_gold"]) == SNIP_GRG_CLASSES
    assert oracles.grg_grains(record) == SNIP_GRG


def test_grg_breaks_at_banisis_rate():
    sizes, slower = constant("gravity.grg_selection_sizes_um"), constant("gravity.grg_selection_slowdown")
    got = grg_slowdown(np.array([10.0, sizes[0], math.sqrt(sizes[0] * sizes[1]), sizes[1], 5000.0]))
    assert got == pytest.approx([slower[0], slower[0], math.sqrt(slower[0] * slower[1]), slower[1], slower[1]], rel=1e-12)


def test_grg_classifies_with_the_fitted_exponent():
    """The GRG cut is the host's times the density ratio to the fitted power; other minerals keep Stokes' 0.5."""
    result = simulate(GOLD.ore, GOLD.plant, GOLD.nominal)
    gr = result.grinding
    n = float(constant("cyclone.grg_density_exponent"))
    rho = {m: s for m, s in [("quartz", 2.65), ("electrum", 15.7)]}
    cut = corrected_cut(gr.cut_um, rho["quartz"], rho["electrum"], n)
    want = gr.bypass + (1.0 - gr.bypass) * reduced_partition(cut, GOLD.plant.cyclone.sharpness)
    # electrum is liberated grains only, so its applied partition is the GRG curve wherever the class holds electrum
    pairs = [(a, w) for a, w in zip(gr.partition["electrum"], want) if a is not None]
    assert len(pairs) > 20 and all(a == pytest.approx(w, rel=1e-12) for a, w in pairs)
    assert cut == pytest.approx(gr.cut_um * (1.65 / 14.7) ** n, rel=1e-9)


def test_the_unit_on_the_mill_discharge_closes():
    """The mill-discharge position: every unit and the circuit close, the whole underflow returns, and the cyclone
    sees the discharge less what the unit took."""
    result = _at_discharge(0.1)
    assert result.balance["max_relative_error"] < 1e-9, result.balance
    assert result.metrics["species_consistency_error"] < 1e-10
    s = result.streams
    for m, mass in s["mill_discharge"].solids.items():
        assert s["sump_feed"].solids[m] == pytest.approx(mass - s["gravity_concentrate"].solids[m], abs=1e-12)
        assert s["recycle"].solids[m] == pytest.approx(s["cyclone_underflow"].solids[m], abs=0)


def test_without_a_bleed_both_positions_agree():
    a = simulate(GOLD.ore, GOLD.plant, GOLD.nominal.with_values(gravity_bleed=0.0)).metrics
    b = _at_discharge(0.0).metrics
    assert a == b


def test_the_case_recovers_within_its_sourced_range():
    """The gold case recovers about 60% of its GRG at a 10% bleed, below the two thirds Laplante says plants have
    never reached, and the GRG circulates far above the ore."""
    m = simulate(GOLD.ore, GOLD.plant, GOLD.nominal).metrics
    low, high = GOLD.kpi_ranges["gravity_recovery_pct"]
    assert low <= m["gravity_recovery_pct"] <= high
    assert m["grg_recovery_pct"] < 200.0 / 3.0
    assert m["gold_circulating_load_pct"] > 3.0 * m["circulating_load_pct"]
