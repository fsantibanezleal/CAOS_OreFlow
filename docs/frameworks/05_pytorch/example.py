"""PyTorch in OreFlow: the learned lane's MLP trained with the lane's own training function on a small
engine design, stopped on validation loss, and scored under interpolation and on a held-out case.

Run from the repository root with the repository's environment:
    .venv-gpu\\Scripts\\python.exe docs\\frameworks\\05_pytorch\\example.py
It simulates 384 states (about ten seconds) and trains three small networks. Every printed claim is asserted.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pipeline.cases.catalog import CASES  # noqa: E402
from pipeline.methods import learning  # noqa: E402

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"torch {torch.__version__}, device {device}" + (f" ({torch.cuda.get_device_name(0)})" if device == "cuda" else ""))

contract = json.loads((ROOT / "data" / "derived" / "contract" / "operating_contract.json").read_text(encoding="utf-8"))
design = learning.build_design(contract, CASES, per_case=32, seed=5)
x, y, case_of = design["x"], design["y"], design["case"]
print(f"design: {len(x)} states over {len(CASES)} cases, {x.shape[1]} features, {y.shape[1]} targets")

s = learning.settings(max_epochs=2000, patience=100)


def train_and_score(train: np.ndarray, test: np.ndarray, seed: int) -> tuple[float, dict]:
    fx, fy = learning.Standardizer(x[train]), learning.Standardizer(y[train])
    model, info, _ = learning._train_network(fx(x[train]), fy(y[train]), list(s["mlp_hidden"]), s, seed, "silu")
    pred = fy.inverse(learning._predict_network(model, fx(x[test])))
    rmse = float(np.sqrt(np.mean((pred[:, 0] - y[test, 0]) ** 2)))          # recovery, in points
    return rmse, info


train, test = learning.interpolation_split(case_of, 0.2, seed=5)
inside, info = train_and_score(train, test, seed=5)
print(f"interpolation: recovery RMSE {inside:.2f} points; {info['parameters']} parameters, "
      f"{info['epochs_run']} epochs, best {info['best_epoch']}, stopped early: {info['stopped_early']}")
assert info["device"].startswith(device)
assert 1 <= info["best_epoch"] <= info["epochs_run"] <= s["max_epochs"]
assert info["epochs_run"] - info["best_epoch"] <= s["patience"]

# transfer is not uniformly worse: a case with a neighbour in the training set (the hard porphyry, next to
# the soft one) transfers about as well as the pooled interpolation, and a circuit unlike every other (the
# magnetite, with drums instead of flotation) fails; the committed record shows the same per fold
committed = {f["held_out"]: f["models"]["mlp"]["recovery_pct"]["rmse"]
             for f in json.loads((ROOT / "data" / "derived" / "learning.json").read_text(encoding="utf-8"))["leave_one_case_out"]}
held = {}
for held_out in ("copper_porphyry_hard", "iron_magnetite_fine"):
    tr, te = np.flatnonzero(case_of != held_out), np.flatnonzero(case_of == held_out)
    held[held_out], fold = train_and_score(tr, te, seed=5)
    print(f"held out {held_out:21s}: recovery RMSE {held[held_out]:7.2f} points after {fold['epochs_run']} epochs "
          f"(committed full design: {committed[held_out]:.1f})")
assert held["iron_magnetite_fine"] > inside and held["iron_magnetite_fine"] > held["copper_porphyry_hard"]
print("every check passed")
