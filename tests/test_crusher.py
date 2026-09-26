"""PE-04: Whiten crusher form, mass conservation and CSS response."""
from __future__ import annotations

import numpy as np

from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.comminution import breakage_matrix, crush, whiten_classification
from pipeline.engine.grid import grid


def test_whiten_form_mass_and_css_response():
    g = grid()
    crusher = CASE_BY_ID["copper_porphyry_soft"].plant.crusher
    feed = g.rosin_rammler(crusher.feed_f80_um, crusher.feed_slope) * 500.0
    b = breakage_matrix(crusher.beta0, crusher.beta1, crusher.beta2)
    assert np.allclose(b[:, :-1].sum(axis=0), 1.0)
    assert np.all(np.triu(b) == 0.0)
    p80 = []
    for css_mm in (6.0, 8.0, 10.0, 14.0):
        css = css_mm * 1000.0
        product = crush(feed, css, crusher)
        assert np.isclose(product.sum(), feed.sum(), rtol=1e-12)
        assert np.all(product >= -1e-12)
        c = whiten_classification(css, crusher)
        below = g.size < crusher.k1_css * css
        assert np.all(c[below] == 0.0)
        assert np.all(product[below] >= feed[below] - 1e-12)
        p80.append(g.p80(product))
    assert all(a < b for a, b in zip(p80, p80[1:]))
