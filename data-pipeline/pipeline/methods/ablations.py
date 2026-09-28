"""Mechanism ablations: the same case with one mechanism of the engine taken away (AB-01 to AB-03).

Each switch is a counterfactual transformation of the case definition at its nominal state. Four mechanisms already
have a parameter that removes them; cleaner recirculation has an engine flag (``FlotationPlant.cleaner_tail_to_rougher``).
With every switch on the case is unchanged; a case without the mechanism is ``not_applicable``, never a zero effect.
``frontend/src/engine/ablations.ts`` applies the same transformations, so the browser can reproduce every record.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from typing import Any

from ..engine.circuit import simulate
from ..engine.model import OperatingPoint, Ore, Plant

OUTPUTS = ("recovery_pct", "concentrate_grade", "specific_energy_total_kwh_t", "recovered_primary_tph")

Transform = Callable[[Ore, Plant, OperatingPoint], tuple[Ore, Plant, OperatingPoint]]


def _entrainment_applies(ore: Ore, plant: Plant, op: OperatingPoint) -> bool:
    return plant.flotation is not None


def _entrainment(ore: Ore, plant: Plant, op: OperatingPoint) -> tuple[Ore, Plant, OperatingPoint]:
    f = plant.flotation
    banks = {"rougher": replace(f.rougher, wash_factor=0.0), "cleaner": replace(f.cleaner, wash_factor=0.0)}
    if f.recleaner is not None:
        banks["recleaner"] = replace(f.recleaner, wash_factor=0.0)
    return ore, replace(plant, flotation=replace(f, **banks)), op


def _composites_apply(ore: Ore, plant: Plant, op: OperatingPoint) -> bool:
    return any(m.liberation_size_um > 0.0 and m.composite_content > 0.0 for m in ore.minerals)


def _composites(ore: Ore, plant: Plant, op: OperatingPoint) -> tuple[Ore, Plant, OperatingPoint]:
    minerals = tuple(replace(m, composite_content=0.0) if m.liberation_size_um > 0.0 else m for m in ore.minerals)
    return replace(ore, minerals=minerals), plant, op


def _recirculation_applies(ore: Ore, plant: Plant, op: OperatingPoint) -> bool:
    return plant.flotation is not None


def _recirculation(ore: Ore, plant: Plant, op: OperatingPoint) -> tuple[Ore, Plant, OperatingPoint]:
    return ore, replace(plant, flotation=replace(plant.flotation, cleaner_tail_to_rougher=False)), op


def _regrind_applies(ore: Ore, plant: Plant, op: OperatingPoint) -> bool:
    return plant.flotation is not None and plant.flotation.regrind_energy_kwh_t > 0.0


def _regrind(ore: Ore, plant: Plant, op: OperatingPoint) -> tuple[Ore, Plant, OperatingPoint]:
    return ore, replace(plant, flotation=replace(plant.flotation, regrind_energy_kwh_t=0.0)), op


def _gravity_applies(ore: Ore, plant: Plant, op: OperatingPoint) -> bool:
    return plant.gravity is not None and op.gravity_bleed > 0.0


def _gravity(ore: Ore, plant: Plant, op: OperatingPoint) -> tuple[Ore, Plant, OperatingPoint]:
    return ore, plant, op.with_values(gravity_bleed=0.0)


# name: (what it removes, applicability, transformation); the order is the record's
SWITCHES: dict[str, tuple[tuple[str, str], Callable[[Ore, Plant, OperatingPoint], bool], Transform]] = {
    "entrainment": (("water-borne recovery of fine particles (Savassi)", "la recuperación por arrastre de partículas finas (Savassi)"),
                    _entrainment_applies, _entrainment),
    "composite_classes": (("composite particles: every grain of a valuable mineral liberated", "las partículas mixtas: cada grano de un mineral valioso liberado"),
                          _composites_apply, _composites),
    "cleaner_recirculation": (("the return of the cleaner tail to the rougher feed", "el retorno de la cola del cleaner a la alimentación rougher"),
                              _recirculation_applies, _recirculation),
    "regrind": (("the regrind of the rougher concentrate", "la remolienda del concentrado rougher"), _regrind_applies, _regrind),
    "gravity_bleed": (("the gravity bleed of the cyclone underflow", "la purga gravimétrica de la descarga del ciclón"), _gravity_applies, _gravity),
}


def ablate(ore: Ore, plant: Plant, op: OperatingPoint, base: dict[str, float] | None = None) -> dict[str, Any]:
    """Every switch at one state: its outputs with the mechanism off against on, or ``not_applicable``."""
    on = base if base is not None else simulate(ore, plant, op).metrics
    record: dict[str, Any] = {}
    for name, (_, applies, transform) in SWITCHES.items():
        if not applies(ore, plant, op):
            record[name] = {"status": "not_applicable"}
            continue
        result = simulate(*transform(ore, plant, op))
        off = {k: float(result.metrics[k]) for k in OUTPUTS}
        record[name] = {"status": "computed", "on": {k: float(on[k]) for k in OUTPUTS}, "off": off,
                        "delta": {k: off[k] - float(on[k]) for k in OUTPUTS},
                        "flags": [f["code"] for f in result.flags],
                        "balance": float(result.metrics["balance_max_relative_error"])}
    return record
