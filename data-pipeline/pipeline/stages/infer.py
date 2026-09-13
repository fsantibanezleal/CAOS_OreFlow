"""Stage 4: infer a complete circuit response."""
from __future__ import annotations

from ..model.process import simulate
from .train import predict_bundle


def run(params, bundle=None):
    learned = predict_bundle(bundle, params) if bundle else None
    return simulate(params, learned=learned)
