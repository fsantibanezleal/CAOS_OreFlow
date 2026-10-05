"""PE-13 to PE-17: flotation banks, rate from Sb, Savassi entrainment, recycle, stage recoveries."""
from __future__ import annotations

import math

import numpy as np
import pytest

from engine_helpers import flotation_cases, run_variant
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.flotation import bank, bubble_surface_flux, pulp_flow_m3_min, rate_constants, savassi_entrainment
from pipeline.engine.grid import grid
from pipeline.engine.model import Bank
from pipeline.engine.species import SpeciesDef, species_defs

ONE = [SpeciesDef("a", "a", "free", (("a", 1.0),), 2.7)]


def test_bank_reduces_to_tanks_in_series():
    """With a trace of solids and no floating water, every cell's tail flow is its feed flow, and the bank is the
    tanks-in-series result on the bank residence."""
    n = grid().n
    k = {"a": np.linspace(0.05, 2.0, n)}
    no_entrainment = np.zeros(n)
    bank_def = Bank(cell_volume_m3=100.0, gas_holdup=0.12)
    feed = {"a": np.full(n, 1e-12)}
    water = 30.0 * 60.0             # 30 m3/min
    result = bank(k, no_entrainment, 8, bank_def, feed, water, ONE, 50.0, 0.0)
    tau_bank = 8 * bank_def.cell_volume_m3 * (1.0 - bank_def.gas_holdup) / pulp_flow_m3_min(feed, ONE, water)
    expected = 1.0 - np.power(8.0 / (8.0 + k["a"] * tau_bank), 8)
    assert np.allclose(result.recovery["a"], expected, rtol=1e-12)
    assert result.water_recovery == 0.0


def test_a_cell_takes_its_residence_on_its_own_tail_flow():
    """F-02: the single-cell balance (the tail carries the pulp composition) needs tau = V (1 - eps_g) / Q_tail. A cell
    with a heavy pull: 0.08.001 took the feed flow, and its residence was 21% short."""
    n = grid().n
    k = {"a": np.full(n, 3.0)}
    ent = np.full(n, 0.5)
    bank_def = Bank(cell_volume_m3=100.0, gas_holdup=0.12)
    feed = {"a": np.full(n, 600.0 / n)}
    water, sb, water_floatability = 900.0, 40.0, 2.0e-5
    result = bank(k, ent, 1, bank_def, feed, water, ONE, sb, water_floatability)
    r = result.cell_recovery[0]["a"]
    tail_flow = pulp_flow_m3_min({"a": feed["a"] * (1.0 - r)}, ONE, water * (1.0 - result.water_recovery))
    tau = bank_def.cell_volume_m3 * (1.0 - bank_def.gas_holdup) / tail_flow
    assert result.cell_residence_min[0] == pytest.approx(tau, rel=1e-12)
    w = 60.0 * water_floatability * sb * tau
    assert result.water_recovery == pytest.approx(w / (1.0 + w), rel=1e-12)
    expected = (3.0 * tau + 0.5 * w) / (1.0 + 3.0 * tau + 0.5 * w)
    assert np.allclose(r, expected, rtol=1e-12)
    assert tau > 1.2 * bank_def.cell_volume_m3 * (1.0 - bank_def.gas_holdup) / pulp_flow_m3_min(feed, ONE, water)


def test_a_bank_is_its_cells_in_series():
    """F-02: N cells are N single cells, each fed the tail of the one before."""
    n = grid().n
    k = {"a": np.linspace(0.05, 2.0, n)}
    ent = np.full(n, 0.3)
    bank_def = Bank(cell_volume_m3=50.0, gas_holdup=0.1)
    feed = {"a": np.full(n, 400.0 / n)}
    water = 700.0
    whole = bank(k, ent, 4, bank_def, feed, water, ONE, 30.0, 2.0e-5)
    x, wt = dict(feed), water
    unfloated = np.ones(n)
    for _ in range(4):
        one = bank(k, ent, 1, bank_def, x, wt, ONE, 30.0, 2.0e-5)
        unfloated *= 1.0 - one.recovery["a"]
        x = {"a": x["a"] * (1.0 - one.recovery["a"])}
        wt *= 1.0 - one.water_recovery
    assert np.allclose(whole.recovery["a"], 1.0 - unfloated, rtol=1e-12)
    assert whole.residence_min == pytest.approx(sum(whole.cell_residence_min), rel=1e-15)
    assert len(set(whole.cell_residence_min)) == 4


def test_composite_rate_goes_with_the_valuable_volume_share():
    """F-01: the exposed valuable surface of a composite goes as phi^(2/3), phi the valuable's volume share; 0.08.001
    used the mass content, 1.21 times too fast for chalcopyrite in quartz at c = 0.42."""
    result = run_variant("copper_porphyry_soft", "nominal")
    ore = result.ore
    defs = species_defs(ore)
    rates = rate_constants(ore, defs, 50.0, 30.0)
    c = ore.spec["chalcopyrite"].composite_content
    rho_v, rho_h = ore.density["chalcopyrite"], ore.density[ore.host]
    phi = (c / rho_v) / (c / rho_v + (1.0 - c) / rho_h)
    ratio = rates["chalcopyrite:composite"] / rates["chalcopyrite:liberated"]
    assert np.allclose(ratio[np.isfinite(ratio)], phi ** (2.0 / 3.0), rtol=1e-12)


@pytest.mark.parametrize("case_id", flotation_cases())
def test_rougher_metrics_share_the_rougher_basis(case_id):
    """F-05, K-09: the rougher mass pull is on the rougher's own feed, like its recovery. F-04, K-08: the entrained share
    is the share of the rougher concentrate's free gangue the rougher recovered by entrainment."""
    result = run_variant(case_id, "nominal")
    f, m = result.flotation, result.metrics
    s = f.streams
    assert m["rougher_mass_pull_pct"] == pytest.approx(100.0 * s["rougher_concentrate"].tph() / s["rougher_feed"].tph(), rel=1e-12)
    free = [d for d in f.defs if d.kind == "free"]
    conc = {d.id: f.rougher_feed_species[d.id] * f.rougher.recovery[d.id] for d in free}
    want = 100.0 * sum(float(np.sum(conc[d.id] * f.rougher.entrained_share[d.id])) for d in free) / sum(float(np.sum(conc[d.id])) for d in free)
    assert m["entrained_gangue_share_pct"] == pytest.approx(want, rel=1e-12)


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
        assert f.relative_change < 1e-12, (case_id, variant["id"], f.relative_change, f.iterations)


@pytest.mark.parametrize("case_id", flotation_cases())
def test_recovery_by_size_is_empty_only_in_the_tails(case_id):
    """The payable's recovery by size is a fraction where a class holds payable and null where it holds
    none that float64 can resolve: never a zero invented for an empty class (PE-31)."""
    curve = run_variant(case_id, "nominal").curves["recovery_by_size"]["primary"]
    present = [i for i, value in enumerate(curve) if value is not None]
    assert len(present) >= 20
    assert present == list(range(present[0], present[-1] + 1))
    assert curve[0] is None                       # the coarsest class never reaches the rougher
    assert all(0.0 <= curve[i] <= 1.0 for i in present)


def test_stage_and_overall_recovery_are_distinct():
    # the gravity unit takes its share first, so the overall recovery is g + (1 - g) f, not the flotation stage's
    m = run_variant("gold_free_milling", "nominal").metrics
    g, f = m["gravity_recovery_pct"], m["flotation_recovery_pct"]
    assert m["recovery_pct"] == pytest.approx(g + (100.0 - g) * f / 100.0, abs=1e-6) and abs(f - m["recovery_pct"]) > 0.5
    m = run_variant("phosphate_clay", "nominal").metrics
    assert abs(m["flotation_recovery_pct"] - m["recovery_pct"]) > 1.0
    for case_id in flotation_cases():
        m = run_variant(case_id, "nominal").metrics
        assert m["rougher_recovery_pct"] != pytest.approx(m["recovery_pct"], abs=0.05)
        assert m["cleaner_recovery_pct"] < 100.0
