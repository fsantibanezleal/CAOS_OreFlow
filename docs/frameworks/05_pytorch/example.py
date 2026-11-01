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


def train_and_score(train: np.ndarray, test: np.ndarray, seed: int, *, held_out: str | None = None) -> tuple[dict, dict]:
    fx, fy = learning.Standardizer(x[train]), learning.Standardizer(y[train])
    model, info, _ = learning._train_network(fx(x[train]), fy(y[train]), list(s["mlp_hidden"]), s, seed, "silu")
    pred = fy.inverse(learning._predict_network(model, fx(x[test])))
    protocol = "leave_one_case_out" if held_out is not None else "interpolation"
    score = learning._scores(
        y[test, 0], pred[:, 0], cases=case_of[test], reference=y[:, 0],
        evaluation={"method": "mlp", "target": "recovery_pct", "protocol": protocol,
                    "fold": held_out or "pooled", "seed": seed},
        allow_rejection=held_out is not None,
    )
    return score, info


def score_text(score: dict) -> str:
    if score["valid_for_scoring"]:
        assert score["rmse"] is not None and np.isfinite(score["rmse"])
        return f"{score['rmse']:.2f} points (evaluated {score['rows']}/{score['rows']}, rejected 0)"
    assert score["status"] == "rejected-transfer" and score["rmse"] is None
    return (f"unavailable: {score['status']} (attempted {score['rows']}, evaluated 0, rejected {score['rows']}); "
            f"prediction range {score['observable']['prediction_range']}")


train, test = learning.interpolation_split(case_of, 0.2, seed=5)
inside, info = train_and_score(train, test, seed=5)
print(f"interpolation: recovery RMSE {score_text(inside)}; {info['parameters']} parameters, "
      f"{info['epochs_run']} epochs, best {info['best_epoch']}, stopped early: {info['stopped_early']}")
assert info["device"].startswith(device)
assert 1 <= info["best_epoch"] <= info["epochs_run"] <= s["max_epochs"]
assert info["epochs_run"] - info["best_epoch"] <= s["patience"]

# The known-family neighbour and the distinct magnetite circuit answer different transfer questions.
# A rejected committed/fresh score remains unavailable; it cannot enter a numeric ranking.
committed = {f["held_out"]: f["models"]["mlp"]["recovery_pct"]
             for f in json.loads((ROOT / "data" / "derived" / "learning.json").read_text(encoding="utf-8"))["leave_one_case_out"]}
held = {}
for held_out in ("copper_porphyry_hard", "iron_magnetite_fine"):
    tr, te = np.flatnonzero(case_of != held_out), np.flatnonzero(case_of == held_out)
    held[held_out], fold = train_and_score(tr, te, seed=5, held_out=held_out)
    print(f"held out {held_out:21s}: recovery RMSE {score_text(held[held_out])} after {fold['epochs_run']} epochs "
          f"(separate committed full-design fold: {score_text(committed[held_out])})")
evaluated = sum(score["valid_for_scoring"] for score in held.values())
print(f"Fresh held-case populations: attempted/evaluated/rejected {len(held)}/{evaluated}/{len(held)-evaluated}")
magnetite, neighbour = held["iron_magnetite_fine"], held["copper_porphyry_hard"]
if magnetite["valid_for_scoring"]:
    assert magnetite["rmse"] > inside["rmse"]
    if neighbour["valid_for_scoring"]:
        assert magnetite["rmse"] > neighbour["rmse"]
    print("The evaluated magnetite teaching fold has greater recovery error; this is not a general model ranking.")
else:
    assert magnetite["status"] == "rejected-transfer" and magnetite["rmse"] is None
    print("Magnetite transfer is rejected by the production observable rule; no finite accuracy or ranking is claimed.")
print("every check passed")
