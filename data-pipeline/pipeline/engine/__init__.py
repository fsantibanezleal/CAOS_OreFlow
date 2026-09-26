"""Steady-state process engine: crushing, closed-circuit ball milling, hydrocyclone classification,
flotation, gravity gold recovery, magnetic separation and desliming, with an independent mass audit.

``circuit.simulate(ore, plant, op)`` is the single entry point. Every numeric constant is declared in
``data/constants.json`` with its unit and source; mineral compositions are derived from formulas in
``data/minerals.json`` and atomic weights in ``data/atomic_weights.json``. The model equations and their
references are documented in ``docs/models/``.
"""
