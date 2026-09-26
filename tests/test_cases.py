"""PE-32 single-factor variants; PE-34 units and sources; nominal KPI plausibility gate."""
from __future__ import annotations

import pytest

from engine_helpers import run_variant
from pipeline.cases.catalog import CASES, SOURCES, variant_point
from pipeline.engine.constants import mineral_table
from pipeline.engine.model import OPERATING_FIELDS


def test_catalog_shape():
    assert len(CASES) == 12
    assert len({c.id for c in CASES}) == 12
    assert {c.category for c in CASES} == {"liberation", "classification", "flotation", "integration"}
    assert all(len(c.variants) == 6 for c in CASES)


@pytest.mark.parametrize("case", CASES, ids=[c.id for c in CASES])
def test_variants_are_single_factor(case):
    assert case.variants[0]["id"] == "nominal" and case.variants[0]["change"] == {}
    for variant in case.variants[1:]:
        point = variant_point(case, variant)
        changed = [f for f in OPERATING_FIELDS if getattr(point, f) != getattr(case.nominal, f)]
        assert len(changed) == 1, (variant["id"], changed)
        assert changed == list(variant["change"])


@pytest.mark.parametrize("case", CASES, ids=[c.id for c in CASES])
def test_parameters_carry_units_and_sources(case):
    table = mineral_table()
    for mineral in case.ore.minerals:
        assert mineral.id in table and table[mineral.id]["source"]
    assert case.sources and all(key in SOURCES for key in case.sources)
    assert "kpi" in case.sources and case.kpi_ranges
    assert case.title[0] and case.title[1] and case.description[0] and case.description[1]
    assert "not plant-calibrated" in case.provenance


@pytest.mark.parametrize("case", CASES, ids=[c.id for c in CASES])
def test_nominal_kpis_within_literature_ranges(case):
    metrics = run_variant(case.id, "nominal").metrics
    for key, (lo, hi) in case.kpi_ranges.items():
        assert lo <= metrics[key] <= hi, (case.id, key, metrics[key], (lo, hi))
