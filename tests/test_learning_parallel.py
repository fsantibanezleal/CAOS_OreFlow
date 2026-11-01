"""The real seeded MLP worker returns the same evidence under spawn concurrency."""
import numpy as np
import pytest
import torch

from pipeline.methods.learning import FEATURES, _learning_job, _validate_job, settings
from pipeline.methods.learning_jobs import Job, run_jobs


@pytest.mark.parametrize("device", ["cpu", pytest.param("cuda", marks=pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA unavailable"))])
def test_serial_and_parallel_mlp_scores_match(device):
    rng = np.random.default_rng(39)
    x = rng.normal(size=(48, len(FEATURES)))
    y = np.column_stack((50 + x[:, 0] * 5, 1 + x[:, 1] * .1, 20 + x[:, 2]))
    jobs = [Job(f"seed:{seed}", {"kind": "seed", "x": x, "y": y, "case_of": np.array(["a"] * 48),
                                "train": np.arange(36), "test": np.arange(36, 48),
                                "settings": settings(device=device, max_epochs=20, patience=5, mlp_hidden=[8]),
                                "seed": seed, "fold": "interpolation"}) for seed in (39, 40)]
    serial, _ = run_jobs(jobs, _learning_job, workers=1, validate=_validate_job)
    parallel, _ = run_jobs(jobs, _learning_job, workers=2, validate=_validate_job)
    for a, b in zip(serial, parallel):
        for target in a["data"]:
            for metric in ("rmse", "mae", "r2"):
                assert a["data"][target][metric] == pytest.approx(b["data"][target][metric], rel=1e-6, abs=1e-7)
            assert a["data"][target]["evaluation"] == b["data"][target]["evaluation"]
