"""The authoring rules every case must keep after any re-authoring (#58): each plausibility range has a
source note, the nominal state sits inside its ranges and meets its own grade specification, and the
process-water capacity is the documented 5% above the nominal requirement."""
from __future__ import annotations

import pytest

from pipeline.cases.catalog import CASES, SOURCES
from pipeline.engine.circuit import simulate
from pipeline.engine.trace import trace


@pytest.fixture(scope="module")
def nominal() -> dict[str, dict[str, float]]:
    return {c.id: trace(simulate(c.ore, c.plant, c.nominal), c.nominal, c.plant.family)["metrics"] for c in CASES}


def test_every_range_names_its_source() -> None:
    for case in CASES:
        assert set(case.kpi_sources) == set(case.kpi_ranges), case.id
        for key, (en, es) in case.kpi_sources.items():
            assert en.strip() and es.strip(), (case.id, key)


def test_nominal_inside_its_ranges_and_spec(nominal: dict[str, dict[str, float]]) -> None:
    for case in CASES:
        m = nominal[case.id]
        for key, (low, high) in case.kpi_ranges.items():
            assert low <= m[key] <= high, (case.id, key, m[key])
        assert m["concentrate_grade"] >= case.plant.grade_spec.minimum, (case.id, m["concentrate_grade"])


def test_water_capacity_follows_its_rule(nominal: dict[str, dict[str, float]]) -> None:
    assert "5% above" in SOURCES["water"]
    for case in CASES:
        need = nominal[case.id]["water_intensity_m3_t"]
        assert case.plant.water_limit_m3_t == pytest.approx(1.05 * need, abs=0.006), (case.id, need, case.plant.water_limit_m3_t)
