"""CONTRACT-2 trace serialization for the particle-size and flotation response."""
from __future__ import annotations

TRACE_SCHEMA = "oreflow.trace/v1"


def build_trace(result) -> dict:
    return {"schema": TRACE_SCHEMA, "case_id": result.case_id,
            "size_um": result.size_um, "feed_psd": result.feed_psd,
            "crushed_psd": result.crushed_psd, "ground_psd": result.ground_psd,
            "overflow_psd": result.overflow_psd, "flotation_recovery": result.flotation_recovery,
            "metrics": result.metrics, "method_outputs": result.method_outputs}
