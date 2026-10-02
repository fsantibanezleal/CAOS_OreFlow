"""Resolve an ore at an operating point: mineral fractions, compositions, densities, liberation.

Head grades fix the valuable-mineral fractions through each carrier's stoichiometric content; a
trace carrier (gold in pyrite) keeps its declared fraction and receives the content its share of
the head grade implies. Gangue minerals with a declared fraction are absolute; the single gangue
mineral declared with fraction 0 takes the balance.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .chemistry import mineral_composition, species_content
from .constants import constant, mineral_table
from .grid import grid
from .model import MineralSpec, OperatingPoint, Ore


def grade_to_fraction(value: float, unit: str) -> float:
    if unit == "%":
        return value / 100.0
    if unit == "g/t":
        return value / (100.0 * float(constant("units.gpt_per_pct")))
    raise ValueError(f"unsupported grade unit: {unit}")


def fraction_to_grade(value: float, unit: str) -> float:
    if unit == "%":
        return value * 100.0
    if unit == "g/t":
        return value * 100.0 * float(constant("units.gpt_per_pct"))
    raise ValueError(f"unsupported grade unit: {unit}")


@dataclass
class ResolvedOre:
    ids: list[str]
    spec: dict[str, MineralSpec]
    fraction: dict[str, float]
    composition: dict[str, dict[str, float]]     # species mass fraction per mineral
    density: dict[str, float]
    valuable: list[str]
    host: str                                   # balance gangue, reference density for cuts
    liberation: dict[str, np.ndarray]           # liberated fraction by size class
    species: list[str]                          # payable species then quality species
    units: dict[str, str]
    primary: str
    payables: list[str]
    crushing_work_index: float                  # scaled with the operating ball-mill work index

    def composite_density(self, mineral: str) -> float:
        spec = self.spec[mineral]
        c = spec.composite_content
        host = spec.host or self.host
        return 1.0 / (c / self.density[mineral] + (1.0 - c) / self.density[host])

    def content(self, mineral: str, species: str) -> float:
        return self.composition[mineral].get(species, 0.0)


def _total_assay(ore: Ore, op: OperatingPoint, spec: dict, ids: list[str], composition: dict[str, dict[str, float]],
                 fraction: dict[str, float], balance: str) -> None:
    """The head grade is the ore's total assay of the payable (E-02, review of 2026-10-02). Where the balance gangue or
    a declared mineral also holds the payable's element, the stoichiometric carriers carry only the rest: their grade
    G_c solves G = G_c + F + c_b (1 - X_d - X_o - G_c K), with F and X_d the declared minerals' element and fraction,
    X_o the other payables' carriers, c_b the balance gangue's content and K the carriers' sum of share over content.
    Until 0.08.000 the magnetite case's control set the iron in magnetite only, and its feed assayed 12% more."""
    for index, payable in enumerate(ore.payables):
        own = {c.mineral for c in payable.carriers}
        holders = [m for m in ids if m not in own and composition[m].get(payable.species, 0.0) > 0.0]
        if not holders:
            continue
        others = {c.mineral for p in ore.payables if p is not payable for c in p.carriers}
        if any(m in others for m in holders) or any(c.mode != "stoichiometric" for c in payable.carriers) or own & others:
            raise ValueError(f"{payable.species}: a carrier of another payable, or a trace carrier, holds it; not supported")
        grade = grade_to_fraction(op.head_grade if index == 0 else payable.head_grade, payable.unit)
        declared = [m for m in ids if m not in own and m not in others and m != balance]
        f_declared = sum(spec[m].fraction * composition[m].get(payable.species, 0.0) for m in declared)
        x_declared = sum(spec[m].fraction for m in declared)
        x_others = sum(fraction[m] for m in others)
        c_balance = composition[balance].get(payable.species, 0.0)
        k = sum(c.share / composition[c.mineral][payable.species] for c in payable.carriers)
        carried = (grade - f_declared - c_balance * (1.0 - x_declared - x_others)) / (1.0 - c_balance * k)
        if carried <= 0.0:
            raise ValueError(f"{payable.species}: the head grade is below what the gangue holds")
        for c in payable.carriers:
            fraction[c.mineral] = carried * c.share / composition[c.mineral][payable.species]


def resolve(ore: Ore, op: OperatingPoint) -> ResolvedOre:
    table = mineral_table()
    spec = {m.id: m for m in ore.minerals}
    ids = [m.id for m in ore.minerals]
    base = {m: mineral_composition(m) for m in ids}
    species = [p.species for p in ore.payables] + [s for s in ore.quality_species]
    composition: dict[str, dict[str, float]] = {
        m: {s: species_content(base[m], s) for s in species} for m in ids
    }
    fraction: dict[str, float] = {}
    valuable: list[str] = []
    for index, payable in enumerate(ore.payables):
        head = op.head_grade if index == 0 else payable.head_grade
        grade = grade_to_fraction(head, payable.unit)
        for carrier in payable.carriers:
            if carrier.mineral not in valuable:
                valuable.append(carrier.mineral)
            if carrier.mode == "stoichiometric":
                content = composition[carrier.mineral][payable.species]
                if content <= 0.0:
                    raise ValueError(f"{carrier.mineral} carries no {payable.species}")
                fraction[carrier.mineral] = fraction.get(carrier.mineral, 0.0) + grade * carrier.share / content
            elif carrier.mode == "trace":
                declared = spec[carrier.mineral].fraction
                if declared <= 0.0:
                    raise ValueError(f"trace carrier {carrier.mineral} needs a declared fraction")
                fraction[carrier.mineral] = declared
                composition[carrier.mineral][payable.species] = (
                    composition[carrier.mineral].get(payable.species, 0.0) + grade * carrier.share / declared)
            else:
                raise ValueError(f"unknown carrier mode: {carrier.mode}")
    balance = [m for m in ids if m not in fraction and spec[m].fraction == 0.0]
    if len(balance) != 1:
        raise ValueError(f"exactly one balance gangue mineral is required, found {balance}")
    _total_assay(ore, op, spec, ids, composition, fraction, balance[0])
    for m in ids:
        if m not in fraction and m not in balance:
            fraction[m] = spec[m].fraction
    remainder = 1.0 - sum(fraction.values())
    if remainder <= 0.0:
        raise ValueError("declared and derived mineral fractions exceed the ore")
    fraction[balance[0]] = remainder
    g = grid()
    for m in ids:
        grains = spec[m].grains
        if grains is None:
            continue
        # gravity-recoverable grains enter liberated with their own sizes (E-11): no liberation curve, no composites
        if spec[m].liberation_size_um > 0.0 or spec[m].composite_content > 0.0:
            raise ValueError(f"{m}: declared grains are liberated; a liberation size or composites cannot apply")
        sizes, passing = grains.size_um, grains.passing
        if (len(sizes) != len(passing) or any(b >= a for a, b in zip(sizes, sizes[1:])) or passing[0] != 1.0
                or any(b > a for a, b in zip(passing, passing[1:])) or passing[-1] < 0.0 or not 0.0 < grains.lower_um < sizes[-1]):
            raise ValueError(f"{m}: grains need descending sizes, all passing the first, non-increasing passing and a lower size below the last")
    liberation = {}
    for m in valuable:
        s = spec[m]
        if s.liberation_size_um > 0.0:
            liberation[m] = 1.0 / (1.0 + np.power(g.size / s.liberation_size_um, s.liberation_slope))
        else:
            liberation[m] = np.ones(g.n)
    units = {p.species: p.unit for p in ore.payables}
    for s in ore.quality_species:
        units.setdefault(s, "%")
    return ResolvedOre(
        ids=ids, spec=spec, fraction=fraction, composition=composition,
        density={m: float(table[m]["density"]) for m in ids}, valuable=valuable, host=balance[0],
        liberation=liberation, species=species, units=units, primary=ore.payables[0].species,
        payables=[p.species for p in ore.payables],
        crushing_work_index=ore.crushing_work_index_kwh_t * op.work_index_kwh_t / ore.work_index_kwh_t,
    )
