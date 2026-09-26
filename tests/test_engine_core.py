"""PE-01 streams on one grid; PE-03 stoichiometry from atomic weights."""
from __future__ import annotations

import math

import numpy as np
import pytest

from engine_helpers import run_variant
from pipeline.engine.chemistry import mineral_composition, oxide_factor, species_content
from pipeline.engine.grid import grid


def test_grid_and_stream_shapes():
    g = grid()
    assert g.n == 63
    ratios = g.upper[:-1] / g.upper[1:]
    assert np.allclose(ratios, 2.0 ** 0.25)
    assert math.isclose(g.upper[0], 150000.0)
    assert g.upper[-1] == pytest.approx(3.24, abs=0.01)
    result = run_variant("copper_porphyry_soft", "nominal")
    for name, stream in result.streams.items():
        assert stream.water >= 0.0, name
        for mineral, mass in stream.solids.items():
            assert mass.shape == (g.n,), (name, mineral)


def test_stoichiometry_from_atomic_weights():
    assert mineral_composition("chalcopyrite")["Cu"] == pytest.approx(0.3463, abs=2e-4)
    assert mineral_composition("molybdenite")["Mo"] == pytest.approx(0.5994, abs=2e-4)
    assert mineral_composition("magnetite")["Fe"] == pytest.approx(0.7236, abs=2e-4)
    assert species_content(mineral_composition("fluorapatite"), "P2O5") == pytest.approx(0.422, abs=1e-3)
    assert species_content(mineral_composition("lizardite"), "MgO") == pytest.approx(0.4362, abs=2e-3)
    assert oxide_factor("P2O5") == pytest.approx(2.2914, abs=1e-3)
    assert mineral_composition("sphalerite")["Zn"] == pytest.approx(0.622, abs=2e-3)
