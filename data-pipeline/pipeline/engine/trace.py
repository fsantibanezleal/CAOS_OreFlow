"""JSON trace of one circuit evaluation.

The trace is the record the live API returns and each case artifact stores per variant; the browser
engine reproduces its metrics and curves (PE-31). Every number is finite: a non-finite value becomes
``null`` and raises the ``non_finite_output`` flag with its path, so it is visible and never silent.
"""
from __future__ import annotations

import math
from dataclasses import asdict
from typing import Any

from .circuit import CircuitResult
from .kinetics import kinetic_record
from .model import OperatingPoint
from .ore import ResolvedOre, fraction_to_grade
from .streams import Stream

SCHEMA = "oreflow.trace/v2"


def stream_record(stream: Stream, ore: ResolvedOre) -> dict[str, Any]:
    solids = stream.tph()
    return {
        "solids_tph": solids,
        "water_tph": float(stream.water),
        "solids_pct": 100.0 * stream.pct_solids(),
        "p80_um": stream.p80() if solids > 0.0 else None,
        "minerals_tph": {m: stream.mineral_tph(m) for m in ore.ids},
        "grades": {s: fraction_to_grade(stream.grade(s, ore.composition), ore.units[s]) for s in ore.species},
    }


def _finite(value: Any, path: str, bad: list[str]) -> Any:
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        if math.isfinite(value):
            return value
        bad.append(path)
        return None
    if isinstance(value, dict):
        return {k: _finite(v, f"{path}.{k}", bad) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_finite(v, f"{path}[{i}]", bad) for i, v in enumerate(value)]
    return _finite(float(value), path, bad)   # NumPy scalars


def _kinetics(result: CircuitResult, op: OperatingPoint) -> dict[str, Any]:
    if result.flotation is None:
        return {"status": "not_applicable", "reason": "the circuit has no flotation stage"}
    return kinetic_record(result.flotation, result.ore, op.rougher_cells, result.metrics["rougher_recovery_pct"])


def trace(result: CircuitResult, op: OperatingPoint, family: str) -> dict[str, Any]:
    body: dict[str, Any] = {
        "schema": SCHEMA,
        "family": family,
        "point": asdict(op),
        "metrics": result.metrics,
        "metric_units": result.metric_units,
        "concentrates": result.concentrates,
        "tails": result.tails,
        "topology": result.topology,
        "streams": {name: stream_record(stream, result.ore) for name, stream in result.streams.items()},
        "curves": result.curves,
        "balance": result.balance,
        "methods": {"kinetics": _kinetics(result, op)},
    }
    bad: list[str] = []
    body = _finite(body, "trace", bad)
    flags = [dict(f) for f in result.flags]
    if bad:
        flags.append({"code": "non_finite_output", "message": f"Non-finite values replaced by null at: {', '.join(bad[:20])}."})
    body["flags"] = flags
    return body
