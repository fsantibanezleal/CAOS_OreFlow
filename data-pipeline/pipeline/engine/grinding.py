"""Closed ball-mill circuit: energy-specific population balance, cyclone, gravity bleed, water.

For each mineral the steady state satisfies ``(T^-1(e) - diag(r)) p = f + s``: ``p`` is the mill
product, ``f`` the new feed, ``r`` the fraction of each class that returns to the mill (underflow
minus the gravity bleed recovery) and ``s`` a source that carries host gangue locked in composites.
Valuable minerals are solved first because their composites define that source. The solver meets
the target overflow P80 at the design circulating load (docs/methodologies/03_grinding-circuit.md).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .comminution import MillOperator, bond_energy, breakage_matrix, selection_energy
from .constants import constant
from .cyclone import PlittSizing, corrected_cut, reduced_partition, size_cluster
from .grid import grid
from .model import Flags, OperatingPoint, Plant
from .ore import ResolvedOre
from .roots import RootError, solve_decreasing
from .species import SpeciesDef, partition_species, species_defs, to_minerals, to_species
from .streams import Stream


@dataclass
class PassResult:
    product: dict[str, np.ndarray]
    underflow: dict[str, np.ndarray]
    overflow: dict[str, np.ndarray]
    gravity: dict[str, np.ndarray]
    circulating_load: float


@dataclass
class GrindingResult:
    energy_per_pass_kwh_t: float
    specific_energy_kwh_t: float
    power_kw: float
    required_power_kw: float
    power_limited: bool
    cut_um: float
    bypass: float
    circulating_load: float
    target_p80_um: float
    p80_um: float
    feed_f80_um: float
    streams: dict[str, Stream]
    partition: dict[str, list[float]]
    sizing: PlittSizing | None
    water: dict[str, float]
    gold_circulating_load: float | None
    defs: list[SpeciesDef]
    overflow_species: dict[str, np.ndarray]
    species_consistency: float
    composite_scale: np.ndarray        # host-limited composite scale per class (1 = declared content)


class GrindingCircuit:
    def __init__(self, ore: ResolvedOre, plant: Plant, op: OperatingPoint, new_feed: dict[str, np.ndarray], flags: Flags) -> None:
        self.ore, self.plant, self.op, self.feed, self.flags = ore, plant, op, new_feed, flags
        self.g = grid()
        mill = plant.mill
        b = breakage_matrix(mill.beta0, mill.beta1, mill.beta2)
        base = selection_energy(mill, op.work_index_kwh_t)
        self.operators: dict[str, MillOperator] = {}
        for m in ore.ids:
            spec = ore.spec[m]
            if m in ore.valuable:
                lib = ore.liberation[m]
                selection = base * (lib * spec.grindability + (1.0 - lib))
            else:
                selection = base * spec.grindability
            self.operators[m] = MillOperator(selection, b)
        self.new_feed_tph = float(sum(float(np.sum(v)) for v in new_feed.values()))
        water_density = float(constant("water.density_t_m3"))
        su = plant.cyclone.underflow_solids
        self.water_over = self.new_feed_tph * op.water_m3_t * water_density
        self.water_under = op.circulating_load * self.new_feed_tph * (1.0 - su) / su
        self.bypass = self.water_under / (self.water_under + self.water_over)
        self.bleed = op.gravity_bleed if plant.gravity is not None else 0.0
        self.rho_host = ore.density[ore.host]
        self._cut_guess = math.log(max(op.target_p80_um, 1.0))
        self.composite_scale = np.ones(self.g.n)   # host-limited composite scale of the last run
        for m in ore.valuable:
            host = ore.spec[m].host
            if ore.spec[m].composite_content > 0.0 and host and host != ore.host:
                raise ValueError(f"composites of {m} must be hosted by the balance gangue {ore.host}")

    def _gravity_curve(self) -> np.ndarray:
        gp = self.plant.gravity
        return gp.max_recovery * (1.0 - np.exp(-np.power(self.g.size / gp.size_scale_um, 2.0)))

    def _pass(self, energy_per_pass: float, cut: float, scale: np.ndarray) -> tuple[PassResult, np.ndarray]:
        """One steady-state solve with composites scaled by ``scale`` per class (1 = declared content)."""
        ore, rf, bleed = self.ore, self.bypass, self.bleed
        sharp = self.plant.cyclone.sharpness
        y_host = reduced_partition(cut, sharp)
        product: dict[str, np.ndarray] = {}
        under: dict[str, np.ndarray] = {}
        over: dict[str, np.ndarray] = {}
        grav: dict[str, np.ndarray] = {}
        host_source = np.zeros(self.g.n)
        demand = np.zeros(self.g.n)
        for m in ore.valuable:
            spec = ore.spec[m]
            c = spec.composite_content
            unliberated = 1.0 - ore.liberation[m]
            locked_fraction = unliberated * scale if c > 0.0 else np.zeros(self.g.n)
            free_fraction = 1.0 - locked_fraction
            y_lib = reduced_partition(corrected_cut(cut, self.rho_host, ore.density[m]), sharp)
            y_comp = reduced_partition(corrected_cut(cut, self.rho_host, ore.composite_density(m)), sharp) if c > 0.0 else y_lib
            a_lib = rf + (1.0 - rf) * y_lib
            a_comp = rf + (1.0 - rf) * y_comp
            c_under = free_fraction * a_lib + locked_fraction * a_comp
            if bleed > 0.0 and spec.gravity:
                gp = self.plant.gravity
                g_frac = bleed * (self._gravity_curve() * free_fraction * a_lib + gp.composite_recovery * locked_fraction * a_comp)
            elif bleed > 0.0:
                g_frac = bleed * self.plant.gravity.gangue_yield * c_under
            else:
                g_frac = np.zeros(self.g.n)
            matrix = self.operators[m].inverse(energy_per_pass) - np.diag(c_under - g_frac)
            p = np.linalg.solve(matrix, self.feed[m])
            product[m], under[m], grav[m] = p, c_under * p, g_frac * p
            over[m] = p - under[m]
            if c > 0.0:
                demand += unliberated * p * (1.0 - c) / c
                host_source += (1.0 - rf) * locked_fraction * p * (1.0 - c) / c * (y_comp - y_host)
        for m in ore.ids:
            if m in ore.valuable:
                continue
            y = y_host if m == ore.host else reduced_partition(corrected_cut(cut, self.rho_host, ore.density[m]), sharp)
            c0 = rf + (1.0 - rf) * y
            g_yield = bleed * self.plant.gravity.gangue_yield if bleed > 0.0 else 0.0
            source = host_source if m == ore.host else np.zeros(self.g.n)
            matrix = self.operators[m].inverse(energy_per_pass) - np.diag((1.0 - g_yield) * c0)
            p = np.linalg.solve(matrix, self.feed[m] + (1.0 - g_yield) * source)
            u = c0 * p + source
            product[m], under[m], grav[m] = p, u, g_yield * u
            over[m] = p - u
        total_under = float(sum(float(np.sum(u)) for u in under.values()))
        return PassResult(product, under, over, grav, total_under / self.new_feed_tph), demand

    def run(self, energy_per_pass: float, cut: float) -> PassResult:
        """Steady state with host-limited composites, the same rule as ``species.to_species``.

        Where a size class of the mill product holds less host gangue than the declared composites
        would lock (a valuable-rich feed), the composites are scaled down to the host available and the
        balance of the valuable reports as liberated grains. The scale is a fixed point because the
        host flow depends on the composites; with enough host everywhere one pass is exact.
        """
        scale = np.ones(self.g.n)
        tolerance = float(constant("numerics.composite_scale_tolerance"))
        for _ in range(int(constant("numerics.composite_scale_max_iterations"))):
            result, demand = self._pass(energy_per_pass, cut, scale)
            host = result.product[self.ore.host]
            limited = np.ones(self.g.n)
            short = demand > host
            limited[short] = np.maximum(host[short], 0.0) / demand[short]
            if float(np.max(np.abs(limited - scale))) <= tolerance:
                self.composite_scale = limited
                return result
            scale = limited
        self.flags.add("composite_scale_not_converged",
                       "Host-limited composites did not converge in the grinding circuit; the last pass is reported.")
        self.composite_scale = scale
        return result

    def species_underflow(self, cut: float, defs: list[SpeciesDef]) -> dict[str, np.ndarray]:
        """Underflow fraction (with bypass) of every particle class at the given host cut."""
        rf, sharp = self.bypass, self.plant.cyclone.sharpness
        out: dict[str, np.ndarray] = {}
        for d in defs:
            y = reduced_partition(corrected_cut(cut, self.rho_host, d.density), sharp)
            out[d.id] = rf + (1.0 - rf) * y
        return out

    def solve_cut(self, energy_per_pass: float) -> float:
        target = self.op.circulating_load
        lo, hi = (math.log(float(v)) for v in constant("grinding.cut_bracket_um"))

        def f(x: float) -> float:
            load = self.run(energy_per_pass, math.exp(x)).circulating_load
            return math.log(load) - math.log(target) if load > 0.0 else -math.inf

        x = solve_decreasing(f, self._cut_guess, math.log(float(constant("numerics.cut_search_step_ratio"))), lo, hi)
        self._cut_guess = x
        return math.exp(x)

    def overflow_p80(self, energy_per_pass: float) -> float:
        cut = self.solve_cut(energy_per_pass)
        result = self.run(energy_per_pass, cut)
        total = np.zeros(self.g.n)
        for mass in result.overflow.values():
            total += mass
        return self.g.p80(total)

    def solve(self) -> GrindingResult:
        op, plant, g = self.op, self.plant, self.g
        feed_total = np.zeros(g.n)
        for mass in self.feed.values():
            feed_total += mass
        f80 = g.p80(feed_total)
        lo, hi = (math.log(float(v)) for v in constant("grinding.energy_bracket_kwh_t"))
        guess = max(bond_energy(op.work_index_kwh_t, f80, op.target_p80_um), float(constant("numerics.energy_guess_floor_kwh_t"))) / (1.0 + op.circulating_load)

        def f(x: float) -> float:
            return math.log(self.overflow_p80(math.exp(x))) - math.log(op.target_p80_um)

        try:
            energy = math.exp(solve_decreasing(f, math.log(guess), math.log(2.0), lo, hi))
        except RootError:
            self.flags.add("target_unreachable", "The target P80 cannot be reached at the design circulating load within the energy search range.")
            energy = math.exp(hi) if f(hi) > 0.0 else math.exp(lo)
        required = energy * (1.0 + op.circulating_load) * self.new_feed_tph
        limited = required > plant.mill.installed_power_kw
        if limited:
            energy = plant.mill.installed_power_kw / ((1.0 + op.circulating_load) * self.new_feed_tph)
            self.flags.add("power_limited", "Required mill power exceeds the installed power; the circuit runs at installed power with a coarser product.")
        try:
            cut = self.solve_cut(energy)
        except RootError:
            self.flags.add("circulating_load_unreachable", "The design circulating load cannot be held at this energy; the cut is at its search limit.")
            cut = float(constant("grinding.cut_bracket_um")[1])
        result = self.run(energy, cut)
        return self._report(energy, cut, result, f80, required, limited)

    def _report(self, energy: float, cut: float, r: PassResult, f80: float, required: float, limited: bool) -> GrindingResult:
        ore, op, plant, g = self.ore, self.op, self.plant, self.g
        water_density = float(constant("water.density_t_m3"))
        mill_solids = float(sum(float(np.sum(p)) for p in r.product.values()))
        smd = plant.mill.discharge_solids
        water_mill_discharge = mill_solids * (1.0 - smd) / smd
        water_cyclone_feed = self.water_over + self.water_under
        mill_addition = water_mill_discharge - self.water_under
        sump_addition = water_cyclone_feed - water_mill_discharge
        if mill_addition < 0.0:
            self.flags.add("mill_water_negative", "The recycled underflow carries more water than the declared mill discharge density allows.")
        if sump_addition < 0.0:
            self.flags.add("sump_water_negative", "The declared mill discharge is wetter than the cyclone feed; no sump dilution is possible.")
        recycle = {m: r.underflow[m] - r.gravity[m] for m in ore.ids}
        streams = {
            "new_feed": Stream({m: self.feed[m].copy() for m in ore.ids}, 0.0),
            "mill_feed": Stream({m: self.feed[m] + recycle[m] for m in ore.ids}, water_mill_discharge),
            "mill_discharge": Stream({m: r.product[m].copy() for m in ore.ids}, water_mill_discharge),
            "cyclone_feed": Stream({m: r.product[m].copy() for m in ore.ids}, water_cyclone_feed),
            "cyclone_underflow": Stream({m: r.underflow[m].copy() for m in ore.ids}, self.water_under),
            "cyclone_overflow": Stream({m: r.overflow[m].copy() for m in ore.ids}, self.water_over),
            "recycle": Stream(recycle, self.water_under),
        }
        if self.bleed > 0.0:
            streams["gravity_feed"] = Stream({m: self.bleed * r.underflow[m] for m in ore.ids}, self.bleed * self.water_under)
            streams["gravity_concentrate"] = Stream({m: r.gravity[m].copy() for m in ore.ids}, 0.0)
        total_over = np.zeros(g.n)
        for mass in r.overflow.values():
            total_over += mass
        solids_volume = sum(float(np.sum(r.product[m])) / ore.density[m] for m in ore.ids)
        rho_mean = mill_solids / solids_volume
        sizing = size_cluster(plant.cyclone, corrected_cut(cut, self.rho_host, rho_mean), solids_volume,
                              water_cyclone_feed / water_density, mill_solids, water_cyclone_feed)
        if not sizing.in_pressure_window:
            self.flags.add("cyclone_pressure", f"Plitt pressure {sizing.pressure_kpa:.0f} kPa lies outside the declared operating window.")
        sharp = plant.cyclone.sharpness
        partition = {"host": list(self.bypass + (1.0 - self.bypass) * reduced_partition(cut, sharp))}
        for m in ore.valuable:
            partition[m] = list(self.bypass + (1.0 - self.bypass) * reduced_partition(corrected_cut(cut, self.rho_host, ore.density[m]), sharp))
        gold = [m for m in ore.valuable if ore.spec[m].gravity]
        gold_cl = None
        if gold:
            feed_gold = sum(float(np.sum(self.feed[m])) for m in gold)
            gold_cl = sum(float(np.sum(r.underflow[m])) for m in gold) / feed_gold if feed_gold > 0.0 else 0.0
        defs = species_defs(ore)
        product_species = to_species(Stream(r.product, 0.0), ore, defs, self.flags)
        _, overflow_species = partition_species(product_species, self.species_underflow(cut, defs))
        rebuilt = to_minerals(overflow_species, defs, ore)
        scale = max(float(np.max(np.abs(r.overflow[m]))) for m in ore.ids)
        consistency = max(float(np.max(np.abs(rebuilt[m] - r.overflow[m]))) for m in ore.ids) / scale
        specific = energy * (1.0 + op.circulating_load)
        return GrindingResult(
            energy_per_pass_kwh_t=energy, specific_energy_kwh_t=specific, power_kw=specific * self.new_feed_tph,
            required_power_kw=required, power_limited=limited, cut_um=cut, bypass=self.bypass,
            circulating_load=r.circulating_load, target_p80_um=op.target_p80_um, p80_um=g.p80(total_over),
            feed_f80_um=f80, streams=streams, partition=partition, sizing=sizing,
            water={"overflow_tph": self.water_over, "underflow_tph": self.water_under, "mill_discharge_tph": water_mill_discharge,
                   "mill_addition_tph": mill_addition, "sump_addition_tph": sump_addition},
            gold_circulating_load=gold_cl, defs=defs, overflow_species=overflow_species, species_consistency=consistency,
            composite_scale=self.composite_scale.copy(),
        )
