"""PE-18 gravity in the grinding loop; PE-19 magnetite grade and grind; PE-20 desliming trade-off."""
from __future__ import annotations


from engine_helpers import run_point, run_variant
from pipeline.cases.catalog import CASE_BY_ID


def test_bleed_response_and_gold_circulating_load():
    case = CASE_BY_ID["gold_free_milling"]
    recoveries = []
    for bleed in (0.1, 0.2, 0.3, 0.4, 0.5, 0.6):
        m = run_point(case.id, case.nominal.with_values(gravity_bleed=bleed)).metrics
        assert m["gold_circulating_load_pct"] > m["circulating_load_pct"]
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
