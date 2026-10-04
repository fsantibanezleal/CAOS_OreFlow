"""K-11, C-10: failure paths of the bracketed root search (engine/roots.py, the same arithmetic as roots.ts)."""
from __future__ import annotations

import math

import pytest

import pipeline.engine.roots as roots
from pipeline.engine.roots import RootError, bracket_decreasing, illinois, solve_decreasing


def test_a_missing_sign_change_says_where_the_root_lies():
    with pytest.raises(RootError) as above:
        bracket_decreasing(lambda x: 1.0, 0.0, 0.5, -1.0, 1.0)
    assert above.value.side == "above"
    with pytest.raises(RootError) as below:
        bracket_decreasing(lambda x: -1.0, 0.0, 0.5, -1.0, 1.0)
    assert below.value.side == "below"


def test_illinois_raises_at_its_cap(monkeypatch):
    """0.08.001 returned the last iterate, 0.714 against the root 0.794, with no error and no flag."""
    real = roots.constant
    monkeypatch.setattr(roots, "constant", lambda key: 2 if key == "numerics.root_max_iterations" else real(key))
    with pytest.raises(RootError):
        illinois(lambda x: 0.5 - x ** 3, 0.0, 1.0, 0.5, -0.5)


def test_a_non_finite_value_inside_the_bracket_does_not_break_the_secant():
    """A trial point in a non-finite pocket lies on the positive side; 0.08.001 took inf as the secant weight and
    returned NaN."""
    def f(x: float) -> float:
        return math.inf if 0.4 <= x <= 0.6 else 0.5 - x ** 3

    root = solve_decreasing(f, 0.0, 1.0, 0.0, 1.0)
    assert root == pytest.approx(0.5 ** (1.0 / 3.0), rel=1e-9)
