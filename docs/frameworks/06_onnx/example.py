"""ONNX Runtime in OreFlow: the committed surrogate and guard run on every case's nominal state, with the
features recomputed from the engine's case definitions, must reproduce the reference block the bake wrote
into models/process_surrogate.json, the same reference the browser is tested against. The particle network
is opened too: its inputs, outputs and a probability read from its logits.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\06_onnx\\example.py
Every printed claim is also asserted.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.cases.catalog import CASE_BY_ID  # noqa: E402
from pipeline.methods import learning  # noqa: E402

MODELS = ROOT / "models"
scalers = json.loads((MODELS / "process_surrogate.json").read_text(encoding="utf-8"))
surrogate = onnxruntime.InferenceSession(str(MODELS / "process_surrogate.onnx"), providers=["CPUExecutionProvider"])
guard = onnxruntime.InferenceSession(str(MODELS / "process_guard.onnx"), providers=["CPUExecutionProvider"])
print("surrogate:", [(i.name, i.shape) for i in surrogate.get_inputs()], "->", [(o.name, o.shape) for o in surrogate.get_outputs()])
assert scalers["features"] == list(learning.FEATURES) and scalers["targets"] == list(learning.TARGETS)

fm, fs = np.asarray(scalers["feature_mean"]), np.asarray(scalers["feature_scale"])
tm, ts = np.asarray(scalers["target_mean"]), np.asarray(scalers["target_scale"])
gm, gs = np.asarray(scalers["guard_feature_mean"]), np.asarray(scalers["guard_feature_scale"])
rows = []
for ref in scalers["reference"]:
    case = CASE_BY_ID[ref["case_id"]]
    x = np.asarray(learning.features(case, case.nominal, {name: 1.0 for name in learning._ore_factors(case)}))
    assert np.allclose(x, ref["features"], rtol=1e-12, atol=0.0)
    rows.append(x)
x = np.vstack(rows)                                     # one batch for all twelve cases: the row axis is dynamic
pred = surrogate.run(None, {"features": ((x - fm) / fs).astype(np.float32)})[0].astype(np.float64) * ts + tm
guard_in = ((x - gm) / gs).astype(np.float32)
error = np.mean((guard.run(None, {"features": guard_in})[0].astype(np.float64) - guard_in.astype(np.float64)) ** 2, axis=1)
print(f"{'case':22s} {'recovery %':>11s} {'engine %':>9s} {'guard error':>12s} flagged")
for i, ref in enumerate(scalers["reference"]):
    for j, target in enumerate(learning.TARGETS):
        assert abs(pred[i, j] - ref["prediction"][target]) <= 1e-5 * max(1.0, abs(ref["prediction"][target]))
    assert abs(error[i] - ref["guard_error"]) <= 1e-6 * max(1e-3, ref["guard_error"])
    assert (error[i] > scalers["guard_threshold"]) == ref["guard_flag"]
    artifact = json.loads((ROOT / "data" / "derived" / "cases" / f"{ref['case_id']}.json").read_text(encoding="utf-8"))
    engine = artifact["variants"][0]["trace"]["metrics"]["recovery_pct"]
    print(f"{ref['case_id']:22s} {pred[i, 0]:11.2f} {engine:9.2f} {error[i]:12.4f} {ref['guard_flag']}")
print(f"the batch reproduces the reference block; guard threshold {scalers['guard_threshold']:.4f}")

particle = onnxruntime.InferenceSession(str(MODELS / "particle_mlp.onnx"), providers=["CPUExecutionProvider"])
record = json.loads((ROOT / "data" / "derived" / "source" / "hzdr_particle_benchmark.json").read_text(encoding="utf-8"))
mean, scale = np.asarray(record["standardization"]["mean"]), np.asarray(record["standardization"]["scale"])
particle_x = ((mean - mean) / scale).astype(np.float32)[None, :]          # the training mean of the four features
logits = particle.run(["logits"], {"features": particle_x})[0][0]
probability = 1.0 / (1.0 + np.exp(-logits))
print("particle network at the training mean: class B probability per case", np.round(probability, 3))
assert logits.shape == (4,) and np.all((probability > 0.0) & (probability < 1.0))
print("every check passed")
