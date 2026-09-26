"""PE-11 cyclone partition with bypass and density correction; PE-12 Plitt sizing."""
from __future__ import annotations

import numpy as np
import pytest

from engine_helpers import run_variant
from pipeline.cases.catalog import CASES
from pipeline.engine.cyclone import corrected_cut, reduced_partition
from pipeline.engine.grid import grid


def test_partition_bypass_and_density_correction():
    result = run_variant("copper_porphyry_soft", "nominal")
    g = result.grinding
    water = g.water
    assert g.bypass == pytest.approx(water["underflow_tph"] / (water["underflow_tph"] + water["overflow_tph"]), rel=1e-12)
    host = np.array(result.curves["partition"]["host"])
    assert host[-1] == pytest.approx(g.bypass, abs=1e-3)
    assert host[-1] >= g.bypass
    assert host[0] == pytest.approx(1.0, abs=1e-9)
    assert np.all(np.diff(host) <= 1e-12)
    dense = np.array(result.curves["partition"]["chalcopyrite"])
    assert np.all(dense >= host - 1e-12)
    assert corrected_cut(100.0, 2.65, 5.0) < 100.0 < corrected_cut(100.0, 2.65, 2.2)
    y = reduced_partition(50.0, 2.0)
    assert np.interp(50.0, grid().size[::-1], y[::-1]) == pytest.approx(0.5, abs=0.02)


@pytest.mark.parametrize("case_id", [c.id for c in CASES])
def test_plitt_sizing_consistency(case_id):
    sizing = run_variant(case_id, "nominal").grinding.sizing
    assert sizing.cyclones >= 1
    assert abs(sizing.d50c_um / sizing.required_d50c_um - 1.0) < 0.10
    assert sizing.pressure_kpa > 0.0 and 0.0 < sizing.volume_split < 1.0
