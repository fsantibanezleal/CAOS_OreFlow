"""Assemble each family's flowsheet and report streams, metrics, curves, flags and the audit.

Families: ``rougher`` (grinding, rougher and cleaner flotation), ``gravity_rougher`` (gravity bleed
in the grinding loop, then flotation), ``magnetic`` (grinding, LIMS rougher and cleaner) and
``deslime_rougher`` (grinding, desliming cyclone, then flotation).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .balance import audit, nonnegative
from .comminution import crush
from .constants import constant
from .energy import energy_report
from .flotation import FlotationResult, bank_profile, final_stream_name, run_flotation
from .grid import grid
from .grinding import GrindingCircuit, GrindingResult
from .model import Flags, OperatingPoint, Ore, Plant
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
    grinding: GrindingResult
    flotation: FlotationResult | None
    magnetic: MagneticResult | None
    deslime: DeslimeResult | None


def simulate(ore: Ore, plant: Plant, op: OperatingPoint) -> CircuitResult:
    flags = Flags()
    r = resolve(ore, op)
    g = grid()
    shape = g.rosin_rammler(plant.crusher.feed_f80_um, plant.crusher.feed_slope)
    crusher_feed = Stream({m: op.throughput_tph * r.fraction[m] * shape for m in r.ids}, 0.0)
    css_um = op.crusher_css_mm * float(constant("units.um_per_mm"))
    new_feed = {m: crush(crusher_feed.solids[m], css_um, plant.crusher) for m in r.ids}
    circuit = GrindingCircuit(r, plant, op, new_feed, flags)
    grinding = circuit.solve()
    streams: dict[str, Stream] = {"crusher_feed": crusher_feed, **grinding.streams}
    flotation: FlotationResult | None = None
    magnetic: MagneticResult | None = None
    deslime: DeslimeResult | None = None
    concentrates: list[str] = []
    tails: list[str] = []
    overflow = streams["cyclone_overflow"]
    fresh_water = grinding.water["mill_addition_tph"] + grinding.water["sump_addition_tph"]
    units: list[tuple[str, list[Stream], list[Stream], float]] = [
        ("crusher", [crusher_feed], [streams["new_feed"]], 0.0),
        ("mill_feed_junction", [streams["new_feed"], streams["recycle"]], [streams["mill_feed"]], grinding.water["mill_addition_tph"]),
        ("mill", [streams["mill_feed"]], [streams["mill_discharge"]], 0.0),
        ("sump", [streams["mill_discharge"]], [streams["cyclone_feed"]], grinding.water["sump_addition_tph"]),
        ("cyclone", [streams["cyclone_feed"]], [streams["cyclone_underflow"], streams["cyclone_overflow"]], 0.0),
    ]
    if "gravity_concentrate" in streams:
        units.append(("gravity_split", [streams["cyclone_underflow"]], [streams["recycle"], streams["gravity_concentrate"]], 0.0))
        concentrates.append("gravity_concentrate")
    else:
        units.append(("underflow_return", [streams["cyclone_underflow"]], [streams["recycle"]], 0.0))
    if plant.family == "magnetic":
        magnetic = run_magnetic(grinding.overflow_species, overflow.water, r, plant.magnetic)
        streams.update(magnetic.streams)
        units += [
            ("lims_link", [overflow], [streams["lims_feed"]], 0.0),
            ("lims_rougher", [streams["lims_feed"]], [streams["lims_rougher_concentrate"], streams["lims_rougher_tail"]], 0.0),
            ("lims_cleaner", [streams["lims_rougher_concentrate"]], [streams["lims_cleaner_concentrate"], streams["lims_cleaner_tail"]], 0.0),
        ]
        concentrates.append("lims_cleaner_concentrate")
        tails += ["lims_rougher_tail", "lims_cleaner_tail"]
    else:
        separation_feed = overflow
        separation_species, separation_water = grinding.overflow_species, overflow.water
        if plant.family == "deslime_rougher":
            deslime = run_deslime(grinding.overflow_species, overflow.water, r, plant.deslime, op.deslime_cut_um)
            streams["deslime_underflow"] = deslime.underflow
            streams["slimes"] = deslime.slimes
            units.append(("deslime", [overflow], [deslime.underflow, deslime.slimes], 0.0))
            separation_feed = deslime.underflow
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
        cleaner_inputs = [streams["regrind_product"] if regrind is not None else streams["rougher_concentrate"]]
        if flotation.recleaner is not None:
            cleaner_inputs.append(streams["recleaner_tail"])
        units += [
            ("flotation_link", [separation_feed], [streams["flotation_feed"]], flotation.dilution_rougher_tph),
            ("rougher_junction", [streams["flotation_feed"], streams["cleaner_tail"]], [streams["rougher_feed"]], 0.0),
            ("rougher", [streams["rougher_feed"]], [streams["rougher_concentrate"], streams["rougher_tail"]], 0.0),
            ("cleaner_junction", cleaner_inputs, [streams["cleaner_feed"]], flotation.dilution_cleaner_tph),
            ("cleaner", [streams["cleaner_feed"]], [streams["cleaner_concentrate"], streams["cleaner_tail"]], 0.0),
        ]
        if regrind is not None:
            units.append(("regrind", [streams["rougher_concentrate"]], [streams["regrind_product"]], 0.0))
        if flotation.recleaner is not None:
            units += [
                ("recleaner_dilution", [streams["cleaner_concentrate"]], [streams["recleaner_feed"]], flotation.dilution_recleaner_tph),
                ("recleaner", [streams["recleaner_feed"]], [streams["recleaner_concentrate"], streams["recleaner_tail"]], 0.0),
            ]
        concentrates.append(final_stream_name(flotation))
        tails.append("rougher_tail")
    products = [streams[n] for n in concentrates + tails]
    units.append(("circuit", [crusher_feed], products, fresh_water))
    balance = audit(units, r)
    negative = nonnegative(streams, float(constant("numerics.negative_mass_tolerance_per_tph")) * max(1.0, op.throughput_tph))
    if negative:
        flags.add("negative_mass", f"Negative class masses in: {', '.join(negative)}.")
    streams["final_concentrate"] = add(*[streams[n] for n in concentrates])
    streams["final_tail"] = add(*[streams[n] for n in tails])
    metrics, metric_units = _metrics(r, plant, op, streams, grinding, flotation, magnetic, deslime, concentrates, fresh_water, balance)
    curves = _curves(r, op, streams, grinding, flotation, magnetic, deslime)
    return CircuitResult(r, streams, concentrates, tails, metrics, metric_units, curves, flags.items, balance,
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
        put("rougher_mass_pull_pct", 100.0 * f["rougher_concentrate"].tph() / f["flotation_feed"].tph(), "%")
        put("rougher_residence_min", flotation.rougher.residence_min, "min")
        put("cleaner_residence_min", flotation.cleaner.residence_min, "min")
        put("rougher_water_recovery_pct", 100.0 * flotation.rougher.water_recovery, "%")
        put("cleaner_water_recovery_pct", 100.0 * flotation.cleaner.water_recovery, "%")
        put("bubble_surface_flux_s", flotation.sb_rougher, "1/s")
        put("cleaner_recycle_tph", f["cleaner_tail"].tph(), "t/h")
        put("recycle_iterations", flotation.iterations, "1")
        free = [d for d in flotation.defs if d.kind == "free"]
        final = flotation.species_final
        gangue_mass = sum(float(np.sum(final[d.id])) for d in free)
        entrained = sum(float(np.sum(final[d.id] * flotation.rougher.entrained_share[d.id])) for d in free)
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
        curves["recovery_by_size"] = {
            "primary": [float(a / b) if b > 0.0 else 0.0 for a, b in zip(recovered, value)],
            "host_gangue": [float(v) for v in flotation.rougher.recovery[host]],
            "host_gangue_entrained_share": [float(v) for v in flotation.rougher.entrained_share[host]],
        }
        curves["bank_profile"] = bank_profile(flotation, r, primary, op.rougher_cells)
    if magnetic is not None:
        curves["capture"] = {k: [float(v) for v in arr] for k, arr in magnetic.capture_rougher.items()}
    if deslime is not None:
        curves["deslime_partition"] = {k: [float(v) for v in arr] for k, arr in deslime.partition.items()}
    return curves
