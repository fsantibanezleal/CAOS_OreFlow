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

    return real_samples.build(Path(__file__).resolve().parents[1] / "data" / "derived", "test", "test")


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
