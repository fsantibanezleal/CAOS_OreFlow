"""Flotation circuit: rougher, optional regrind, cleaner and optional recleaner, with recycles.

Per perfectly mixed cell, with residence ``tau`` (min), true-flotation rate ``k`` (1/min), degree of
entrainment ``ENT`` and water recovery ``r_w`` (``w = r_w/(1 - r_w) = k_w tau``), a particle class is
recovered with ``r = (k tau + ENT w)/(1 + k tau + ENT w)``. The tail carries the pulp composition, so
``tau`` is the cell's pulp volume over its own tail flow; the cells of a bank are solved in series, each
on the tail of the one before, and the bank recovers ``1 - prod_j (1 - r_j)`` (F-02).
``k = 60 P Sb f_size f_dose`` with ``Sb = 6 Jg/D32`` (Gorain et al. 1997); ENT after Savassi et al.
(1998). Cleaner tails return to the rougher feed and recleaner tails to the cleaner feed; the
regrind (open-circuit population balance) changes sizes, and so liberation, before cleaning.
Sources and assumptions: docs/methodologies/05_flotation.md.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable

import numpy as np

from .constants import constant
from .grid import grid
from .model import Bank, Flags, FlotationPlant, OperatingPoint
from .ore import ResolvedOre
from .species import SpeciesDef, species_content, species_defs, to_minerals, to_species
from .streams import Stream

Species = dict[str, np.ndarray]


def bubble_surface_flux(jg_cm_s: float, plant: FlotationPlant) -> float:
    d32 = plant.d32_base_mm + plant.d32_slope_mm_per_cm_s * jg_cm_s
    return float(constant("flotation.sb_factor")) * jg_cm_s / d32


def savassi_entrainment(xi_um: float, delta: float) -> np.ndarray:
    """``ENT = 2 / (exp(z) + exp(-z))``, ``z = 2.292 (d/xi)^adj``, ``adj = 1 - ln(1/delta)/exp(d/xi)``.

    Exponents are capped where ENT is already zero in double precision, so coarse classes do not
    overflow.
    """
    size = grid().size
    ratio = size / xi_um
    cap = math.log(np.finfo(float).max) / 2.0
    adj = 1.0 - math.log(1.0 / delta) / np.exp(np.minimum(ratio, cap))
    z = np.minimum(float(constant("savassi.constant")) * np.power(ratio, adj), cap)
    return 2.0 / (np.exp(z) + np.exp(-z))


def size_response(optimum_um: float, fine_width: float, coarse_width: float) -> np.ndarray:
    size = grid().size
    log_ratio = np.log(size / optimum_um)
    width = np.where(log_ratio < 0.0, fine_width, coarse_width)
    return np.exp(-0.5 * np.square(log_ratio / width))


def dose_response(dose_gpt: float, half_dose_gpt: float, unresponsive: float) -> float:
    return unresponsive + (1.0 - unresponsive) * dose_gpt / (dose_gpt + half_dose_gpt)


def rate_constants(ore: ResolvedOre, defs: list[SpeciesDef], sb: float, dose_gpt: float) -> Species:
    """True-flotation rate constant (1/min) of every particle class by size."""
    per_minute = float(constant("time.seconds_per_minute"))
    out: Species = {}
    for d in defs:
        response = ore.spec[d.mineral].flotation
        if response is None:
            out[d.id] = np.zeros(grid().n)
            continue
        p = response.floatability
        if d.kind == "composite":
            # the exposed valuable surface goes with the two-thirds power of the valuable's VOLUME share (F-01)
            volume = {mineral: share / ore.density[mineral] for mineral, share in d.makeup}
            p = p * (volume[d.mineral] / sum(volume.values())) ** float(constant("flotation.composite_surface_exponent"))
        shape = size_response(response.optimum_size_um, response.fine_width, response.coarse_width)
        out[d.id] = per_minute * p * sb * shape * dose_response(dose_gpt, response.half_dose_gpt, response.unresponsive_fraction)
    return out


@dataclass
class BankResult:
    recovery: Species                  # over the bank, per class and size
    water_recovery: float
    cell_water_recovery: list[float]   # per cell
    tau_cell_min: float                # the mean of the cells' residences
    residence_min: float               # their sum
    entrained_share: Species           # share of what the bank recovers of a class that came by entrainment
    cell_recovery: list[Species]       # per cell
    cell_residence_min: list[float]
    converged: bool                    # every cell's tail flow settled


def pulp_flow_m3_min(species: Species, defs: list[SpeciesDef], water_tph: float) -> float:
    water_density = float(constant("water.density_t_m3"))
    minutes = float(constant("time.minutes_per_hour"))
    solids = sum(float(np.sum(species[d.id])) / d.density for d in defs)
    return (solids + water_tph / water_density) / minutes


def tail_flow(g: Callable[[float], float], q0: float) -> tuple[float, bool]:
    """The fixed point ``q = g(q)`` of a cell's tail flow, from the feed flow ``q0``. ``g`` rises with ``q`` (a faster
    pulp floats less), so a plain substitution from ``q0`` descends to it; the secant takes over while its step stays
    inside ``(0, q0]``."""
    tolerance = float(constant("numerics.cell_tail_tolerance"))
    q_prev, h_prev = q0, q0 - g(q0)
    if h_prev == 0.0:
        return q0, True
    q = q0 - h_prev
    for _ in range(int(constant("numerics.root_max_iterations"))):
        h = q - g(q)
        if abs(h) <= tolerance * q:
            return q, True
        candidate = q - h * (q - q_prev) / (h - h_prev) if h != h_prev else q - h
        q_prev, h_prev = q, h
        q = candidate if 0.0 < candidate <= q0 else q - h
    return q, False


def bank(rates: Species, ent: np.ndarray, cells: int, bank_def: Bank, feed: Species, feed_water: float,
         defs: list[SpeciesDef], sb: float, water_floatability: float) -> BankResult:
    """A bank of ``cells`` perfect mixers in series. Each cell's residence is its pulp volume over its own tail flow,
    as the single-cell balance requires (the tail carries the pulp composition); until 0.09.000 every cell took the
    bank feed's flow, which understated recovery by 0.3 to 1 point (review of 2026-10-04, F-02)."""
    per_minute = float(constant("time.seconds_per_minute"))
    volume = bank_def.cell_volume_m3 * (1.0 - bank_def.gas_holdup)
    kw = per_minute * water_floatability * sb
    ent_eff = ent * bank_def.wash_factor
    n = grid().n
    x = {k: v.copy() for k, v in feed.items()}
    water = feed_water
    unfloated = {k: np.ones(n) for k in rates}
    entrained = {k: np.zeros(n) for k in rates}
    water_unfloated = 1.0
    cell_recovery: list[Species] = []
    cell_water: list[float] = []
    residence: list[float] = []
    converged = True

    def cell(q: float) -> tuple[float, float, Species]:
        tau = volume / q
        w = kw * tau
        return tau, w, {key: (k * tau + ent_eff * w) / (1.0 + k * tau + ent_eff * w) for key, k in rates.items()}

    def tail(q: float) -> float:
        _, w, r = cell(q)
        return pulp_flow_m3_min({key: x[key] * (1.0 - r[key]) for key in x}, defs, water / (1.0 + w))

    for _ in range(cells):
        q, settled = tail_flow(tail, pulp_flow_m3_min(x, defs, water))
        converged = converged and settled
        tau, w, r = cell(q)
        for key, k in rates.items():
            numerator = k * tau + ent_eff * w
            share = np.where(numerator > 0.0, ent_eff * w / np.where(numerator > 0.0, numerator, 1.0), 0.0)
            entrained[key] = entrained[key] + unfloated[key] * r[key] * share
            unfloated[key] = unfloated[key] * (1.0 - r[key])
            x[key] = x[key] * (1.0 - r[key])
        water = water / (1.0 + w)
        water_unfloated /= 1.0 + w
        cell_recovery.append(r)
        cell_water.append(w / (1.0 + w))
        residence.append(tau)
    recovery = {key: 1.0 - unfloated[key] for key in rates}
    share = {key: np.where(recovery[key] > 0.0, entrained[key] / np.where(recovery[key] > 0.0, recovery[key], 1.0), 0.0) for key in rates}
    total = float(sum(residence))
    return BankResult(recovery, 1.0 - water_unfloated, cell_water, total / cells, total, share, cell_recovery, residence, converged)


@dataclass
class FlotationResult:
    streams: dict[str, Stream]
    species_final: Species
    rougher: BankResult
    cleaner: BankResult
    recleaner: BankResult | None
    rougher_feed_species: Species
    feed_species: Species
    defs: list[SpeciesDef]
    iterations: int
    residual_tph: float
    sb_rougher: float
    sb_cleaner: float
    rates_rougher: Species
    dilution_water_tph: float
    regrind_feed_tph: float
    dilution_cleaner_tph: float
    dilution_recleaner_tph: float
    dilution_rougher_tph: float
    relative_change: float = 0.0     # largest per-class relative change of the last recycle pass


def _solids(species: Species) -> float:
    return float(sum(float(np.sum(v)) for v in species.values()))


def _diluted(water: float, solids: float, target_solids: float) -> float:
    """Water after diluting to the target solids fraction; water is only ever added."""
    return max(water, solids * (1.0 - target_solids) / target_solids)


def _relative_change(new: Species, old: Species) -> float:
    """Largest change of any particle class between passes, relative to that class's total flow."""
    worst = 0.0
    for k, values in new.items():
        scale = float(np.sum(np.abs(values)))
        if scale > 0.0:
            worst = max(worst, float(np.sum(np.abs(values - old[k]))) / scale)
    return worst


def run_flotation(fo: Species, feed_water: float, ore: ResolvedOre, plant: FlotationPlant, op: OperatingPoint, flags: Flags,
                  regrind: Callable[[dict[str, np.ndarray]], dict[str, np.ndarray]] | None = None) -> FlotationResult:
    """Flotation of particle classes ``fo`` (t/h by class and size) carried forward from the upstream
    separation; only the regrind product is split again into classes, because it is a product of
    breakage."""
    defs = species_defs(ore)
    arriving_water = feed_water
    if plant.rougher.feed_solids > 0.0:
        feed_water = _diluted(feed_water, _solids(fo), plant.rougher.feed_solids)
    rougher_dilution = feed_water - arriving_water
    ent = savassi_entrainment(plant.entrainment_size_um, plant.drainage)
    sb_r = bubble_surface_flux(op.jg_cm_s, plant)
    sb_c = bubble_surface_flux(plant.cleaner.jg_cm_s, plant)
    k_r = rate_constants(ore, defs, sb_r, op.collector_gpt)
    k_c = rate_constants(ore, defs, sb_c, op.collector_gpt)
    recl = plant.recleaner
    sb_rc = bubble_surface_flux(recl.jg_cm_s, plant) if recl is not None else 0.0
    k_rc = rate_constants(ore, defs, sb_rc, op.collector_gpt) if recl is not None else {}
    zeros = {d.id: np.zeros(grid().n) for d in defs}

    def pass_once(x: Species, water_x: float, t_rc: Species, water_t_rc: float) -> dict[str, object]:
        rougher = bank(k_r, ent, op.rougher_cells, plant.rougher, x, water_x, defs, sb_r, plant.water_floatability)
        conc_r = {k: rougher.recovery[k] * x[k] for k in x}
        water_conc_r = rougher.water_recovery * water_x
        if regrind is not None:
            ground = to_species(Stream(regrind(to_minerals(conc_r, defs, ore)), water_conc_r), ore, defs, flags)
        else:
            ground = conc_r
        y = {k: ground[k] + t_rc[k] for k in x}
        water_y0 = water_conc_r + water_t_rc
        water_y = _diluted(water_y0, _solids(y), plant.cleaner.feed_solids)
        cleaner = bank(k_c, ent, plant.cleaner.cells, plant.cleaner, y, water_y, defs, sb_c, plant.water_floatability)
        conc_c = {k: cleaner.recovery[k] * y[k] for k in x}
        tail_c = {k: y[k] - conc_c[k] for k in x}
        water_conc_c = cleaner.water_recovery * water_y
        out: dict[str, object] = {"rougher": rougher, "conc_r": conc_r, "water_conc_r": water_conc_r, "ground": ground,
                                  "y": y, "water_y": water_y, "dilution_c": water_y - water_y0, "cleaner": cleaner,
                                  "conc_c": conc_c, "tail_c": tail_c, "water_conc_c": water_conc_c,
                                  "water_tail_c": water_y - water_conc_c}
        if recl is not None:
            water_z = _diluted(water_conc_c, _solids(conc_c), recl.feed_solids)
            recleaner = bank(k_rc, ent, recl.cells, recl, conc_c, water_z, defs, sb_rc, plant.water_floatability)
            final = {k: recleaner.recovery[k] * conc_c[k] for k in x}
            water_final = recleaner.water_recovery * water_z
            out.update({"recleaner": recleaner, "water_z": water_z, "dilution_rc": water_z - water_conc_c, "final": final,
                        "water_final": water_final, "tail_rc": {k: conc_c[k] - final[k] for k in x},
                        "water_tail_rc": water_z - water_final})
        else:
            out.update({"recleaner": None, "final": conc_c, "water_final": water_conc_c, "tail_rc": zeros,
                        "water_tail_rc": 0.0, "dilution_rc": 0.0})
        return out

    x = {k: v.copy() for k, v in fo.items()}
    water_x = feed_water
    t_rc, water_t_rc = zeros, 0.0
    tol = float(constant("numerics.recycle_tolerance_tph"))
    rtol = float(constant("numerics.recycle_rel_tolerance"))
    iterations, residual, relative = 0, math.inf, math.inf
    recirculate = plant.cleaner_tail_to_rougher
    for iterations in range(1, int(constant("numerics.recycle_max_iterations")) + 1):
        state = pass_once(x, water_x, t_rc, water_t_rc)
        x_new = {k: fo[k] + state["tail_c"][k] for k in x} if recirculate else {k: fo[k].copy() for k in x}
        water_x_new = feed_water + state["water_tail_c"] if recirculate else feed_water
        t_rc_new = state["tail_rc"]
        water_t_rc_new = state["water_tail_rc"]
        residual = (max(float(np.max(np.abs(x_new[k] - x[k]))) for k in x) + abs(water_x_new - water_x)
                    + max(float(np.max(np.abs(t_rc_new[k] - t_rc[k]))) for k in x) + abs(water_t_rc_new - water_t_rc))
        # The absolute residual is set by the bulk flows; the relative change per particle class makes
        # trace minerals (gold at 1e-4 t/h) close as tightly as the gangue (PE-02).
        relative = max(_relative_change(x_new, x), _relative_change(t_rc_new, t_rc))
        x, water_x, t_rc, water_t_rc = x_new, water_x_new, t_rc_new, water_t_rc_new
        if residual < tol and relative < rtol:
            break
    if residual >= tol or relative >= rtol:
        flags.add("recycle_not_converged", f"Flotation recycle residual {residual:.2e} t/h (relative {relative:.2e}) "
                                           f"after {iterations} iterations.")
    s = pass_once(x, water_x, t_rc, water_t_rc)
    if not all(b.converged for b in (s["rougher"], s["cleaner"], s["recleaner"]) if b is not None):
        flags.add("cell_residence_not_converged", "A flotation cell's tail flow did not settle; the last iterate is reported.")

    def stream(species: Species, water: float) -> Stream:
        return Stream(to_minerals(species, defs, ore), water)

    rougher: BankResult = s["rougher"]
    streams = {
        "flotation_feed": stream(fo, feed_water),
        "rougher_feed": stream(x, water_x),
        "rougher_concentrate": stream(s["conc_r"], s["water_conc_r"]),
        "rougher_tail": stream({k: x[k] - s["conc_r"][k] for k in x}, water_x - s["water_conc_r"]),
    }
    if regrind is not None:
        streams["regrind_product"] = stream(s["ground"], s["water_conc_r"])
    streams.update({
        "cleaner_feed": stream(s["y"], s["water_y"]),
        "cleaner_concentrate": stream(s["conc_c"], s["water_conc_c"]),
        "cleaner_tail": stream(s["tail_c"], s["water_tail_c"]),
    })
    if recl is not None:
        streams.update({
            "recleaner_feed": stream(s["conc_c"], s["water_z"]),
            "recleaner_concentrate": stream(s["final"], s["water_final"]),
            "recleaner_tail": stream(s["tail_rc"], s["water_tail_rc"]),
        })
    return FlotationResult(streams, s["final"], rougher, s["cleaner"], s["recleaner"], x, fo, defs, iterations, residual,
                           sb_r, sb_c, k_r, rougher_dilution + s["dilution_c"] + s["dilution_rc"], _solids(s["conc_r"]),
                           s["dilution_c"], s["dilution_rc"], rougher_dilution, relative)


def final_stream_name(result: FlotationResult) -> str:
    return "recleaner_concentrate" if result.recleaner is not None else "cleaner_concentrate"


def bank_profile(result: FlotationResult, ore: ResolvedOre, species: str) -> list[dict[str, float]]:
    """Cumulative grade and recovery of ``species`` along the rougher cells (grade-recovery curve), each cell with its
    own recovery (F-02)."""
    x, defs = result.rougher_feed_species, result.defs
    content = {d.id: species_content(d, ore, species) for d in defs}
    total = sum(content[d.id] * float(np.sum(x[d.id])) for d in defs)
    feed_mass = sum(float(np.sum(x[d.id])) for d in defs)
    unfloated = {d.id: np.ones(grid().n) for d in defs}
    out = []
    for j, cell in enumerate(result.rougher.cell_recovery, start=1):
        for d in defs:
            unfloated[d.id] = unfloated[d.id] * (1.0 - cell[d.id])
        mass = sum(float(np.sum(x[d.id] * (1.0 - unfloated[d.id]))) for d in defs)
        value = sum(content[d.id] * float(np.sum(x[d.id] * (1.0 - unfloated[d.id]))) for d in defs)
        out.append({"cell": j, "recovery": value / total if total > 0.0 else 0.0, "grade": value / mass if mass > 0.0 else 0.0,
                    "mass_pull": mass / feed_mass if feed_mass > 0.0 else 0.0})
    return out
