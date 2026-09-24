import json

from pipeline import pipeline, registry


def test_case_artifact_and_index_are_complete(tmp_path):
    out = tmp_path / "derived"
    entries = pipeline.run_all(seed=7, output_root=out)
    first = json.loads((out / entries[0]["artifact_path"]).read_text(encoding="utf-8"))
    index = json.loads((out / "manifests" / "index.json").read_text(encoding="utf-8"))
    matrix = json.loads((out / "metrics" / "matrix.json").read_text(encoding="utf-8"))
    assert len(entries) == len(registry.list_cases()) == 12
    assert index["schema"].startswith("oreflow.index/")
    assert index["n_cases"] == 12 and index["n_variants"] == 72
    assert len(matrix["rows"]) == 1512
    assert len(first["variants"]) == 6
    assert all(len(v["method_outputs"]) == 21 for v in first["variants"])
