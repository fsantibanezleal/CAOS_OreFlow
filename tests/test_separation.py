"""PE-18 gravity in the grinding loop; PE-19 magnetite grade and grind; PE-20 desliming trade-off."""
from __future__ import annotations


import numpy as np
import pytest

from engine_helpers import run_point, run_variant
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate


def test_bleed_response_and_gold_circulating_load():
    """PE-18 as restated in 0.08.000 (E-11): the GRG circulates above the ore without gravity and across the 5 to 25%
    of the stream that practice treats; at 60% the rebuilt model strips it below the ore's load, because its unit
    keeps 70% per pass where the published simulator's recovery falls with its feed rate."""
    case = CASE_BY_ID["gold_free_milling"]
    for bleed in (0.0, 0.05, 0.1, 0.15, 0.2, 0.25):
        m = run_point(case.id, case.nominal.with_values(gravity_bleed=bleed)).metrics
        assert m["gold_circulating_load_pct"] > m["circulating_load_pct"], bleed
    recoveries = []
    for bleed in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6):
        m = run_point(case.id, case.nominal.with_values(gravity_bleed=bleed)).metrics
        recoveries.append(m["gravity_recovery_pct"])
    steps = [b - a for a, b in zip(recoveries, recoveries[1:])]
    assert all(s > 0.0 for s in steps)
    assert all(b <= a + 1e-9 for a, b in zip(steps, steps[1:]))


def test_grade_rises_with_finer_grind():
    case = CASE_BY_ID["iron_magnetite_fine"]
    grades = []
    for p80 in (75.0, 60.0, 45.0):
        m = run_point(case.id, case.nominal.with_values(target_p80_um=p80), unlimited_power=True).metrics
        assert m["magnetite_recovery_pct"] > 90.0
        grades.append(m["concentrate_grade"])
    assert grades[0] < grades[1] < grades[2]


def test_deslime_cut_tradeoff():
    case = CASE_BY_ID["phosphate_clay"]
    losses = []
    for cut in (12.0, 20.0, 30.0, 40.0):
        m = run_point(case.id, case.nominal.with_values(deslime_cut_um=cut)).metrics
        losses.append(m["slimes_loss_pct"])
        assert m["slimes_mass_pct"] > 0.0
    assert all(a < b for a, b in zip(losses, losses[1:]))
    base = run_variant(case.id, "nominal").streams
    assert base["slimes"].tph() > 0.0
    assert "slimes" in run_variant(case.id, "nominal").tails


def _underflow_solids(result):
    u = result.streams["deslime_underflow"]
    return u.tph() / (u.tph() + u.water)


@pytest.mark.parametrize("water, cut", [(None, None), (1.0, 8.0), (1.0, 20.0), (4.0, 45.0)])
def test_deslime_underflow_leaves_at_its_declared_density(water, cut):
    """P-04: the desliming cyclone holds its declared underflow density, so its water split follows the solids it sends
    down; 0.08.001 sent a fixed 12% of the water and reached 87.8% w/w (72% v/v) at 1 m3/t and an 8 um cut."""
    case = CASE_BY_ID["phosphate_clay"]
    changes = {} if water is None else {"water_m3_t": water, "deslime_cut_um": cut}
    result = simulate(case.ore, case.plant, case.nominal.with_values(**changes))
    assert _underflow_solids(result) == pytest.approx(case.plant.deslime.underflow_solids, rel=1e-12)
    # the bypass is the water split of the desliming feed (the grinding cyclone's overflow)
    assert result.deslime.bypass == pytest.approx(result.streams["deslime_underflow"].water / result.streams["cyclone_overflow"].water, rel=1e-12)
    assert "deslime_water_short" not in [f["code"] for f in result.flags]


def test_deslime_classifies_declared_grains_with_the_grg_exponent():
    """L-1: the desliming cyclone applies the fitted GRG exponent to declared grains, as the grinding cyclone does."""
    from pipeline.engine.constants import constant
    from pipeline.engine.cyclone import corrected_cut, reduced_partition
    from pipeline.engine.model import DeslimePlant
    from pipeline.engine.separation import run_deslime

    result = run_variant("gold_free_milling", "nominal")
    plant = DeslimePlant(sharpness=2.5, underflow_solids=0.7)
    d = run_deslime(result.grinding.overflow_species, result.streams["cyclone_overflow"].water, result.ore, plant, 20.0)
    n = float(constant("cyclone.grg_density_exponent"))
    want = d.bypass + (1.0 - d.bypass) * reduced_partition(corrected_cut(20.0, 2.65, 15.7, n), 2.5)
    assert np.allclose(d.partition["electrum:liberated"], want, rtol=1e-12)


def test_cut_mode_refuses_a_desliming_cut_above_half_the_achieved_product():
    """K-02: the contract checks the desliming cut against the grind target, which the cut mode ignores; 0.08.001 served
    this state with 59% of the ore and 58.7% of the P2O5 sent to slimes."""
    from pipeline.engine.model import InfeasibleState

    case = CASE_BY_ID["phosphate_clay"]
    point = case.nominal.with_values(throughput_tph=235.0, d50c_um=150.7, deslime_cut_um=45.0)
    with pytest.raises(InfeasibleState) as refusal:
        simulate(case.ore, case.plant, point)
    assert refusal.value.code == "deslime_cut_above_half_p80"
