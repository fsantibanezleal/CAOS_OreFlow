"""Element contents of minerals from formulas and standard atomic weights.

A formula such as ``Ca5(PO4)3F`` or ``Fe4.5Ni4.5S8`` is parsed into element counts (decimal
subscripts and nested parentheses are allowed) and converted to mass fractions. Oxide grades such
as P2O5 and MgO are reported from their element through the oxide's own formula weight.
"""
from __future__ import annotations

import re
from functools import lru_cache

from .constants import atomic_weights, mineral_table, oxide_table

_TOKEN = re.compile(r"([A-Z][a-z]?|\(|\)|\d+(?:\.\d+)?)")


def parse_formula(formula: str) -> dict[str, float]:
    """Return element counts per formula unit."""
    tokens = _TOKEN.findall(formula.replace(" ", ""))
    if "".join(tokens) != formula.replace(" ", ""):
        raise ValueError(f"unparseable formula: {formula}")
    stack: list[dict[str, float]] = [{}]
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token == "(":
            stack.append({})
            i += 1
            continue
        if token == ")":
            group = stack.pop()
            count = 1.0
            if i + 1 < len(tokens) and tokens[i + 1][0].isdigit():
                count = float(tokens[i + 1])
                i += 1
            for element, n in group.items():
                stack[-1][element] = stack[-1].get(element, 0.0) + n * count
            i += 1
            continue
        if token[0].isdigit():
            raise ValueError(f"misplaced count in formula: {formula}")
        count = 1.0
        if i + 1 < len(tokens) and tokens[i + 1][0].isdigit():
            count = float(tokens[i + 1])
            i += 1
        stack[-1][token] = stack[-1].get(token, 0.0) + count
        i += 1
    if len(stack) != 1:
        raise ValueError(f"unbalanced parentheses: {formula}")
    return stack[0]


def formula_weight(formula: str) -> float:
    weights = atomic_weights()
    return sum(weights[element] * n for element, n in parse_formula(formula).items())


def mass_fractions(formula: str) -> dict[str, float]:
    weights = atomic_weights()
    counts = parse_formula(formula)
    total = sum(weights[element] * n for element, n in counts.items())
    return {element: weights[element] * n / total for element, n in counts.items()}


def oxide_factor(oxide: str) -> float:
    """Mass of oxide per unit mass of its element (for example P2O5 per P)."""
    entry = oxide_table()[oxide]
    element = entry["element"]
    counts = parse_formula(entry["formula"])
    return formula_weight(entry["formula"]) / (atomic_weights()[element] * counts[element])


@lru_cache(maxsize=None)
def mineral_composition(mineral_id: str) -> dict[str, float]:
    """Element mass fractions of a library mineral."""
    entry = mineral_table()[mineral_id]
    if "formula" in entry:
        return mass_fractions(entry["formula"])
    composition = dict(entry["composition"])
    total = sum(composition.values())
    return {element: value / total for element, value in composition.items()}


def species_content(composition: dict[str, float], species: str) -> float:
    """Mass fraction of an element or an oxide species (P2O5, MgO, SiO2) in a composition."""
    if species in composition:
        return composition[species]
    oxides = oxide_table()
    if species in oxides:
        element = oxides[species]["element"]
        return composition.get(element, 0.0) * oxide_factor(species)
    return 0.0
