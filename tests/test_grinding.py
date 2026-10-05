"""PE-05 target and circulating load; PE-06 steady-state delivery; PE-07 power-limited mode;
PE-07b grindability shares breakage without changing the ore's hardness."""
from __future__ import annotations

from dataclasses import replace

import numpy as np
import pytest

from engine_helpers import run_point, run_variant
from pipeline.cases.catalog import CASE_BY_ID, CASES
from pipeline.engine.circuit import simulate
from pipeline.engine.model import InfeasibleState


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_target_and_circulating_load_met(case_id):
    result = run_variant(case_id, "nominal")
    g = result.grinding
    assert not g.power_limited
    assert abs(g.p80_um / g.target_p80_um - 1.0) < 0.005
    assert abs(g.circulating_load / CASE_BY_ID[case_id].nominal.circulating_load - 1.0) < 0.005


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_overflow_equals_new_feed_by_mineral(case_id):
    result = run_variant(case_id, "nominal")
    s = result.streams
    for mineral in result.ore.ids:
        delivered = s["cyclone_overflow"].mineral_tph(mineral)
        if "gravity_concentrate" in s:
            delivered += s["gravity_concentrate"].mineral_tph(mineral)
        assert np.isclose(delivered, s["new_feed"].mineral_tph(mineral), rtol=1e-9, atol=1e-12)


def test_power_limited_mode():
    case = CASE_BY_ID["copper_porphyry_soft"]
    required = run_variant(case.id, "nominal").metrics["required_mill_power_kw"]
    plant = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=0.7 * required))
    result = simulate(case.ore, plant, case.nominal)
    m = result.metrics
    assert m["power_limited"] == 1.0
    assert m["mill_power_kw"] == pytest.approx(0.7 * required, rel=1e-9)
    assert m["p80_um"] > case.nominal.target_p80_um * 1.05
    assert any(flag["code"] == "power_limited" for flag in result.flags)


def test_host_limited_composites():
    # 39.75% Fe is 55% magnetite against 45% host: at a coarse grind the declared 50% composites would
    # lock more host than the coarse classes carry, so the composites are limited by the host available
    # and the balance of the magnetite reports as liberated grains (the rule of species.to_species).
    case = CASE_BY_ID["iron_magnetite_fine"]
    point = case.nominal.with_values(head_grade=1.5 * case.nominal.head_grade, target_p80_um=120.0)
    result = run_point(case.id, point, unlimited_power=True)
    scale = result.grinding.composite_scale
    assert float(np.min(scale)) < 0.999 and float(np.max(scale)) == 1.0
    # A fully locked class leaves a host overflow near zero; allow round-off only (1e-12 of the stream).
    assert all(float(np.min(v)) >= -1e-12 * s.tph() for s in result.streams.values() for v in s.solids.values())
    assert result.metrics["species_consistency_error"] < 1e-12
    assert result.balance["max_relative_error"] < 1e-9
    nominal = run_variant(case.id, "nominal").grinding.composite_scale
    assert float(np.min(nominal)) == 1.0


def test_grindability_shares_breakage_not_hardness():
    # PE-07b: the work index is the ore's hardness; grindabilities only share the breakage among the
    # minerals. Scaling every grindability of an ore by one factor leaves the circuit unchanged, where
    # a grindability that multiplied the selection directly would change the energy by that factor.
    case = CASE_BY_ID["phosphate_clay"]
    base = simulate(case.ore, case.plant, case.nominal)
    scaled_ore = replace(case.ore, minerals=tuple(replace(m, grindability=2.5 * m.grindability) for m in case.ore.minerals))
    scaled = simulate(scaled_ore, case.plant, case.nominal)
    for key in ("specific_energy_grinding_kwh_t", "mill_power_kw", "p80_um", "recovery_pct", "concentrate_grade"):
        assert scaled.metrics[key] == pytest.approx(base.metrics[key], rel=1e-9)


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_bond_efficiency_consistent_across_cases(case_id):
    # PE-07b: with the ore's hardness set by its work index alone, every case grinds with the same
    # efficiency against Bond's law (0.84 to 0.92 on 0.06.000); a ratio far above 1 would mean the
    # circuit breaks the ore faster than its own work index allows.
    ratio = run_variant(case_id, "nominal").metrics["bond_efficiency_ratio"]
    assert 0.80 <= ratio <= 0.95


# CM-02 to CM-04: the cut mode. The host's corrected cut is given, the mill draws its installed power, and the P80
# and the circulating load follow; the underflow water follows the achieved load.

def _circuit(case_id: str, point):
    from pipeline.engine.circuit import crush, resolve
    from pipeline.engine.constants import constant
    from pipeline.engine.grid import grid
    from pipeline.engine.grinding import GrindingCircuit
    from pipeline.engine.model import Flags
    from pipeline.engine.streams import Stream

    case = CASE_BY_ID[case_id]
    r = resolve(case.ore, point)
    shape = grid().rosin_rammler(case.plant.crusher.feed_f80_um, case.plant.crusher.feed_slope)
    feed = Stream({m: point.throughput_tph * r.fraction[m] * shape for m in r.ids}, 0.0)
    css = point.crusher_css_mm * float(constant("units.um_per_mm"))
    return GrindingCircuit(r, case.plant, point, {m: crush(feed.solids[m], css, case.plant.crusher) for m in r.ids}, Flags())


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_cut_mode_meets_installed_power(case_id):
    result = run_variant(case_id, "cut_nominal")
    g, case = result.grinding, CASE_BY_ID[case_id]
    assert g.cut_mode and result.metrics["cut_mode"] == 1.0
    case_variant = next(v for v in case.variants if v["id"] == "cut_nominal")
    from pipeline.cases.catalog import variant_point
    assert g.cut_um == variant_point(case, case_variant).d50c_um
    assert g.power_kw == pytest.approx(case.plant.mill.installed_power_kw, rel=1e-9)
    assert g.required_power_kw == pytest.approx(g.power_kw, rel=1e-12) and not g.power_limited
    # the load used for the water is the achieved one
    su = case.plant.cyclone.underflow_solids
    assert g.water["underflow_tph"] == pytest.approx(g.circulating_load * g.streams["new_feed"].tph() * (1.0 - su) / su, rel=1e-9)


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_cut_mode_reports_and_flags(case_id):
    nominal, finer = run_variant(case_id, "cut_nominal"), run_variant(case_id, "cut_finer")
    # a finer cut returns more to the mill: the load rises and, at the same power, the product is finer
    assert finer.grinding.circulating_load > nominal.grinding.circulating_load
    assert finer.grinding.p80_um < nominal.grinding.p80_um
    for result in (nominal, finer):
        # nothing targets the P80 in the cut mode: the achieved one stands in its place
        assert result.metrics["target_p80_um"] == result.metrics["p80_um"]
        load = result.grinding.circulating_load
        flagged = any(f["code"] == "circulating_load_out_of_range" for f in result.flags)
        assert flagged == (not 1.0 <= load <= 4.0)
    # the nominal state stays in the target mode
    assert run_variant(case_id, "nominal").metrics["cut_mode"] == 0.0


def test_cut_mode_flags_a_load_outside_the_target_envelope():
    # measured: the hard porphyry at 0.8 of its nominal cut returns about 412% to the mill
    result = run_variant("copper_porphyry_hard", "cut_finer")
    assert result.grinding.circulating_load > 4.0
    assert any(f["code"] == "circulating_load_out_of_range" for f in result.flags)


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_modes_agree_at_the_same_state(case_id):
    # CM-04: a target-mode state re-run in the cut mode at its own solved cut and at the power it draws gives back
    # its P80 and circulating load (the requirement allows 0.5%; the solvers agree to about 1e-13)
    case = CASE_BY_ID[case_id]
    target = _circuit(case_id, case.nominal).solve()
    circuit = _circuit(case_id, case.nominal)
    _, result = circuit.solve_at_cut(target.cut_um, target.power_kw)
    total = sum(result.overflow.values())
    assert circuit.g.p80(total) == pytest.approx(target.p80_um, rel=1e-9)
    assert result.circulating_load == pytest.approx(target.circulating_load, rel=1e-9)


# E-01 (review of 2026-10-02): the reproductions of a cut-mode state with no steady state at installed power. Until
# 0.08.000 the engine returned them as solved, at the energy bracket's end, with loads of millions of percent and mill
# power above installed, and the service answered HTTP 200
REFUSED = [
    ("copper_porphyry_soft", {"throughput_tph": 1080.0, "d50c_um": 147.127261101}),
    ("copper_porphyry_soft", {"work_index_kwh_t": 16.5, "d50c_um": 147.127261101}),
    ("iron_magnetite_fine", {"water_m3_t": 1.0, "d50c_um": 65.3}),
]


@pytest.mark.parametrize("case_id,change", REFUSED)
def test_cut_mode_refuses_a_state_without_a_steady_state(case_id, change):
    case = CASE_BY_ID[case_id]
    with pytest.raises(InfeasibleState) as refusal:
        simulate(case.ore, case.plant, case.nominal.with_values(**change))
    assert refusal.value.code in ("power_unreachable_at_cut", "circulating_load_above_bound")
    assert refusal.value.error()["input"] == "d50c_um"


def _corner_cases() -> list[str]:
    # every case at release (OF_CORNERS=full); three families by default, so the suite stays fast
    import os
    return [c.id for c in CASES] if os.environ.get("OF_CORNERS") == "full" else ["copper_porphyry_soft", "iron_magnetite_fine", "copper_porphyry_hard"]


@pytest.mark.parametrize("case_id", _corner_cases())
def test_cut_mode_never_serves_an_impossible_state(case_id):
    """Every corner of the cut-mode envelope over the six inputs that decide feasibility is refused, or served with the
    mill at or under its installed power and a circulating load at or under the declared bound."""
    import itertools

    from pipeline.engine.constants import constant
    from pipeline.io.contract import build_contract, validate

    document = build_contract()
    bounds = document["cases"][case_id]["inputs"]
    names = [n for n in ("throughput_tph", "work_index_kwh_t", "d50c_um", "water_m3_t", "crusher_css_mm", "head_grade") if n in bounds]
    case = CASE_BY_ID[case_id]
    cap = float(constant("grinding.cut_mode_load_max"))
    refused = served = 0
    for corner in itertools.product(*[(bounds[n]["min"], bounds[n]["max"]) for n in names]):
        state = dict(zip(names, corner))
        verdict = validate(document, case_id, state)
        if not verdict["accepted"]:
            continue
        point = case.nominal.with_values(**verdict["point"])
        try:
            result = simulate(case.ore, case.plant, point)
        except InfeasibleState:
            refused += 1
            continue
        served += 1
        g = result.grinding
        assert g.power_kw <= case.plant.mill.installed_power_kw * (1.0 + 1e-9), (state, g.power_kw)
        assert g.circulating_load <= cap * (1.0 + 1e-12), (state, g.circulating_load)
    assert served > 0


@pytest.mark.parametrize("bleed", [None, 0.1, 0.6])
def test_power_is_energy_times_mill_feed(bleed):
    """C-03, P-05, K-07: the energy per pass acts on the mill feed; with the gravity unit on the underflow the mill is fed
    the new feed plus the underflow less the gravity concentrate (0.08.001 counted the concentrate: 4.3e-4 at 0.6)."""
    case = CASE_BY_ID["gold_free_milling"]
    point = case.nominal if bleed is None else case.nominal.with_values(gravity_bleed=bleed)
    g = run_point(case.id, point).grinding
    mill_feed = g.streams["mill_feed"].tph()
    assert g.power_kw == pytest.approx(g.energy_per_pass_kwh_t * mill_feed, rel=1e-12)
    assert g.specific_energy_kwh_t == pytest.approx(g.energy_per_pass_kwh_t * mill_feed / g.streams["new_feed"].tph(), rel=1e-12)


def test_power_limit_holds_installed_power_on_the_mill_feed():
    """C-03: at installed power the drawn power is the installed one on the true mill feed, gravity included."""
    case = CASE_BY_ID["gold_free_milling"]
    point = case.nominal.with_values(gravity_bleed=0.6)
    required = run_point(case.id, point).metrics["required_mill_power_kw"]
    plant = replace(case.plant, mill=replace(case.plant.mill, installed_power_kw=0.8 * required))
    g = simulate(case.ore, plant, point).grinding
    assert g.power_limited
    assert g.power_kw == pytest.approx(0.8 * required, rel=1e-10)


def test_cut_mode_draws_installed_power_on_the_mill_feed():
    """C-03: the cut mode's root holds e times the mill feed at the installed power."""
    case = CASE_BY_ID["gold_free_milling"]
    variant = next(v for v in case.variants if v["id"] == "cut_nominal")
    point = run_variant(case.id, "cut_nominal")
    g = point.grinding
    assert g.cut_mode
    assert g.energy_per_pass_kwh_t * g.streams["mill_feed"].tph() == pytest.approx(case.plant.mill.installed_power_kw, rel=1e-9)
    assert variant["id"] == "cut_nominal"


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_reported_partition_is_the_applied_one(case_id):
    """P-02: the partition curve of every mineral is the share of each class of the cyclone feed that reports to the
    underflow, liberated grains and composites together (0.08.001 drew the liberated grains' curve, 0.080 apart)."""
    result = run_variant(case_id, "nominal")
    g = result.grinding
    feed = g.streams["sump_feed" if "sump_feed" in g.streams else "cyclone_feed"]
    under = g.streams["cyclone_underflow"]
    for key, curve in g.partition.items():
        mineral = result.ore.host if key == "host" else key
        for share, u, f in zip(curve, under.solids[mineral], feed.solids[mineral]):
            if share is not None:
                assert share == pytest.approx(u / f, rel=1e-12)
        assert sum(v is not None for v in curve) > 0


def test_solver_flags_come_from_the_reported_pass_only(monkeypatch):
    """K-11: a fixed point that does not settle at a trial point of a root search is no flag of the reported state; a
    pass records it and the report flags it only for the pass it reports."""
    import pipeline.engine.grinding as grinding
    from pipeline.engine.model import Flags
    from pipeline.engine.ore import resolve
    from pipeline.engine.grid import grid

    # a valuable-rich magnetite feed at a coarse cut, where the host limits the composites (test_host_limited_composites)
    case = CASE_BY_ID["iron_magnetite_fine"]
    point = case.nominal.with_values(head_grade=1.5 * case.nominal.head_grade)
    real = grinding.constant
    monkeypatch.setattr(grinding, "constant", lambda key: 1 if key == "numerics.composite_scale_max_iterations" else real(key))
    flags = Flags()
    r = resolve(case.ore, point)
    shape = grid().rosin_rammler(case.plant.crusher.feed_f80_um, case.plant.crusher.feed_slope)
    feed = {m: point.throughput_tph * r.fraction[m] * shape for m in r.ids}
    circuit = grinding.GrindingCircuit(r, case.plant, point, feed, flags)
    result = circuit.run(2.0, 400.0)
    assert not result.composite_converged
    assert flags.items == []


K13_STATE = {"throughput_tph": 460.0, "water_m3_t": 4.0, "crusher_css_mm": 4.0, "work_index_kwh_t": 9.45,
             "head_grade": 44.55, "d50c_um": 130.651135861}


def test_a_trial_point_flag_does_not_reach_the_reported_state():
    """K-13: at this admitted iron cut-mode corner 0.08.001 reported composite_scale_not_converged from a trial energy of
    97.9 kWh/t the search rejected, while the reported pass (39.0 kWh/t) converged; the browser did not."""
    case = CASE_BY_ID["iron_magnetite_fine"]
    result = simulate(case.ore, case.plant, case.nominal.with_values(**K13_STATE))
    assert "composite_scale_not_converged" not in [f["code"] for f in result.flags]
