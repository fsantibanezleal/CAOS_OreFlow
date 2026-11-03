import importlib
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data-pipeline"))
pipeline = importlib.import_module("pipeline.pipeline")


def test_release_preflight_stages_committed_inputs_without_overwriting(tmp_path, monkeypatch):
    source_root = tmp_path / "repo" / "data" / "derived" / "source"
    model_root = tmp_path / "repo" / "models"
    source_root.mkdir(parents=True)
    model_root.mkdir()
    for name in ("hzdr_particle_benchmark.json", "hzdr_summary.json", "iron_plant_soft_sensor.json"):
        (source_root / name).write_text(f"committed:{name}", encoding="utf-8")
    (model_root / "particle_mlp.onnx").write_bytes(b"committed-model")
    monkeypatch.setattr(pipeline, "REPO_ROOT", tmp_path / "repo")
    monkeypatch.setattr(pipeline, "MODELS", model_root)

    derived = tmp_path / "run" / "derived"
    models = tmp_path / "run" / "models"
    pipeline._stage_release_inputs(derived, models)
    (derived / "source" / "hzdr_summary.json").write_text("run-specific", encoding="utf-8")
    (models / "particle_mlp.onnx").write_bytes(b"run-specific-model")
    pipeline._stage_release_inputs(derived, models)

    for name in ("hzdr_particle_benchmark.json", "iron_plant_soft_sensor.json"):
        assert (derived / "source" / name).read_text(encoding="utf-8") == f"committed:{name}"
    assert (derived / "source" / "hzdr_summary.json").read_text(encoding="utf-8") == "run-specific"
    assert (models / "particle_mlp.onnx").read_bytes() == b"run-specific-model"
