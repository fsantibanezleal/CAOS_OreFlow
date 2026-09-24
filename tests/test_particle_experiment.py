"""The particle lane is separate from the authored-circuit surrogate lane."""
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "data" / "derived" / "source" / "hzdr_particle_benchmark.json"
MODEL = ROOT / "models" / "particle_mlp.onnx"


def test_particle_benchmark_population_and_scope():
    data = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    assert data["schema"] == "oreflow.particle-benchmark/v1"
    assert data["source"]["doi"] == "10.14278/rodare.336"
    assert data["protocol"]["train_rows"] == 68008
    assert data["protocol"]["fit_rows"] + data["protocol"]["validation_rows"] == 68008
    assert data["protocol"]["test_rows"] == 29147
    assert data["protocol"]["features"] == ["Aspect Ratio", "Solidity", "ECD", "Mineral 1 surface"]
    assert {case["case"] for case in data["cases"]} == {"1", "2", "3", "4"}
    for case in data["cases"]:
        assert case["test_rows"] + case["excluded_test_rows"] == 29147
        for model in case["models"].values():
            thresholds = model["thresholds"]
            assert len(thresholds) == 101
            assert thresholds[0]["selected_fraction"] == 1
            assert all(a["selected_fraction"] >= b["selected_fraction"] for a, b in zip(thresholds, thresholds[1:]))
            assert sum(row["count"] for row in model["calibration"]) == case["test_rows"]


def test_exported_onnx_matches_local_pytorch_checkpoint():
    checkpoint = ROOT / "models" / "particle_mlp.pt"
    if not checkpoint.is_file():
        # CI validates the committed ONNX binary without requiring a local GPU checkpoint.
        assert MODEL.stat().st_size > 1000
        return
    weights = torch.load(checkpoint, map_location="cpu", weights_only=False)
    network = torch.nn.Sequential(torch.nn.Linear(4, 32), torch.nn.ReLU(), torch.nn.Linear(32, 32), torch.nn.ReLU(), torch.nn.Linear(32, 4))
    network.load_state_dict(weights["state_dict"])
    network.eval()
    vectors = np.random.default_rng(42).normal(size=(32, 4)).astype(np.float32)
    with torch.no_grad():
        expected = network(torch.from_numpy(vectors)).numpy()
    actual = ort.InferenceSession(MODEL.as_posix(), providers=["CPUExecutionProvider"]).run(["logits"], {"features": vectors})[0]
    np.testing.assert_allclose(actual, expected, atol=1e-6, rtol=1e-6)
