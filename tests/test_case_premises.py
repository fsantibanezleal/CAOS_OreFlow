"""Each case's stated premise is what the engine computes (E-03 and E-04, review of 2026-10-02). Until 0.08.000 the
phosphate case said the desliming cut "trades lost P2O5 against a cleaner flotation feed" and the clay case that froth
washing and air "carry more weight than in a clean ore"; the engine showed neither. The texts now state the engine's
answer, and these tests hold it."""
from __future__ import annotations

from dataclasses import replace

from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate


def _run(case_id: str, ore=None, plant=None, **values: float):
    c = CASE_BY_ID[case_id]
    return simulate(ore or c.ore, plant or c.plant, c.nominal.with_values(**values))


def test_a_coarser_deslime_cut_costs_recovery_and_grade_together() -> None:
    """The case and docs 08: a coarser cut lowers recovery and concentrate grade together; only the flotation-stage
    recovery rises, and it is a ratio."""
    runs = [_run("phosphate_clay", deslime_cut_um=float(cut)).metrics for cut in (8, 12, 20, 30, 45)]
    for finer, coarser in zip(runs, runs[1:]):
        assert coarser["recovery_pct"] < finer["recovery_pct"]
        assert coarser["concentrate_grade"] < finer["concentrate_grade"]
        assert coarser["slimes_loss_pct"] > finer["slimes_loss_pct"]
    assert runs[-1]["flotation_recovery_pct"] > runs[0]["flotation_recovery_pct"]


def test_the_clay_costs_about_two_tenths_of_a_point() -> None:
    """The clay case: about 75 ppm of the flotation-feed clay reaches the final concentrate and the clay costs about
    0.2 points of Cu grade; washing and air move grade by the same amounts with or without it."""
    c = CASE_BY_ID["mixed_ore_high_clay"]
    clean = replace(c.ore, minerals=tuple(m for m in c.ore.minerals if m.id != "kaolinite"))
    clay_run, clean_run = _run(c.id), _run(c.id, ore=clean)
    cost = clean_run.metrics["concentrate_grade"] - clay_run.metrics["concentrate_grade"]
    assert 0.1 < cost < 0.35, cost
    feed = clay_run.streams["flotation_feed"].mineral_tph("kaolinite")
    final = clay_run.streams["final_concentrate"].mineral_tph("kaolinite")
    assert 2e-5 < final / feed < 2e-4, final / feed

    def wash(factor: float):
        fp = c.plant.flotation
        return replace(c.plant, flotation=replace(fp, cleaner=replace(fp.cleaner, wash_factor=factor)))

    def levers(ore) -> tuple[float, float]:
        grade = lambda r: r.metrics["concentrate_grade"]  # noqa: E731
        washed = grade(_run(c.id, ore=ore, plant=wash(1.0))) - grade(_run(c.id, ore=ore, plant=wash(0.15)))
        aired = grade(_run(c.id, ore=ore, jg_cm_s=1.4 * c.nominal.jg_cm_s)) - grade(_run(c.id, ore=ore))
        return washed, aired

    (wash_clay, air_clay), (wash_clean, air_clean) = levers(c.ore), levers(clean)
    assert abs(wash_clay - wash_clean) < 0.05 and abs(air_clay - air_clean) < 0.05, (wash_clay, wash_clean, air_clay, air_clean)
