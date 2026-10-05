"""Assemble each family's flowsheet and report streams, metrics, curves, flags and the audit.

Families: ``rougher`` (grinding, rougher and cleaner flotation), ``gravity_rougher`` (gravity bleed
in the grinding loop, then flotation), ``magnetic`` (grinding, LIMS rougher and cleaner) and
``deslime_rougher`` (grinding, desliming cyclone, then flotation).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .balance import audit, nonnegative, residual
from .comminution import crush
from .constants import constant
from .energy import energy_report
from .flotation import FlotationResult, bank_profile, final_stream_name, run_flotation
from .grid import grid
from .grinding import GrindingCircuit, GrindingResult
from .model import Flags, InfeasibleState, OperatingPoint, Ore, Plant
from .ore import ResolvedOre, fraction_to_grade, resolve
from .separation import DeslimeResult, MagneticResult, run_deslime, run_magnetic
from .species import species_content
from .streams import Stream, add


@dataclass
class CircuitResult:
    ore: ResolvedOre
    streams: dict[str, Stream]
    concentrates: list[str]
    tails: list[str]
    metrics: dict[str, float]
    metric_units: dict[str, str]
    curves: dict[str, object]
    flags: list[dict[str, str]]
    balance: dict[str, object]
    topology: list[dict[str, object]]
    grinding: GrindingResult
    flotation: FlotationResult | None
    magnetic: MagneticResult | None
    deslime: DeslimeResult | None


def simulate(ore: Ore, plant: Plant, op: OperatingPoint) -> CircuitResult:
    flags = Flags()
    r = resolve(ore, op)
    g = grid()
    shape = g.rosin_rammler(plant.crusher.feed_f80_um, plant.crusher.feed_slope)
    # gravity-recoverable grains carry their own sizes, which the crusher passes unchanged (E-11)
    grains = {m: g.from_passing(s.grains.size_um, s.grains.passing, s.grains.lower_um) for m, s in r.spec.items() if s.grains is not None}
    crusher_feed = Stream({m: op.throughput_tph * r.fraction[m] * grains.get(m, shape) for m in r.ids}, 0.0)
    css_um = op.crusher_css_mm * float(constant("units.um_per_mm"))
    new_feed = {m: crusher_feed.solids[m].copy() if m in grains else crush(crusher_feed.solids[m], css_um, plant.crusher) for m in r.ids}
    circuit = GrindingCircuit(r, plant, op, new_feed, flags)
    grinding = circuit.solve()
    streams: dict[str, Stream] = {"crusher_feed": crusher_feed, **grinding.streams}
    flotation: FlotationResult | None = None
    magnetic: MagneticResult | None = None
    deslime: DeslimeResult | None = None
    concentrates: list[str] = []
    tails: list[str] = []
    regrind = None
    energy = 0.0
    overflow = streams["cyclone_overflow"]
    fresh_water = grinding.water["mill_addition_tph"] + grinding.water["sump_addition_tph"]
    # Units by stream name: (unit, input streams, output streams, fresh water added in t/h).
    at_discharge = "sump_feed" in streams
    units: list[tuple[str, list[str], list[str], float]] = [
        ("crusher", ["crusher_feed"], ["new_feed"], 0.0),
        ("mill_feed_junction", ["new_feed", "recycle"], ["mill_feed"], grinding.water["mill_addition_tph"]),
        ("mill", ["mill_feed"], ["mill_discharge"], 0.0),
        ("sump", ["sump_feed" if at_discharge else "mill_discharge"], ["cyclone_feed"], grinding.water["sump_addition_tph"]),
        ("cyclone", ["cyclone_feed"], ["cyclone_underflow", "cyclone_overflow"], 0.0),
    ]
    if at_discharge:
        # the unit treats a share of the mill discharge; its tails rejoin the cyclone feed
        units.insert(3, ("gravity_split", ["mill_discharge"], ["sump_feed", "gravity_concentrate"], 0.0))
        units.append(("underflow_return", ["cyclone_underflow"], ["recycle"], 0.0))
        concentrates.append("gravity_concentrate")
    elif "gravity_concentrate" in streams:
        units.append(("gravity_split", ["cyclone_underflow"], ["recycle", "gravity_concentrate"], 0.0))
        concentrates.append("gravity_concentrate")
    else:
        units.append(("underflow_return", ["cyclone_underflow"], ["recycle"], 0.0))
    if plant.family == "magnetic":
        magnetic = run_magnetic(grinding.overflow_species, overflow.water, r, plant.magnetic)
        streams.update(magnetic.streams)
        units += [
            ("lims_link", ["cyclone_overflow"], ["lims_feed"], 0.0),
            ("lims_rougher", ["lims_feed"], ["lims_rougher_concentrate", "lims_rougher_tail"], 0.0),
            ("lims_cleaner", ["lims_rougher_concentrate"], ["lims_cleaner_concentrate", "lims_cleaner_tail"], 0.0),
        ]
        concentrates.append("lims_cleaner_concentrate")
        tails += ["lims_rougher_tail", "lims_cleaner_tail"]
    else:
        separation_feed = "cyclone_overflow"
        separation_species, separation_water = grinding.overflow_species, overflow.water
        if plant.family == "deslime_rougher":
            factor = float(constant("deslime.max_cut_over_p80"))
            if op.d50c_um > 0.0 and op.deslime_cut_um > factor * grinding.p80_um:
                # the contract checks the desliming cut against the grind target, which the cut mode ignores: here the
                # product is a result, and a cut above half of it would discard the product (K-02)
                raise InfeasibleState("deslime_cut_above_half_p80", "deslime_cut_um", op.deslime_cut_um, factor * grinding.p80_um)
            deslime = run_deslime(grinding.overflow_species, overflow.water, r, plant.deslime, op.deslime_cut_um, flags)
            streams["deslime_underflow"] = deslime.underflow
            streams["slimes"] = deslime.slimes
            units.append(("deslime", ["cyclone_overflow"], ["deslime_underflow", "slimes"], 0.0))
            separation_feed = "deslime_underflow"
            separation_species, separation_water = deslime.underflow_species, deslime.underflow_water
            tails.append("slimes")
        energy = plant.flotation.regrind_energy_kwh_t
        regrind = None
        if energy > 0.0:
            def regrind(minerals: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
                return {m: np.linalg.solve(circuit.operators[m].inverse(energy), minerals[m]) for m in r.ids}
        flotation = run_flotation(separation_species, separation_water, r, plant.flotation, op, flags, regrind)
        streams.update(flotation.streams)
        fresh_water += flotation.dilution_water_tph
        cleaner_inputs = ["regrind_product" if regrind is not None else "rougher_concentrate"]
        if flotation.recleaner is not None:
            cleaner_inputs.append("recleaner_tail")
        # the cleaner tail returns to the rougher feed unless the ablation sends it to the final tail
        recirculate = plant.flotation.cleaner_tail_to_rougher
        units += [
            ("flotation_link", [separation_feed], ["flotation_feed"], flotation.dilution_rougher_tph),
            ("rougher_junction", ["flotation_feed", "cleaner_tail"] if recirculate else ["flotation_feed"], ["rougher_feed"], 0.0),
            ("rougher", ["rougher_feed"], ["rougher_concentrate", "rougher_tail"], 0.0),
            ("cleaner_junction", cleaner_inputs, ["cleaner_feed"], flotation.dilution_cleaner_tph),
            ("cleaner", ["cleaner_feed"], ["cleaner_concentrate", "cleaner_tail"], 0.0),
        ]
        if regrind is not None:
            units.append(("regrind", ["rougher_concentrate"], ["regrind_product"], 0.0))
        if flotation.recleaner is not None:
            units += [
                ("recleaner_dilution", ["cleaner_concentrate"], ["recleaner_feed"], flotation.dilution_recleaner_tph),
                ("recleaner", ["recleaner_feed"], ["recleaner_concentrate", "recleaner_tail"], 0.0),
            ]
        concentrates.append(final_stream_name(flotation))
        tails.append("rougher_tail")
        if not recirculate:
            tails.append("cleaner_tail")
    topology: list[dict[str, object]] = [
        {"unit": name, "inputs": list(inputs), "outputs": list(outputs), "water_added_tph": float(water)}
        for name, inputs, outputs, water in units
    ]
    units.append(("circuit", ["crusher_feed"], concentrates + tails, fresh_water))
    # the breakage operators are audited by their own steady state, T^-1(e) p = m per class (K-01)
    e = grinding.energy_per_pass_kwh_t
    equations = {"mill_equation": max(residual(circuit.operators[m].inverse(e), streams["mill_discharge"].solids[m],
                                               streams["mill_feed"].solids[m]) for m in r.ids)}
    if regrind is not None:
        equations["regrind_equation"] = max(residual(circuit.operators[m].inverse(energy), streams["regrind_product"].solids[m],
                                                     streams["rougher_concentrate"].solids[m]) for m in r.ids)
    balance = audit([(name, [streams[n] for n in inputs], [streams[n] for n in outputs], water)
                     for name, inputs, outputs, water in units], r, equations)
    if balance["max_relative_error"] > float(constant("numerics.balance_tolerance")):
        worst = max(balance["units"], key=balance["units"].get)
        flags.add("balance_not_closed", f"The audit does not close: {worst} errs by {balance['max_relative_error']:.1e}.")
    negative = nonnegative(streams, float(constant("numerics.negative_mass_tolerance")))
    if negative:
        flags.add("negative_mass", f"Negative class masses in: {', '.join(negative)}.")
    streams["final_concentrate"] = add(*[streams[n] for n in concentrates])
    streams["final_tail"] = add(*[streams[n] for n in tails])
    metrics, metric_units = _metrics(r, plant, op, streams, grinding, flotation, magnetic, deslime, concentrates, fresh_water, balance)
    if grinding.p80_um < float(constant("bond.efficiency_min_product_um")):
        flags.add("bond_efficiency_fine_product", "The product is finer than about 70 um, below which the guideline qualifies the "
                                                  "Bond efficiency; the ratio is reported without the fineness correction.")
    curves = _curves(r, op, streams, grinding, flotation, magnetic, deslime)
    return CircuitResult(r, streams, concentrates, tails, metrics, metric_units, curves, flags.items, balance, topology,
                         grinding, flotation, magnetic, deslime)


def _grade(stream: Stream, r: ResolvedOre, species: str) -> float:
    return fraction_to_grade(stream.grade(species, r.composition), r.units[species])


def _metrics(r: ResolvedOre, plant: Plant, op: OperatingPoint, streams: dict[str, Stream], grinding: GrindingResult,
             flotation: FlotationResult | None, magnetic: MagneticResult | None, deslime: DeslimeResult | None,
             concentrates: list[str], fresh_water: float, balance: dict[str, object]) -> tuple[dict[str, float], dict[str, str]]:
    comp = r.composition
    feed = streams["crusher_feed"]
    conc = streams["final_concentrate"]
    tail = streams["final_tail"]
    primary = r.primary
    m: dict[str, float] = {}
    u: dict[str, str] = {}

    def put(key: str, value: float, unit: str) -> None:
        m[key] = float(value)
        u[key] = unit

    feed_primary = feed.species_tph(primary, comp)
    put("throughput_tph", op.throughput_tph, "t/h")
    put("head_grade", fraction_to_grade(feed.grade(primary, comp), r.units[primary]), r.units[primary])
    put("recovery_pct", 100.0 * conc.species_tph(primary, comp) / feed_primary, "%")
    put("concentrate_grade", _grade(conc, r, primary), r.units[primary])
    put("tail_grade", _grade(tail, r, primary), r.units[primary])
    put("concentrate_tph", conc.tph(), "t/h")
    put("mass_pull_pct", 100.0 * conc.tph() / feed.tph(), "%")
    put("recovered_primary_tph", conc.species_tph(primary, comp), "t/h")
    for species in r.species:
        put(f"concentrate_{species}", _grade(conc, r, species), r.units[species])
        put(f"head_{species}", _grade(feed, r, species), r.units[species])
    for species in r.payables:
        total = feed.species_tph(species, comp)
        put(f"recovery_{species}_pct", 100.0 * conc.species_tph(species, comp) / total if total > 0.0 else 0.0, "%")
    put("crusher_feed_f80_um", streams["crusher_feed"].p80(), "um")
    put("crusher_p80_um", grinding.feed_f80_um, "um")
    put("target_p80_um", grinding.target_p80_um, "um")
    put("p80_um", grinding.p80_um, "um")
    put("circulating_load_pct", 100.0 * grinding.circulating_load, "%")
    put("cyclone_cut_um", grinding.cut_um, "um")
    put("cyclone_bypass_pct", 100.0 * grinding.bypass, "%")
    if grinding.sizing is not None:
        put("cyclones_required", grinding.sizing.cyclones, "1")
        put("cyclone_pressure_kpa", grinding.sizing.pressure_kpa, "kPa")
        put("plitt_cut_um", grinding.sizing.d50c_um, "um")
        put("plitt_sharpness", grinding.sizing.sharpness, "1")
        put("cyclone_feed_solids_vol_pct", grinding.sizing.feed_solids_vol_pct, "%")
    put("mill_power_kw", grinding.power_kw, "kW")
    put("required_mill_power_kw", grinding.required_power_kw, "kW")
    put("installed_mill_power_kw", plant.mill.installed_power_kw, "kW")
    put("power_limited", 1.0 if grinding.power_limited else 0.0, "flag")
    put("cut_mode", 1.0 if grinding.cut_mode else 0.0, "flag")
    energy = energy_report(op.work_index_kwh_t, r.crushing_work_index, streams["crusher_feed"].p80(), grinding.feed_f80_um,
                           grinding.specific_energy_kwh_t, grinding.feed_f80_um, grinding.p80_um)
    for key, value in energy.items():
        put(key, value, "1" if key == "bond_efficiency_ratio" else "kWh/t")
    put("water_use_m3_h", fresh_water / float(constant("water.density_t_m3")), "m3/h")
    put("water_intensity_m3_t", fresh_water / float(constant("water.density_t_m3")) / op.throughput_tph, "m3/t")
    if grinding.gold_circulating_load is not None:
        put("gold_circulating_load_pct", 100.0 * grinding.gold_circulating_load, "%")
    if "gravity_concentrate" in streams:
        put("gravity_recovery_pct", 100.0 * streams["gravity_concentrate"].species_tph(primary, comp) / feed_primary, "%")
        grg = [m for m in r.ids if r.spec[m].grains is not None]
        grg_feed = sum(streams["new_feed"].mineral_tph(m) for m in grg)
        if grg_feed > 0.0:
            # the share of the gravity-recoverable gold the unit recovers, Laplante's "GRG recovery" (E-11)
            put("grg_recovery_pct", 100.0 * sum(streams["gravity_concentrate"].mineral_tph(m) for m in grg) / grg_feed, "%")
    if flotation is not None:
        f = flotation.streams
        final_name = final_stream_name(flotation)
        put("flotation_recovery_pct", 100.0 * f[final_name].species_tph(primary, comp) / f["flotation_feed"].species_tph(primary, comp), "%")
        regrind_energy = plant.flotation.regrind_energy_kwh_t
        put("regrind_power_kw", regrind_energy * flotation.regrind_feed_tph, "kW")
        put("specific_energy_regrind_kwh_t", regrind_energy * flotation.regrind_feed_tph / op.throughput_tph, "kWh/t")
        if flotation.recleaner is not None:
            put("recleaner_recovery_pct", 100.0 * f["recleaner_concentrate"].species_tph(primary, comp) / f["recleaner_feed"].species_tph(primary, comp), "%")
        m["specific_energy_total_kwh_t"] += m["specific_energy_regrind_kwh_t"]
        put("rougher_recovery_pct", 100.0 * f["rougher_concentrate"].species_tph(primary, comp) / f["rougher_feed"].species_tph(primary, comp), "%")
        put("cleaner_recovery_pct", 100.0 * f["cleaner_concentrate"].species_tph(primary, comp) / f["cleaner_feed"].species_tph(primary, comp), "%")
        put("rougher_concentrate_grade", _grade(f["rougher_concentrate"], r, primary), r.units[primary])
        # on the rougher's own feed, the basis of its recovery (F-05, K-09)
        put("rougher_mass_pull_pct", 100.0 * f["rougher_concentrate"].tph() / f["rougher_feed"].tph(), "%")
        put("rougher_residence_min", flotation.rougher.residence_min, "min")
        put("cleaner_residence_min", flotation.cleaner.residence_min, "min")
        put("rougher_water_recovery_pct", 100.0 * flotation.rougher.water_recovery, "%")
        put("cleaner_water_recovery_pct", 100.0 * flotation.cleaner.water_recovery, "%")
        put("bubble_surface_flux_s", flotation.sb_rougher, "1/s")
        put("cleaner_recycle_tph", f["cleaner_tail"].tph() if plant.flotation.cleaner_tail_to_rougher else 0.0, "t/h")
        put("recycle_iterations", flotation.iterations, "1")
        # the share of the rougher concentrate's free gangue that the rougher recovered by entrainment, exact from the
        # bank's own split (F-04, K-08); 0.08.001 weighted the final concentrate by the rougher's share, which mixed
        # stages and, after a regrind, size classes
        free = [d for d in flotation.defs if d.kind == "free"]
        x, rougher = flotation.rougher_feed_species, flotation.rougher
        gangue_mass = sum(float(np.sum(x[d.id] * rougher.recovery[d.id])) for d in free)
        entrained = sum(float(np.sum(x[d.id] * rougher.recovery[d.id] * rougher.entrained_share[d.id])) for d in free)
        put("entrained_gangue_share_pct", 100.0 * entrained / gangue_mass if gangue_mass > 0.0 else 0.0, "%")
    if magnetic is not None:
        magnetic_ids = [mid for mid in r.ids if r.spec[mid].magnetic]
        feed_mag = sum(feed.mineral_tph(mid) for mid in magnetic_ids)
        put("magnetite_recovery_pct", 100.0 * sum(conc.mineral_tph(mid) for mid in magnetic_ids) / feed_mag if feed_mag > 0.0 else 0.0, "%")
    if deslime is not None:
        put("slimes_mass_pct", 100.0 * streams["slimes"].tph() / feed.tph(), "%")
        put("slimes_loss_pct", 100.0 * streams["slimes"].species_tph(primary, comp) / feed_primary, "%")
    put("balance_max_relative_error", float(balance["max_relative_error"]), "1")
    put("species_consistency_error", grinding.species_consistency, "1")
    return m, u


def _curves(r: ResolvedOre, op: OperatingPoint, streams: dict[str, Stream], grinding: GrindingResult,
            flotation: FlotationResult | None, magnetic: MagneticResult | None, deslime: DeslimeResult | None) -> dict[str, object]:
    g = grid()
    psd_names = ["crusher_feed", "new_feed", "mill_discharge", "cyclone_underflow", "cyclone_overflow", "final_concentrate", "final_tail"]
    for extra in ("slimes", "deslime_underflow", "gravity_concentrate"):
        if extra in streams:
            psd_names.append(extra)
    curves: dict[str, object] = {
        "size_um": [float(v) for v in g.size],
        "upper_um": [float(v) for v in g.upper],
        "psd": {name: [float(v) for v in g.passing(streams[name].total())] for name in psd_names},
        "partition": grinding.partition,
        "liberation": {m: [float(v) for v in r.liberation[m]] for m in r.valuable},
        "composite_scale": [float(v) for v in grinding.composite_scale],
    }
    primary = r.primary
    if flotation is not None:
        x = flotation.rougher_feed_species
        defs = flotation.defs
        content = {d.id: species_content(d, r, primary) for d in defs}
        value = np.zeros(g.n)
        recovered = np.zeros(g.n)
        for d in defs:
            value += content[d.id] * x[d.id]
            recovered += content[d.id] * x[d.id] * flotation.rougher.recovery[d.id]
        host = f"{r.host}:free"
        # a class that holds almost none of the payable (the coarse tail past the cyclone) is empty, not 0%
        floor = float(constant("numerics.curve_class_share_floor")) * float(value.sum())
        curves["recovery_by_size"] = {
            "primary": [float(a / b) if b > floor else None for a, b in zip(recovered, value)],
            "host_gangue": [float(v) for v in flotation.rougher.recovery[host]],
            "host_gangue_entrained_share": [float(v) for v in flotation.rougher.entrained_share[host]],
        }
        curves["bank_profile"] = bank_profile(flotation, r, primary)
    if magnetic is not None:
        curves["capture"] = {k: [float(v) for v in arr] for k, arr in magnetic.capture_rougher.items()}
    if deslime is not None:
        curves["deslime_partition"] = {k: [float(v) for v in arr] for k, arr in deslime.partition.items()}
    return curves
