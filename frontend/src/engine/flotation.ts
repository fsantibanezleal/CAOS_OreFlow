/**
 * Flotation circuit: rougher, optional regrind, cleaner and optional recleaner, with recycles (port of
 * engine/flotation.py; theory in docs/methodologies/05_flotation.md). Per perfectly mixed cell a class is
 * recovered with r = (k tau + ENT w)/(1 + k tau + ENT w), tau the cell's pulp volume over its own tail flow (F-02);
 * k = 60 P Sb f_size f_dose with Sb = 6 Jg/D32; ENT after Savassi et al. (1998). The recycle is a fixed point on an
 * absolute and a per-class relative change.
 */
import { constant } from './constants';
import { grid, type Vec } from './grid';
import type { Bank, Flags, FlotationPlant, OperatingPoint } from './model';
import type { ResolvedOre } from './ore';
import { speciesContentOf, speciesDefs, toMinerals, toSpecies, type Species, type SpeciesDef } from './species';
import { Stream } from './streams';

export function bubbleSurfaceFlux(jgCmS: number, plant: FlotationPlant): number {
  const d32 = plant.d32_base_mm + plant.d32_slope_mm_per_cm_s * jgCmS;
  return constant('flotation.sb_factor') * jgCmS / d32;
}

/** ENT = 2/(exp(z) + exp(-z)), z = 2.292 (d/xi)^adj, adj = 1 - ln(1/delta)/exp(d/xi), exponents capped. */
export function savassiEntrainment(xiUm: number, delta: number): Vec {
  const size = grid().size;
  const cap = Math.log(Number.MAX_VALUE) / 2.0;
  const out = new Float64Array(size.length);
  for (let i = 0; i < size.length; i += 1) {
    const ratio = size[i] / xiUm;
    const adj = 1.0 - Math.log(1.0 / delta) / Math.exp(Math.min(ratio, cap));
    const z = Math.min(constant('savassi.constant') * Math.pow(ratio, adj), cap);
    out[i] = 2.0 / (Math.exp(z) + Math.exp(-z));
  }
  return out;
}

export function sizeResponse(optimumUm: number, fineWidth: number, coarseWidth: number): Vec {
  const size = grid().size;
  const out = new Float64Array(size.length);
  for (let i = 0; i < size.length; i += 1) {
    const logRatio = Math.log(size[i] / optimumUm);
    const width = logRatio < 0.0 ? fineWidth : coarseWidth;
    out[i] = Math.exp(-0.5 * Math.pow(logRatio / width, 2));
  }
  return out;
}

export function doseResponse(doseGpt: number, halfDoseGpt: number, unresponsive: number): number {
  return unresponsive + (1.0 - unresponsive) * doseGpt / (doseGpt + halfDoseGpt);
}

/** True-flotation rate constant (1/min) of every particle class by size. */
export function rateConstants(ore: ResolvedOre, defs: SpeciesDef[], sb: number, doseGpt: number): Species {
  const perMinute = constant('time.seconds_per_minute');
  const n = grid().n;
  const out: Species = {};
  for (const d of defs) {
    const response = ore.spec[d.mineral].flotation;
    if (response === null) { out[d.id] = new Float64Array(n); continue; }
    let p = response.floatability;
    if (d.kind === 'composite') {
      // the exposed valuable surface goes with the two-thirds power of the valuable's VOLUME share (F-01)
      let valuable = 0.0;
      let total = 0.0;
      for (const [mineral, share] of d.makeup) {
        const v = share / ore.density[mineral];
        total += v;
        if (mineral === d.mineral) valuable += v;
      }
      p = p * Math.pow(valuable / total, constant('flotation.composite_surface_exponent'));
    }
    const shape = sizeResponse(response.optimum_size_um, response.fine_width, response.coarse_width);
    const dose = doseResponse(doseGpt, response.half_dose_gpt, response.unresponsive_fraction);
    const k = new Float64Array(n);
    for (let i = 0; i < n; i += 1) k[i] = perMinute * p * sb * shape[i] * dose;
    out[d.id] = k;
  }
  return out;
}

export type BankResult = {
  recovery: Species;
  water_recovery: number;
  cell_water_recovery: number[];
  /** The mean of the cells' residences; residence_min is their sum. */
  tau_cell_min: number;
  residence_min: number;
  entrained_share: Species;
  cell_recovery: Species[];
  cell_residence_min: number[];
  /** Every cell's tail flow settled. */
  converged: boolean;
  /** Each cell's tail flow, the next recycle pass's starting guess. */
  cell_tail_m3_min: number[];
};

const vsum = (v: Vec) => { let s = 0.0; for (let i = 0; i < v.length; i += 1) s += v[i]; return s; };

export function pulpFlowM3Min(species: Species, defs: SpeciesDef[], waterTph: number): number {
  const waterDensity = constant('water.density_t_m3');
  const minutes = constant('time.minutes_per_hour');
  let solids = 0.0;
  for (const d of defs) solids += vsum(species[d.id]) / d.density;
  return (solids + waterTph / waterDensity) / minutes;
}

/** The fixed point q = g(q) of a cell's tail flow from the feed flow q0: secant while its step stays in (0, q0],
 * substitution otherwise (flotation.py tail_flow). */
export function tailFlow(g: (q: number) => number, q0: number, guess: number | null = null): [number, boolean] {
  const tolerance = constant('numerics.cell_tail_tolerance');
  let qPrev = guess !== null && guess > 0.0 && guess <= q0 ? guess : q0;
  let hPrev = qPrev - g(qPrev);
  if (Math.abs(hPrev) <= tolerance * qPrev) return [qPrev, true];
  let q = qPrev - hPrev;
  for (let k = 0; k < constant('numerics.root_max_iterations'); k += 1) {
    const h = q - g(q);
    if (Math.abs(h) <= tolerance * q) return [q, true];
    const candidate = h !== hPrev ? q - h * (q - qPrev) / (h - hPrev) : q - h;
    qPrev = q; hPrev = h;
    q = candidate > 0.0 && candidate <= q0 ? candidate : q - h;
  }
  return [q, false];
}

/** A bank of `cells` perfect mixers in series, each with its pulp volume over its own tail flow (F-02). */
export function bank(rates: Species, ent: Vec, cells: number, bankDef: Bank, feed: Species, feedWater: number, defs: SpeciesDef[],
  sb: number, waterFloatability: number, guess: number[] | null = null): BankResult {
  const perMinute = constant('time.seconds_per_minute');
  const volume = bankDef.cell_volume_m3 * (1.0 - bankDef.gas_holdup);
  const kw = perMinute * waterFloatability * sb;
  const n = grid().n;
  const entEff = new Float64Array(n);
  for (let i = 0; i < n; i += 1) entEff[i] = ent[i] * bankDef.wash_factor;
  const keys = Object.keys(rates);
  const x: Species = {};
  for (const k of keys) x[k] = Float64Array.from(feed[k]);
  let water = feedWater;
  const unfloated: Species = {};
  const entrained: Species = {};
  for (const k of keys) { unfloated[k] = new Float64Array(n).fill(1.0); entrained[k] = new Float64Array(n); }
  let waterUnfloated = 1.0;
  const cellRecovery: Species[] = [];
  const cellWater: number[] = [];
  const residence: number[] = [];
  let converged = true;
  const cell = (q: number): [number, number, Species] => {
    const tau = volume / q;
    const w = kw * tau;
    const r: Species = {};
    for (const key of keys) {
      const k = rates[key];
      const v = new Float64Array(n);
      for (let i = 0; i < n; i += 1) v[i] = (k[i] * tau + entEff[i] * w) / (1.0 + k[i] * tau + entEff[i] * w);
      r[key] = v;
    }
    return [tau, w, r];
  };
  const waterDensity = constant('water.density_t_m3');
  const minutes = constant('time.minutes_per_hour');
  const density: Record<string, number> = {};
  for (const d of defs) density[d.id] = d.density;
  // the tail's pulp flow at a trial flow q, summed without building the tail (flotation.py tail)
  const tail = (q: number): number => {
    const tau = volume / q;
    const w = kw * tau;
    let solids = 0.0;
    for (const key of keys) {
      const k = rates[key];
      const xs = x[key];
      let left = 0.0;
      for (let i = 0; i < n; i += 1) {
        const numerator = k[i] * tau + entEff[i] * w;
        left += xs[i] * (1.0 - numerator / (1.0 + numerator));
      }
      solids += left / density[key];
    }
    return (solids + water / (1.0 + w) / waterDensity) / minutes;
  };
  const tails: number[] = [];
  for (let j = 0; j < cells; j += 1) {
    const [q, settled] = tailFlow(tail, pulpFlowM3Min(x, defs, water), guess !== null && j < guess.length ? guess[j] : null);
    tails.push(q);
    converged = converged && settled;
    const [tau, w, r] = cell(q);
    for (const key of keys) {
      const k = rates[key];
      for (let i = 0; i < n; i += 1) {
        const numerator = k[i] * tau + entEff[i] * w;
        const share = numerator > 0.0 ? entEff[i] * w / numerator : 0.0;
        entrained[key][i] += unfloated[key][i] * r[key][i] * share;
        unfloated[key][i] *= 1.0 - r[key][i];
        x[key][i] *= 1.0 - r[key][i];
      }
    }
    water /= 1.0 + w;
    waterUnfloated /= 1.0 + w;
    cellRecovery.push(r);
    cellWater.push(w / (1.0 + w));
    residence.push(tau);
  }
  const recovery: Species = {};
  const share: Species = {};
  for (const key of keys) {
    recovery[key] = Float64Array.from(unfloated[key], v => 1.0 - v);
    share[key] = Float64Array.from(recovery[key], (v, i) => (v > 0.0 ? entrained[key][i] / v : 0.0));
  }
  let total = 0.0;
  for (const t of residence) total += t;
  return { recovery, water_recovery: 1.0 - waterUnfloated, cell_water_recovery: cellWater, tau_cell_min: total / cells, residence_min: total,
    entrained_share: share, cell_recovery: cellRecovery, cell_residence_min: residence, converged, cell_tail_m3_min: tails };
}

export type FlotationResult = {
  streams: Record<string, Stream>;
  species_final: Species;
  rougher: BankResult;
  cleaner: BankResult;
  recleaner: BankResult | null;
  rougher_feed_species: Species;
  feed_species: Species;
  defs: SpeciesDef[];
  iterations: number;
  residual_tph: number;
  sb_rougher: number;
  sb_cleaner: number;
  rates_rougher: Species;
  dilution_water_tph: number;
  regrind_feed_tph: number;
  dilution_cleaner_tph: number;
  dilution_recleaner_tph: number;
  dilution_rougher_tph: number;
  relative_change: number;
};

function solidsOf(species: Species): number {
  let s = 0.0;
  for (const v of Object.values(species)) s += vsum(v);
  return s;
}

/** Water after diluting to the target solids fraction; water is only ever added. */
function diluted(water: number, solids: number, targetSolids: number): number {
  return Math.max(water, solids * (1.0 - targetSolids) / targetSolids);
}

/** Largest change of any particle class between passes, relative to that class's total flow. */
function relativeChange(next: Species, prev: Species): number {
  let worst = 0.0;
  for (const [k, values] of Object.entries(next)) {
    let scale = 0.0;
    let diff = 0.0;
    for (let i = 0; i < values.length; i += 1) { scale += Math.abs(values[i]); diff += Math.abs(values[i] - prev[k][i]); }
    if (scale > 0.0) worst = Math.max(worst, diff / scale);
  }
  return worst;
}

const mapSpecies = (keys: string[], fn: (k: string) => Vec): Species => {
  const out: Species = {};
  for (const k of keys) out[k] = fn(k);
  return out;
};
const times = (a: Vec, b: Vec) => { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i += 1) o[i] = a[i] * b[i]; return o; };
const plus = (a: Vec, b: Vec) => { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i += 1) o[i] = a[i] + b[i]; return o; };
const minus = (a: Vec, b: Vec) => { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i += 1) o[i] = a[i] - b[i]; return o; };

type PassState = {
  rougher: BankResult; conc_r: Species; water_conc_r: number; ground: Species; y: Species; water_y: number; dilution_c: number;
  cleaner: BankResult; conc_c: Species; tail_c: Species; water_conc_c: number; water_tail_c: number;
  recleaner: BankResult | null; water_z: number; dilution_rc: number; final: Species; water_final: number; tail_rc: Species; water_tail_rc: number;
};

export function runFlotation(fo: Species, feedWaterIn: number, ore: ResolvedOre, plant: FlotationPlant, op: OperatingPoint, flags: Flags,
  regrind: ((minerals: Record<string, Vec>) => Record<string, Vec>) | null = null): FlotationResult {
  const defs = speciesDefs(ore);
  const keys = Object.keys(fo);
  const arrivingWater = feedWaterIn;
  let feedWater = feedWaterIn;
  if (plant.rougher.feed_solids > 0.0) feedWater = diluted(feedWater, solidsOf(fo), plant.rougher.feed_solids);
  const rougherDilution = feedWater - arrivingWater;
  const ent = savassiEntrainment(plant.entrainment_size_um, plant.drainage);
  const sbR = bubbleSurfaceFlux(op.jg_cm_s, plant);
  const sbC = bubbleSurfaceFlux(plant.cleaner.jg_cm_s, plant);
  const kR = rateConstants(ore, defs, sbR, op.collector_gpt);
  const kC = rateConstants(ore, defs, sbC, op.collector_gpt);
  const recl = plant.recleaner;
  const sbRc = recl !== null ? bubbleSurfaceFlux(recl.jg_cm_s, plant) : 0.0;
  const kRc = recl !== null ? rateConstants(ore, defs, sbRc, op.collector_gpt) : {};
  const n = grid().n;
  const zeros = mapSpecies(defs.map(d => d.id), () => new Float64Array(n));

  // each bank's cell tail flows in the last pass: the next pass starts its cells from them
  const warm: Record<'rougher' | 'cleaner' | 'recleaner', number[] | null> = { rougher: null, cleaner: null, recleaner: null };
  const passOnce = (x: Species, waterX: number, tRc: Species, waterTRc: number): PassState => {
    const rougher = bank(kR, ent, op.rougher_cells, plant.rougher, x, waterX, defs, sbR, plant.water_floatability, warm.rougher);
    warm.rougher = rougher.cell_tail_m3_min;
    const concR = mapSpecies(keys, k => times(rougher.recovery[k], x[k]));
    const waterConcR = rougher.water_recovery * waterX;
    const ground = regrind !== null ? toSpecies(new Stream(regrind(toMinerals(concR, defs, ore)), waterConcR), ore, defs) : concR;
    const y = mapSpecies(keys, k => plus(ground[k], tRc[k]));
    const waterY0 = waterConcR + waterTRc;
    const waterY = diluted(waterY0, solidsOf(y), plant.cleaner.feed_solids);
    const cleaner = bank(kC, ent, plant.cleaner.cells, plant.cleaner, y, waterY, defs, sbC, plant.water_floatability, warm.cleaner);
    warm.cleaner = cleaner.cell_tail_m3_min;
    const concC = mapSpecies(keys, k => times(cleaner.recovery[k], y[k]));
    const tailC = mapSpecies(keys, k => minus(y[k], concC[k]));
    const waterConcC = cleaner.water_recovery * waterY;
    const base = { rougher, conc_r: concR, water_conc_r: waterConcR, ground, y, water_y: waterY, dilution_c: waterY - waterY0, cleaner,
      conc_c: concC, tail_c: tailC, water_conc_c: waterConcC, water_tail_c: waterY - waterConcC };
    if (recl !== null) {
      const waterZ = diluted(waterConcC, solidsOf(concC), recl.feed_solids);
      const recleaner = bank(kRc, ent, recl.cells, recl, concC, waterZ, defs, sbRc, plant.water_floatability, warm.recleaner);
      warm.recleaner = recleaner.cell_tail_m3_min;
      const final = mapSpecies(keys, k => times(recleaner.recovery[k], concC[k]));
      const waterFinal = recleaner.water_recovery * waterZ;
      return { ...base, recleaner, water_z: waterZ, dilution_rc: waterZ - waterConcC, final, water_final: waterFinal,
        tail_rc: mapSpecies(keys, k => minus(concC[k], final[k])), water_tail_rc: waterZ - waterFinal };
    }
    return { ...base, recleaner: null, water_z: 0.0, final: concC, water_final: waterConcC, tail_rc: zeros, water_tail_rc: 0.0, dilution_rc: 0.0 };
  };

  let x = mapSpecies(keys, k => Float64Array.from(fo[k]));
  let waterX = feedWater;
  let tRc = zeros;
  let waterTRc = 0.0;
  const tol = constant('numerics.recycle_tolerance_tph');
  const rtol = constant('numerics.recycle_rel_tolerance');
  let iterations = 0;
  let residual = Infinity;
  let relative = Infinity;
  const maxIterations = constant('numerics.recycle_max_iterations');
  const recirculate = plant.cleaner_tail_to_rougher !== false;
  for (iterations = 1; iterations <= maxIterations; iterations += 1) {
    const state = passOnce(x, waterX, tRc, waterTRc);
    const xNew = recirculate ? mapSpecies(keys, k => plus(fo[k], state.tail_c[k])) : mapSpecies(keys, k => fo[k].slice());
    const waterXNew = recirculate ? feedWater + state.water_tail_c : feedWater;
    const tRcNew = state.tail_rc;
    const waterTRcNew = state.water_tail_rc;
    let maxX = 0.0;
    let maxT = 0.0;
    for (const k of keys) {
      for (let i = 0; i < n; i += 1) {
        maxX = Math.max(maxX, Math.abs(xNew[k][i] - x[k][i]));
        maxT = Math.max(maxT, Math.abs(tRcNew[k][i] - tRc[k][i]));
      }
    }
    residual = maxX + Math.abs(waterXNew - waterX) + maxT + Math.abs(waterTRcNew - waterTRc);
    relative = Math.max(relativeChange(xNew, x), relativeChange(tRcNew, tRc));
    x = xNew; waterX = waterXNew; tRc = tRcNew; waterTRc = waterTRcNew;
    if (residual < tol && relative < rtol) break;
  }
  if (iterations > maxIterations) iterations = maxIterations;
  if (residual >= tol || relative >= rtol) {
    flags.add('recycle_not_converged', `Flotation recycle residual ${residual.toExponential(2)} t/h (relative ${relative.toExponential(2)}) after ${iterations} iterations.`);
  }
  const s = passOnce(x, waterX, tRc, waterTRc);
  if (![s.rougher, s.cleaner, s.recleaner].every(b => b === null || b.converged)) {
    flags.add('cell_residence_not_converged', 'A flotation cell\'s tail flow did not settle; the last iterate is reported.');
  }
  const stream = (species: Species, water: number) => new Stream(toMinerals(species, defs, ore), water);
  const streams: Record<string, Stream> = {
    flotation_feed: stream(fo, feedWater),
    rougher_feed: stream(x, waterX),
    rougher_concentrate: stream(s.conc_r, s.water_conc_r),
    rougher_tail: stream(mapSpecies(keys, k => minus(x[k], s.conc_r[k])), waterX - s.water_conc_r),
  };
  if (regrind !== null) streams.regrind_product = stream(s.ground, s.water_conc_r);
  streams.cleaner_feed = stream(s.y, s.water_y);
  streams.cleaner_concentrate = stream(s.conc_c, s.water_conc_c);
  streams.cleaner_tail = stream(s.tail_c, s.water_tail_c);
  if (recl !== null) {
    streams.recleaner_feed = stream(s.conc_c, s.water_z);
    streams.recleaner_concentrate = stream(s.final, s.water_final);
    streams.recleaner_tail = stream(s.tail_rc, s.water_tail_rc);
  }
  return {
    streams, species_final: s.final, rougher: s.rougher, cleaner: s.cleaner, recleaner: s.recleaner, rougher_feed_species: x,
    feed_species: fo, defs, iterations, residual_tph: residual, sb_rougher: sbR, sb_cleaner: sbC, rates_rougher: kR,
    dilution_water_tph: rougherDilution + s.dilution_c + s.dilution_rc, regrind_feed_tph: solidsOf(s.conc_r),
    dilution_cleaner_tph: s.dilution_c, dilution_recleaner_tph: s.dilution_rc, dilution_rougher_tph: rougherDilution,
    relative_change: relative,
  };
}

export function finalStreamName(result: FlotationResult): string {
  return result.recleaner !== null ? 'recleaner_concentrate' : 'cleaner_concentrate';
}

/** Cumulative grade and recovery of `species` along the rougher cells, each with its own recovery (F-02). */
export function bankProfile(result: FlotationResult, ore: ResolvedOre, species: string): Array<Record<string, number>> {
  const x = result.rougher_feed_species;
  const defs = result.defs;
  const content: Record<string, number> = {};
  for (const d of defs) content[d.id] = speciesContentOf(d, ore, species);
  let total = 0.0;
  let feedMass = 0.0;
  for (const d of defs) { total += content[d.id] * vsum(x[d.id]); feedMass += vsum(x[d.id]); }
  const unfloated: Species = {};
  for (const d of defs) unfloated[d.id] = new Float64Array(x[d.id].length).fill(1.0);
  const out: Array<Record<string, number>> = [];
  result.rougher.cell_recovery.forEach((cell, index) => {
    let mass = 0.0;
    let value = 0.0;
    for (const d of defs) {
      let recovered = 0.0;
      for (let i = 0; i < x[d.id].length; i += 1) {
        unfloated[d.id][i] *= 1.0 - cell[d.id][i];
        recovered += x[d.id][i] * (1.0 - unfloated[d.id][i]);
      }
      mass += recovered;
      value += content[d.id] * recovered;
    }
    out.push({ cell: index + 1, recovery: total > 0.0 ? value / total : 0.0, grade: mass > 0.0 ? value / mass : 0.0,
      mass_pull: feedMass > 0.0 ? mass / feedMass : 0.0 });
  });
  return out;
}
