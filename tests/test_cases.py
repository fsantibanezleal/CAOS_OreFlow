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
    # six target-mode variants and the two cut-mode variants of CM-06
    assert all(len(c.variants) == 8 and [v["id"] for v in c.variants[-2:]] == ["cut_nominal", "cut_finer"] for c in CASES)


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


@pytest.mark.parametrize("case", CASES, ids=[c.id for c in CASES])
def test_water_capacity_is_five_percent_above_nominal(case):
    # SOURCES["water"]: the process-water capacity is authored 5% above the nominal requirement
    nominal = run_variant(case.id, "nominal").metrics["water_intensity_m3_t"]
    assert "water" in case.sources
    assert 1.04 <= case.plant.water_limit_m3_t / nominal <= 1.06, (case.plant.water_limit_m3_t, nominal)


def test_refractory_grade_ceiling_is_reachable():
    """E-19: the refractory gold grade ceiling is a concentrate of pure carrier sulphides at the nominal head."""
    from pipeline.cases.catalog import CASE_BY_ID

    case = CASE_BY_ID["refractory_gold"]
    payable = case.ore.payables[0]
    carriers = {c.mineral for c in payable.carriers}
    sulphides = sum(m.fraction for m in case.ore.minerals if m.id in carriers)
    assert case.kpi_ranges["concentrate_grade"][1] == round(payable.head_grade / sulphides, 1) == 38.6
    # E-20: the Mo range's source is a rougher statement read from a summary, and it says so
    mo = CASE_BY_ID["copper_molybdenum"].kpi_sources["recovery_Mo_pct"]
    assert "UNVERIFIED" in mo[0] and "NO VERIFICADO" in mo[1] and "whole circuit" in mo[0]


def test_every_plausibility_range_has_a_classified_source():
    # T-02 (review of 2026-10-02): the pages count cited, partly authored and authored ranges from the benchmark,
    # which classifies each range's source; an unsourced range would be counted as cited, so every range has one
    from pipeline.stages.benchmark import kpi_basis

    assert kpi_basis("Authored: no published range was found for this case type.") == "authored"
    assert kpi_basis("Above 90% (secondary source); the 96% ceiling is authored.") == "authored_bound"
    assert kpi_basis("About 20% Ni (review); UNVERIFIED upper bound.") == "authored_bound"
    assert kpi_basis("From 25% Cu (Kroha and Wesis 1985) to 34.6% Cu, the stoichiometric limit of chalcopyrite.") == "cited"
    for case in CASES:
        assert set(case.kpi_sources) == set(case.kpi_ranges), case.id
        for key, (en, es) in case.kpi_sources.items():
            assert en and es, (case.id, key)
            assert kpi_basis(en) in {"cited", "authored_bound", "authored"}
