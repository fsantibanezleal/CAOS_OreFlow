/**
 * Assemble each family's flowsheet and report streams, metrics, curves, flags and the audit (port of
 * engine/circuit.py). Families: rougher, gravity_rougher, magnetic and deslime_rougher.
 */
import { audit, nonnegative, type Unit } from './balance';
import { crush } from './comminution';
import { constant } from './constants';
import { energyReport } from './energy';
import { bankProfile, finalStreamName, runFlotation, type FlotationResult } from './flotation';
import { grid, type Vec } from './grid';
import { GrindingCircuit, type GrindingResult } from './grinding';
import { solve } from './linalg';
import { Flags, type Flag, type OperatingPoint, type Ore, type Plant } from './model';
import { fractionToGrade, resolve, type ResolvedOre } from './ore';
import { runDeslime, runMagnetic, type DeslimeResult, type MagneticResult } from './separation';
import { speciesContentOf } from './species';
import { add, Stream } from './streams';

export type TopologyUnit = { unit: string; inputs: string[]; outputs: string[]; water_added_tph: number };

export type CircuitResult = {
  ore: ResolvedOre;
  streams: Record<string, Stream>;
  concentrates: string[];
  tails: string[];
  metrics: Record<string, number>;
  metric_units: Record<string, string>;
  curves: Record<string, unknown>;
  flags: Flag[];
  balance: { units: Record<string, number>; max_relative_error: number };
  topology: TopologyUnit[];
  grinding: GrindingResult;
  flotation: FlotationResult | null;
  magnetic: MagneticResult | null;
  deslime: DeslimeResult | null;
};

const vsum = (v: Vec) => { let s = 0.0; for (let i = 0; i < v.length; i += 1) s += v[i]; return s; };

export function simulate(ore: Ore, plant: Plant, op: OperatingPoint): CircuitResult {
  const flags = new Flags();
  const r = resolve(ore, op);
  const g = grid();
  const shape = g.rosinRammler(plant.crusher.feed_f80_um, plant.crusher.feed_slope);
  const feedSolids: Record<string, Vec> = {};
  for (const m of r.ids) {
    const v = new Float64Array(g.n);
    for (let i = 0; i < g.n; i += 1) v[i] = op.throughput_tph * r.fraction[m] * shape[i];
    feedSolids[m] = v;
  }
  const crusherFeed = new Stream(feedSolids, 0.0);
  const cssUm = op.crusher_css_mm * constant('units.um_per_mm');
  const newFeed: Record<string, Vec> = {};
  for (const m of r.ids) newFeed[m] = crush(crusherFeed.solids[m], cssUm, plant.crusher);
  const circuit = new GrindingCircuit(r, plant, op, newFeed, flags);
  const grinding = circuit.solve();
  const streams: Record<string, Stream> = { crusher_feed: crusherFeed, ...grinding.streams };
  let flotation: FlotationResult | null = null;
  let magnetic: MagneticResult | null = null;
  let deslime: DeslimeResult | null = null;
  const concentrates: string[] = [];
  const tails: string[] = [];
  const overflow = streams.cyclone_overflow;
  let freshWater = grinding.water.mill_addition_tph + grinding.water.sump_addition_tph;
  const units: Array<[string, string[], string[], number]> = [
    ['crusher', ['crusher_feed'], ['new_feed'], 0.0],
    ['mill_feed_junction', ['new_feed', 'recycle'], ['mill_feed'], grinding.water.mill_addition_tph],
    ['mill', ['mill_feed'], ['mill_discharge'], 0.0],
    ['sump', ['mill_discharge'], ['cyclone_feed'], grinding.water.sump_addition_tph],
    ['cyclone', ['cyclone_feed'], ['cyclone_underflow', 'cyclone_overflow'], 0.0],
  ];
  if ('gravity_concentrate' in streams) {
    units.push(['gravity_split', ['cyclone_underflow'], ['recycle', 'gravity_concentrate'], 0.0]);
    concentrates.push('gravity_concentrate');
  } else {
    units.push(['underflow_return', ['cyclone_underflow'], ['recycle'], 0.0]);
  }
  if (plant.family === 'magnetic') {
    magnetic = runMagnetic(grinding.overflow_species, overflow.water, r, plant.magnetic as NonNullable<Plant['magnetic']>);
    Object.assign(streams, magnetic.streams);
    units.push(['lims_link', ['cyclone_overflow'], ['lims_feed'], 0.0]);
    units.push(['lims_rougher', ['lims_feed'], ['lims_rougher_concentrate', 'lims_rougher_tail'], 0.0]);
    units.push(['lims_cleaner', ['lims_rougher_concentrate'], ['lims_cleaner_concentrate', 'lims_cleaner_tail'], 0.0]);
    concentrates.push('lims_cleaner_concentrate');
    tails.push('lims_rougher_tail', 'lims_cleaner_tail');
  } else {
    let separationFeed = 'cyclone_overflow';
    let separationSpecies = grinding.overflow_species;
    let separationWater = overflow.water;
    if (plant.family === 'deslime_rougher') {
      deslime = runDeslime(grinding.overflow_species, overflow.water, r, plant.deslime as NonNullable<Plant['deslime']>, op.deslime_cut_um);
      streams.deslime_underflow = deslime.underflow;
      streams.slimes = deslime.slimes;
      units.push(['deslime', ['cyclone_overflow'], ['deslime_underflow', 'slimes'], 0.0]);
      separationFeed = 'deslime_underflow';
      separationSpecies = deslime.underflow_species;
      separationWater = deslime.underflow_water;
      tails.push('slimes');
    }
    const flot = plant.flotation as NonNullable<Plant['flotation']>;
    const energy = flot.regrind_energy_kwh_t;
    const regrind = energy > 0.0
      ? (minerals: Record<string, Vec>) => {
        const out: Record<string, Vec> = {};
        for (const m of r.ids) out[m] = solve(circuit.operators[m].inverse(energy), minerals[m]);
        return out;
      }
      : null;
    flotation = runFlotation(separationSpecies, separationWater, r, flot, op, flags, regrind);
    Object.assign(streams, flotation.streams);
    freshWater += flotation.dilution_water_tph;
    const cleanerInputs = [regrind !== null ? 'regrind_product' : 'rougher_concentrate'];
    if (flotation.recleaner !== null) cleanerInputs.push('recleaner_tail');
    units.push(['flotation_link', [separationFeed], ['flotation_feed'], flotation.dilution_rougher_tph]);
    units.push(['rougher_junction', ['flotation_feed', 'cleaner_tail'], ['rougher_feed'], 0.0]);
    units.push(['rougher', ['rougher_feed'], ['rougher_concentrate', 'rougher_tail'], 0.0]);
    units.push(['cleaner_junction', cleanerInputs, ['cleaner_feed'], flotation.dilution_cleaner_tph]);
    units.push(['cleaner', ['cleaner_feed'], ['cleaner_concentrate', 'cleaner_tail'], 0.0]);
    if (regrind !== null) units.push(['regrind', ['rougher_concentrate'], ['regrind_product'], 0.0]);
    if (flotation.recleaner !== null) {
      units.push(['recleaner_dilution', ['cleaner_concentrate'], ['recleaner_feed'], flotation.dilution_recleaner_tph]);
      units.push(['recleaner', ['recleaner_feed'], ['recleaner_concentrate', 'recleaner_tail'], 0.0]);
    }
    concentrates.push(finalStreamName(flotation));
    tails.push('rougher_tail');
  }
  const topology: TopologyUnit[] = units.map(([unit, inputs, outputs, water]) => ({ unit, inputs: [...inputs], outputs: [...outputs], water_added_tph: water }));
  units.push(['circuit', ['crusher_feed'], [...concentrates, ...tails], freshWater]);
  const auditUnits: Unit[] = units.map(([name, inputs, outputs, water]) => [name, inputs.map(s => streams[s]), outputs.map(s => streams[s]), water]);
  const balance = audit(auditUnits, r);
  const negative = nonnegative(streams, constant('numerics.negative_mass_tolerance_per_tph') * Math.max(1.0, op.throughput_tph));
  if (negative.length) flags.add('negative_mass', `Negative class masses in: ${negative.join(', ')}.`);
  streams.final_concentrate = add(...concentrates.map(s => streams[s]));
  streams.final_tail = add(...tails.map(s => streams[s]));
  const [metrics, metricUnits] = computeMetrics(r, plant, op, streams, grinding, flotation, magnetic, deslime, freshWater, balance);
  const curves = computeCurves(r, op, streams, grinding, flotation, magnetic, deslime);
  return { ore: r, streams, concentrates, tails, metrics, metric_units: metricUnits, curves, flags: flags.items, balance, topology,
    grinding, flotation, magnetic, deslime };
}

function grade(stream: Stream, r: ResolvedOre, species: string): number {
  return fractionToGrade(stream.grade(species, r.composition), r.units[species]);
}

function computeMetrics(r: ResolvedOre, plant: Plant, op: OperatingPoint, streams: Record<string, Stream>, grinding: GrindingResult,
  flotation: FlotationResult | null, magnetic: MagneticResult | null, deslime: DeslimeResult | null, freshWater: number,
  balance: { max_relative_error: number }): [Record<string, number>, Record<string, string>] {
  const comp = r.composition;
  const feed = streams.crusher_feed;
  const conc = streams.final_concentrate;
  const tail = streams.final_tail;
  const primary = r.primary;
  const m: Record<string, number> = {};
  const u: Record<string, string> = {};
  const put = (key: string, value: number, unit: string) => { m[key] = value; u[key] = unit; };
  const feedPrimary = feed.speciesTph(primary, comp);
  put('throughput_tph', op.throughput_tph, 't/h');
  put('head_grade', fractionToGrade(feed.grade(primary, comp), r.units[primary]), r.units[primary]);
  put('recovery_pct', 100.0 * conc.speciesTph(primary, comp) / feedPrimary, '%');
  put('concentrate_grade', grade(conc, r, primary), r.units[primary]);
  put('tail_grade', grade(tail, r, primary), r.units[primary]);
  put('concentrate_tph', conc.tph(), 't/h');
  put('mass_pull_pct', 100.0 * conc.tph() / feed.tph(), '%');
  put('recovered_primary_tph', conc.speciesTph(primary, comp), 't/h');
  for (const species of r.species) {
    put(`concentrate_${species}`, grade(conc, r, species), r.units[species]);
    put(`head_${species}`, grade(feed, r, species), r.units[species]);
  }
  for (const species of r.payables) {
    const total = feed.speciesTph(species, comp);
    put(`recovery_${species}_pct`, total > 0.0 ? 100.0 * conc.speciesTph(species, comp) / total : 0.0, '%');
  }
  put('crusher_feed_f80_um', streams.crusher_feed.p80(), 'um');
  put('crusher_p80_um', grinding.feed_f80_um, 'um');
  put('target_p80_um', grinding.target_p80_um, 'um');
  put('p80_um', grinding.p80_um, 'um');
  put('circulating_load_pct', 100.0 * grinding.circulating_load, '%');
  put('cyclone_cut_um', grinding.cut_um, 'um');
  put('cyclone_bypass_pct', 100.0 * grinding.bypass, '%');
  if (grinding.sizing !== null) {
    put('cyclones_required', grinding.sizing.cyclones, '1');
    put('cyclone_pressure_kpa', grinding.sizing.pressure_kpa, 'kPa');
    put('plitt_cut_um', grinding.sizing.d50c_um, 'um');
    put('plitt_sharpness', grinding.sizing.sharpness, '1');
    put('cyclone_feed_solids_vol_pct', grinding.sizing.feed_solids_vol_pct, '%');
  }
  put('mill_power_kw', grinding.power_kw, 'kW');
  put('required_mill_power_kw', grinding.required_power_kw, 'kW');
  put('installed_mill_power_kw', plant.mill.installed_power_kw, 'kW');
  put('power_limited', grinding.power_limited ? 1.0 : 0.0, 'flag');
  const energy = energyReport(op.work_index_kwh_t, r.crushingWorkIndex, streams.crusher_feed.p80(), grinding.feed_f80_um,
    grinding.specific_energy_kwh_t, grinding.feed_f80_um, grinding.p80_um);
  for (const [key, value] of Object.entries(energy)) put(key, value, key === 'bond_efficiency_ratio' ? '1' : 'kWh/t');
  const waterDensity = constant('water.density_t_m3');
  put('water_use_m3_h', freshWater / waterDensity, 'm3/h');
  put('water_intensity_m3_t', freshWater / waterDensity / op.throughput_tph, 'm3/t');
  if (grinding.gold_circulating_load !== null) put('gold_circulating_load_pct', 100.0 * grinding.gold_circulating_load, '%');
  if ('gravity_concentrate' in streams) put('gravity_recovery_pct', 100.0 * streams.gravity_concentrate.speciesTph(primary, comp) / feedPrimary, '%');
  if (flotation !== null) {
    const f = flotation.streams;
    const finalName = finalStreamName(flotation);
    const flot = plant.flotation as NonNullable<Plant['flotation']>;
    put('flotation_recovery_pct', 100.0 * f[finalName].speciesTph(primary, comp) / f.flotation_feed.speciesTph(primary, comp), '%');
    const regrindEnergy = flot.regrind_energy_kwh_t;
    put('regrind_power_kw', regrindEnergy * flotation.regrind_feed_tph, 'kW');
    put('specific_energy_regrind_kwh_t', regrindEnergy * flotation.regrind_feed_tph / op.throughput_tph, 'kWh/t');
    if (flotation.recleaner !== null) {
      put('recleaner_recovery_pct', 100.0 * f.recleaner_concentrate.speciesTph(primary, comp) / f.recleaner_feed.speciesTph(primary, comp), '%');
    }
    m.specific_energy_total_kwh_t += m.specific_energy_regrind_kwh_t;
    put('rougher_recovery_pct', 100.0 * f.rougher_concentrate.speciesTph(primary, comp) / f.rougher_feed.speciesTph(primary, comp), '%');
    put('cleaner_recovery_pct', 100.0 * f.cleaner_concentrate.speciesTph(primary, comp) / f.cleaner_feed.speciesTph(primary, comp), '%');
    put('rougher_concentrate_grade', grade(f.rougher_concentrate, r, primary), r.units[primary]);
    put('rougher_mass_pull_pct', 100.0 * f.rougher_concentrate.tph() / f.flotation_feed.tph(), '%');
    put('rougher_residence_min', flotation.rougher.residence_min, 'min');
    put('cleaner_residence_min', flotation.cleaner.residence_min, 'min');
    put('rougher_water_recovery_pct', 100.0 * flotation.rougher.water_recovery, '%');
    put('cleaner_water_recovery_pct', 100.0 * flotation.cleaner.water_recovery, '%');
    put('bubble_surface_flux_s', flotation.sb_rougher, '1/s');
    put('cleaner_recycle_tph', f.cleaner_tail.tph(), 't/h');
    put('recycle_iterations', flotation.iterations, '1');
    const free = flotation.defs.filter(d => d.kind === 'free');
    const final = flotation.species_final;
    let gangueMass = 0.0;
    let entrained = 0.0;
    for (const d of free) {
      gangueMass += vsum(final[d.id]);
      const share = flotation.rougher.entrained_share[d.id];
      for (let i = 0; i < share.length; i += 1) entrained += final[d.id][i] * share[i];
    }
    put('entrained_gangue_share_pct', gangueMass > 0.0 ? 100.0 * entrained / gangueMass : 0.0, '%');
  }
  if (magnetic !== null) {
    const magneticIds = r.ids.filter(id => r.spec[id].magnetic);
    let feedMag = 0.0;
    let concMag = 0.0;
    for (const id of magneticIds) { feedMag += feed.mineralTph(id); concMag += conc.mineralTph(id); }
    put('magnetite_recovery_pct', feedMag > 0.0 ? 100.0 * concMag / feedMag : 0.0, '%');
  }
  if (deslime !== null) {
    put('slimes_mass_pct', 100.0 * streams.slimes.tph() / feed.tph(), '%');
    put('slimes_loss_pct', 100.0 * streams.slimes.speciesTph(primary, comp) / feedPrimary, '%');
  }
  put('balance_max_relative_error', balance.max_relative_error, '1');
  put('species_consistency_error', grinding.species_consistency, '1');
  return [m, u];
}

function computeCurves(r: ResolvedOre, op: OperatingPoint, streams: Record<string, Stream>, grinding: GrindingResult,
  flotation: FlotationResult | null, magnetic: MagneticResult | null, deslime: DeslimeResult | null): Record<string, unknown> {
  const g = grid();
  const psdNames = ['crusher_feed', 'new_feed', 'mill_discharge', 'cyclone_underflow', 'cyclone_overflow', 'final_concentrate', 'final_tail'];
  for (const extra of ['slimes', 'deslime_underflow', 'gravity_concentrate']) if (extra in streams) psdNames.push(extra);
  const psd: Record<string, number[]> = {};
  for (const name of psdNames) psd[name] = Array.from(g.passing(streams[name].total()));
  const liberation: Record<string, number[]> = {};
  for (const m of r.valuable) liberation[m] = Array.from(r.liberation[m]);
  const curves: Record<string, unknown> = {
    size_um: Array.from(g.size),
    upper_um: Array.from(g.upper),
    psd,
    partition: grinding.partition,
    liberation,
    composite_scale: Array.from(grinding.composite_scale),
  };
  const primary = r.primary;
  if (flotation !== null) {
    const x = flotation.rougher_feed_species;
    const value = new Float64Array(g.n);
    const recovered = new Float64Array(g.n);
    for (const d of flotation.defs) {
      const content = speciesContentOf(d, r, primary);
      for (let i = 0; i < g.n; i += 1) {
        value[i] += content * x[d.id][i];
        recovered[i] += content * x[d.id][i] * flotation.rougher.recovery[d.id][i];
      }
    }
    const host = `${r.host}:free`;
    // a class that holds almost none of the payable (the coarse tail past the cyclone) is empty, not 0%
    let total = 0.0;
    for (const b of value) total += b;
    const floor = constant('numerics.curve_class_share_floor') * total;
    curves.recovery_by_size = {
      primary: Array.from(value, (b, i) => (b > floor ? recovered[i] / b : null)),
      host_gangue: Array.from(flotation.rougher.recovery[host]),
      host_gangue_entrained_share: Array.from(flotation.rougher.entrained_share[host]),
    };
    curves.bank_profile = bankProfile(flotation, r, primary, op.rougher_cells);
  }
  if (magnetic !== null) {
    const capture: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(magnetic.capture_rougher)) capture[k] = Array.from(v);
    curves.capture = capture;
  }
  if (deslime !== null) {
    const partition: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(deslime.partition)) partition[k] = Array.from(v);
    curves.deslime_partition = partition;
  }
  return curves;
}
