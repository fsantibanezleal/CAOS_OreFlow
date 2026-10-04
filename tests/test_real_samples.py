"""RS-01 to RS-05: the GeoMet samples in the soft porphyry's circuit (docs/design/features/real-samples)."""
from __future__ import annotations

import hashlib
import statistics
from functools import lru_cache
from pathlib import Path

import pytest

from pipeline.cases import real_samples as rs
from pipeline.engine.chemistry import mineral_composition
from pipeline.engine.constants import atomic_weights, constant, mineral_table


@lru_cache(maxsize=1)
def _tables():
    comminution, excluded_c = rs.comminution_samples()
    samples, excluded_f = rs.locked_cycle_samples(comminution)
    return comminution, samples, excluded_c + excluded_f


@lru_cache(maxsize=1)
def _record():
    from pipeline.stages import real_samples

    # the sensitivity study (about 3,000 engine runs) is checked on the committed record, not rerun here
    return real_samples.build(Path(__file__).resolve().parents[1] / "data" / "derived", "test", "test", with_sensitivity=False)


def test_sources_pinned_and_ledger(tmp_path):
    # RS-01: each table is read only if both its checksums match, and every excluded row carries its reason
    for name, pin in rs.SOURCES.items():
        data = rs.source_bytes(name)
        assert hashlib.md5(data).hexdigest() == pin["md5"] and hashlib.sha256(data).hexdigest() == pin["sha256"]
        tampered = tmp_path / pin["file"]
        tampered.write_bytes(data + b"\n")
        with pytest.raises(ValueError, match="pinned checksums"):
            rs.source_bytes(name, raw=tmp_path)
    comminution, samples, excluded = _tables()
    assert len(comminution) == 60 and len(samples) == 52
    assert excluded == [{"table": "flotation", "source_row": 29, "reason": "missing locked-cycle recovery"}]


def test_bond_work_index():
    # RS-02: Bond's metric form over the 60 comminution samples gives 15.2 to 26.1 kWh/t, median 20.2
    comminution, _, _ = _tables()
    values = [c["work_index_kwh_t"] for c in comminution]
    assert round(min(values), 1) == 15.2 and round(max(values), 1) == 26.1 and round(statistics.median(values), 1) == 20.2
    # one sample by hand: 1.1023 * 44.5 / (A^0.23 M^0.82 (10/sqrt(P80) - 10/sqrt(F80)))
    c = comminution[0]
    by_hand = 1.1023113109 * 44.5 / (c["screen_um"] ** 0.23 * c["grindability_g_rev"] ** 0.82
                                     * (10.0 / c["p80_um"] ** 0.5 - 10.0 / c["f80_um"] ** 0.5))
    assert c["work_index_kwh_t"] == pytest.approx(by_hand, rel=1e-12)


def test_normative_mineralogy():
    # RS-03: the sulphur-limited allocation closes the copper and the sulphur of every sample, in its band
    w = atomic_weights()
    _, samples, _ = _tables()
    for s in samples:
        a = s["allocation"]
        cu = sum(a["fractions"][m] * mineral_composition(m).get("Cu", 0.0) for m in rs.COPPER_MINERALS)
        sulphur = sum(a["fractions"][m] * mineral_composition(m).get("S", 0.0) for m in (*rs.COPPER_MINERALS, "pyrite"))
        assert cu == pytest.approx(s["assays_pct"]["Cu"] / 100.0, rel=1e-9)
        assert sulphur == pytest.approx(s["assays_pct"]["S"] / 100.0, rel=1e-9)
        assert all(v >= -1e-15 for v in a["fractions"].values())
        assert sum(a["copper_shares"].values()) == pytest.approx(1.0, abs=1e-12)
        ratio = a["s_to_cu_molar"]
        expected = "chalcopyrite_pyrite" if ratio >= 2.0 else "chalcopyrite_bornite" if ratio >= 0.8 else "bornite_chalcocite"
        assert a["band"] == expected
    bands = [s["allocation"]["band"] for s in samples]
    assert (bands.count("chalcopyrite_pyrite"), bands.count("chalcopyrite_bornite"), bands.count("bornite_chalcocite")) == (1, 15, 36)
    # the median sample's copper: bornite 56%, chalcocite 38% (dossier of 2026-09-28: 55% and 38% over 53 samples)
    assert statistics.median(s["allocation"]["copper_shares"]["bornite"] for s in samples) == pytest.approx(0.561, abs=0.001)
    # below chalcocite's own S/Cu there is no allocation
    assert rs.allocate(10_000.0, 0.4 * 10_000.0 * w["S"] / w["Cu"], 50_000.0) is None


def test_copper_minerals_sourced():
    # RS-03b: bornite and chalcocite are declared with their Handbook densities, and their floatability ratios with
    # the derivation of each
    table = mineral_table()
    assert (table["bornite"]["formula"], table["bornite"]["density"]) == ("Cu5FeS4", 5.07)
    assert (table["chalcocite"]["formula"], table["chalcocite"]["density"]) == ("Cu2S", 5.8)
    assert "Handbook of Mineralogy" in table["bornite"]["source"] and "Handbook of Mineralogy" in table["chalcocite"]["source"]
    assert constant("minerals.bornite_floatability_ratio") == 0.8
    assert constant("minerals.chalcocite_to_bornite_floatability_ratio") == 1.5
    _, samples, _ = _tables()
    ore = rs.sample_ore(samples[0]["allocation"], samples[0]["assays_pct"]["Cu"], samples[0]["work_index"]["value"])
    rates = {m.id: m.flotation.floatability for m in ore.minerals if m.flotation}
    cp = next(m for m in rs.CASE_BY_ID[rs.CASE_ID].ore.minerals if m.id == "chalcopyrite").flotation.floatability
    for mineral, factor in (("bornite", 0.8), ("chalcocite", 1.2)):
        if mineral in rates:
            assert rates[mineral] == pytest.approx(cp * factor, rel=1e-12)


def test_work_index_assignment():
    # RS-04: the nearest comminution sample of the same hole, or the deposit median, and the record says which
    comminution, samples, _ = _tables()
    median = statistics.median(c["work_index_kwh_t"] for c in comminution)
    for s in samples:
        wi = s["work_index"]
        in_hole = [c for c in comminution if c["hole"] == s["hole"]]
        if in_hole:
            assert wi["how"] == "nearest_in_hole"
            nearest = min(in_hole, key=lambda c: sum((a - b) ** 2 for a, b in zip(c["xyz"], s["xyz"])))
            assert wi["from_source_row"] == nearest["source_row"] and wi["value"] == nearest["work_index_kwh_t"]
        else:
            assert (wi["how"], wi["value"], wi["from_source_row"]) == ("deposit_median", median, None)
    assert sum(s["work_index"]["how"] == "nearest_in_hole" for s in samples) == 42


def test_record_fields():
    # RS-05: every sample's engine run, with its ore and point, the measurement and the lane's predictions
    record = _record()
    assert record["schema"] == "oreflow.real_samples/v1" and record["summary"]["samples"] == 52
    for s in record["samples"]:
        assert s["balance_error"] < 1e-9
        assert s["point"]["head_grade"] == s["assays_pct"]["Cu"] and s["point"]["work_index_kwh_t"] == s["work_index"]["value"]
        assert 0.0 < s["metrics"]["recovery_pct"] < 100.0 and 0.0 <= s["measured_recovery_pct"] <= 100.0
        assert s["geomet_lane"] is not None and set(s["geomet_lane"]["predictions_pct"]) >= {"ridge", "random_forest"}
    assert set(record["labels"]) == {"bond_columns", "allocation", "magnetite", "authored", "comparison"}


def test_the_comparison_states_its_dependences():
    """S-01 to S-09 (review of 2026-10-02, verified forms), on the committed record: the 720 t/h gap is the host
    circuit's size and an unknown laboratory grind, so the record carries the gap against the assumed grind (zero near
    165 um), the residence share of the target-grind result, the hosts, and every authored choice with its effect."""
    import json

    record = json.loads((Path(__file__).resolve().parents[1] / "data" / "derived" / "real_samples.json").read_text(encoding="utf-8"))
    s = record["sensitivity"]
    curve = {round(r["p80_um"]): r for r in s["gap_by_assumed_p80"]}
    gaps = [r["mean_gap_pp"] for r in s["gap_by_assumed_p80"]]
    assert all(b < a for a, b in zip(gaps, gaps[1:]))                       # a coarser assumed grind, a lower gap
    assert curve[160]["mean_gap_pp"] > 0.0 > curve[165]["mean_gap_pp"]      # the zero crossing
    # with the declared ratios the engine does not rank the samples at any grind, and no state beats a constant
    assert all(abs(r["pearson"]) < 0.05 for r in s["gap_by_assumed_p80"])
    assert min(r["rmse_pp"] for r in s["gap_by_assumed_p80"]) > s["measured_population_sd_pp"]
    t = s["target_grind_throughput"]
    assert t["residence_share_pp"] == t["mean_gap_pp"] - curve[150]["mean_gap_pp"] and 2.5 < t["residence_share_pp"] < 4.0
    h = s["hosts"]
    assert h["soft_720_record"]["mean_gap_pp"] < -15.0 and abs(h["hard_nominal"]["mean_gap_pp"]) < 5.0
    # a slower chalcocite is what gives the engine a ranking, so every correlation sentence names the declared ratios
    grid = {(g["bornite"], g["chalcocite_to_bornite"]): g for g in s["ratio_grid"]}
    assert grid[(0.8, 0.67)]["sized_150"]["pearson"] > 0.2 and abs(grid[(0.8, 1.5)]["sized_150"]["pearson"]) < 0.05
    w = s["work_index"]
    assert w["recovery_per_kwh_t_median"] < 0.0 and w["pearson_recovery_work_index_720"] < -0.8
    # the realistic alternative assignments move the mean far less than a uniform bias of the same size
    base = h["soft_720_record"]["mean_gap_pp"]
    assert max(abs(w["deposit_median_for_all"]["mean_gap_pp"] - base), abs(w["global_nearest"]["mean_gap_pp"] - base)) < 2.0
    assert min(abs(w["all_minus_shift"]["mean_gap_pp"] - base), abs(w["all_plus_shift"]["mean_gap_pp"] - base)) > 5.0


def test_the_sample_ore_is_what_the_design_says():
    """S-21 (review of 2026-10-02): a sample's ore keeps none of the case's own gangue but quartz; pyrite enters only
    when the allocation gives it (the chalcopyrite-and-pyrite band), magnetite only when the allocation gives it, and
    quartz closes the mass. The design document states this, not the case's gangue in its authored proportions."""
    deficient = rs.allocate(5000.0, 1500.0, 30000.0)
    rich = rs.allocate(5000.0, 9000.0, 30000.0)
    assert deficient["band"] != "chalcopyrite_pyrite" and rich["band"] == "chalcopyrite_pyrite"
    ids = lambda ore: [m.id for m in ore.minerals]  # noqa: E731
    lean = rs.sample_ore(deficient, 0.5, 18.0)
    assert "pyrite" not in ids(lean) and ids(lean)[-1] == "quartz" and "magnetite" in ids(lean)
    full = rs.sample_ore(rich, 0.5, 18.0)
    assert "pyrite" in ids(full) and ids(full)[-1] == "quartz"
    design = (Path(__file__).resolve().parents[1] / "docs" / "design" / "features" / "real-samples" / "design.md").read_text(encoding="utf-8")
    assert "in its authored proportions" not in design and "pyrite enters only when the allocation gives it" in design
    assert "the Methods view shows the soft-sensor record" not in design
