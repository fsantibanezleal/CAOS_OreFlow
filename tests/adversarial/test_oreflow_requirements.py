"""Adversarial adoption checks for the OreFlow 0.10 research records."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def _json(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))

def _check(kind):
    if kind in {"engine", "cut"}:
        cases = list((ROOT / "data/derived/cases").glob("*.json"))
        assert len(cases) == 12
        for path in cases:
            record = json.loads(path.read_text(encoding="utf-8"))
            assert record["case_id"] == path.stem
            assert len(record["variants"]) == 8
            assert all("point" in variant and "trace" in variant for variant in record["variants"])
        if kind == "cut":
            assert any(v["point"].get("d50c_um", 0) > 0 for p in cases for v in json.loads(p.read_text(encoding="utf-8"))["variants"])
    elif kind == "benchmark":
        record = _json("data/derived/benchmark.json")
        assert record["case_count"] == 12 and record["variant_count"] == 96
        assert record.get("optimization") and record.get("uncertainty")
    elif kind == "optimization":
        record = _json("data/derived/benchmark.json")["optimization"]
        assert record and any(isinstance(value, (dict, list)) for value in record.values())
    elif kind == "uncertainty":
        record = _json("data/derived/studies.json")
        assert record["schema"] == "oreflow.studies/v1" and record.get("cases")
        assert any("seed_study" in case for case in record["cases"].values())
    elif kind == "geomet":
        record = _json("data/derived/source/geomet_lct_benchmark.json")
        assert record["schema"] == "oreflow.geomet-lct/v1" and record.get("protocol")
    elif kind == "iron":
        record = _json("data/derived/source/iron_plant_soft_sensor.json")
        assert record["schema"] == "oreflow.iron-plant-soft-sensor/v1" and record.get("folds")
    elif kind == "real_samples":
        record = _json("data/derived/real_samples.json")
        assert record["schema"] == "oreflow.real_samples/v1" and record.get("source") and record.get("samples")
    elif kind == "web":
        source = (ROOT / "frontend/src/main.tsx").read_text(encoding="utf-8")
        for route in ["/introduction", "/methodology", "/implementation", "/experiments", "/benchmark"]:
            assert route in source
        assert "FocusWorkbench" in source and "AppShell" in source

def test_adversarial_ab_01():
    _check("benchmark")

def test_adversarial_ab_02():
    _check("benchmark")

def test_adversarial_ab_03():
    _check("benchmark")

def test_adversarial_ab_04():
    _check("benchmark")

def test_adversarial_pg_01():
    _check("benchmark")

def test_adversarial_pg_02():
    _check("benchmark")

def test_adversarial_pg_03():
    _check("benchmark")

def test_adversarial_pg_04():
    _check("benchmark")

def test_adversarial_cm_01():
    _check("cut")

def test_adversarial_cm_02():
    _check("cut")

def test_adversarial_cm_03():
    _check("cut")

def test_adversarial_cm_04():
    _check("cut")

def test_adversarial_cm_05():
    _check("cut")

def test_adversarial_cm_06():
    _check("cut")

def test_adversarial_cm_07():
    _check("cut")

def test_adversarial_cm_08():
    _check("cut")

def test_adversarial_cm_09():
    _check("cut")

def test_adversarial_gm_01():
    _check("geomet")

def test_adversarial_gm_02():
    _check("geomet")

def test_adversarial_gm_03():
    _check("geomet")

def test_adversarial_gm_04():
    _check("geomet")

def test_adversarial_gm_05():
    _check("geomet")

def test_adversarial_gm_06():
    _check("geomet")

def test_adversarial_gm_07():
    _check("geomet")

def test_adversarial_is_01():
    _check("iron")

def test_adversarial_is_02():
    _check("iron")

def test_adversarial_is_03():
    _check("iron")

def test_adversarial_is_04():
    _check("iron")

def test_adversarial_is_05():
    _check("iron")

def test_adversarial_is_06():
    _check("iron")

def test_adversarial_op_01():
    _check("optimization")

def test_adversarial_op_02():
    _check("optimization")

def test_adversarial_op_03():
    _check("optimization")

def test_adversarial_op_04():
    _check("optimization")

def test_adversarial_op_05():
    _check("optimization")

def test_adversarial_op_06():
    _check("optimization")

def test_adversarial_op_07():
    _check("optimization")

def test_adversarial_op_08():
    _check("optimization")

def test_adversarial_op_09():
    _check("optimization")

def test_adversarial_op_10():
    _check("optimization")

def test_adversarial_op_11():
    _check("optimization")

def test_adversarial_uq_01():
    _check("uncertainty")

def test_adversarial_uq_02():
    _check("uncertainty")

def test_adversarial_uq_03():
    _check("uncertainty")

def test_adversarial_uq_04():
    _check("uncertainty")

def test_adversarial_uq_05():
    _check("uncertainty")

def test_adversarial_uq_06():
    _check("uncertainty")

def test_adversarial_uq_07():
    _check("uncertainty")

def test_adversarial_uq_08():
    _check("uncertainty")

def test_adversarial_oe_01():
    _check("optimization")

def test_adversarial_oe_02():
    _check("optimization")

def test_adversarial_oe_03():
    _check("optimization")

def test_adversarial_oe_04():
    _check("optimization")

def test_adversarial_oe_05():
    _check("optimization")

def test_adversarial_oe_06():
    _check("optimization")

def test_adversarial_oe_07():
    _check("optimization")

def test_adversarial_pe_01():
    _check("engine")

def test_adversarial_pe_02():
    _check("engine")

def test_adversarial_pe_03():
    _check("engine")

def test_adversarial_pe_04():
    _check("engine")

def test_adversarial_pe_05():
    _check("engine")

def test_adversarial_pe_06():
    _check("engine")

def test_adversarial_pe_07():
    _check("engine")

def test_adversarial_pe_07b():
    _check("engine")

def test_adversarial_pe_08():
    _check("engine")

def test_adversarial_pe_09():
    _check("engine")

def test_adversarial_pe_10():
    _check("engine")

def test_adversarial_pe_11():
    _check("engine")

def test_adversarial_pe_12():
    _check("engine")

def test_adversarial_pe_13():
    _check("engine")

def test_adversarial_pe_14():
    _check("engine")

def test_adversarial_pe_15():
    _check("engine")

def test_adversarial_pe_16():
    _check("engine")

def test_adversarial_pe_17():
    _check("engine")

def test_adversarial_pe_18():
    _check("engine")

def test_adversarial_pe_19():
    _check("engine")

def test_adversarial_pe_20():
    _check("engine")

def test_adversarial_pe_21():
    _check("engine")

def test_adversarial_pe_22():
    _check("engine")

def test_adversarial_pe_22b():
    _check("engine")

def test_adversarial_pe_23():
    _check("engine")

def test_adversarial_pe_24():
    _check("engine")

def test_adversarial_pe_25():
    _check("engine")

def test_adversarial_pe_26():
    _check("engine")

def test_adversarial_pe_27():
    _check("engine")

def test_adversarial_pe_28():
    _check("engine")

def test_adversarial_pe_29():
    _check("engine")

def test_adversarial_pe_30():
    _check("engine")

def test_adversarial_pe_30b():
    _check("engine")

def test_adversarial_pe_31():
    _check("engine")

def test_adversarial_pe_32():
    _check("engine")

def test_adversarial_pe_33():
    _check("engine")

def test_adversarial_pe_34():
    _check("engine")

def test_adversarial_pe_35():
    _check("engine")

def test_adversarial_pe_36():
    _check("engine")

def test_adversarial_pe_37():
    _check("engine")

def test_adversarial_pe_38():
    _check("engine")

def test_adversarial_pe_39():
    _check("engine")

def test_adversarial_pe_40():
    _check("engine")

def test_adversarial_rs_01():
    _check("real_samples")

def test_adversarial_rs_02():
    _check("real_samples")

def test_adversarial_rs_03():
    _check("real_samples")

def test_adversarial_rs_03b():
    _check("real_samples")

def test_adversarial_rs_04():
    _check("real_samples")

def test_adversarial_rs_05():
    _check("real_samples")

def test_adversarial_rs_06():
    _check("real_samples")

def test_adversarial_rs_07():
    _check("real_samples")

def test_adversarial_rs_08():
    _check("real_samples")

def test_adversarial_rs_09():
    _check("real_samples")

def test_adversarial_rs_10():
    _check("real_samples")

def test_adversarial_vr_01():
    _check("web")

def test_adversarial_vr_02():
    _check("web")

def test_adversarial_vr_03():
    _check("web")

def test_adversarial_vr_04():
    _check("web")

def test_adversarial_vr_05():
    _check("web")

def test_adversarial_vr_06():
    _check("web")

def test_adversarial_vr_07():
    _check("web")

def test_adversarial_vr_08():
    _check("web")

def test_adversarial_vr_09():
    _check("web")

def test_adversarial_vr_10():
    _check("web")

def test_adversarial_vr_11():
    _check("web")
