/**
 * Low-intensity magnetic separation and desliming (port of engine/separation.py; theory in
 * docs/methodologies/07_magnetic-separation.md and 08_desliming.md).
 */
import { correctedCut, reducedPartition } from './cyclone';
import { grid, type Vec } from './grid';
import { constant } from './constants';
import type { DeslimePlant, Flags, MagneticPlant } from './model';
import type { ResolvedOre } from './ore';
import { partitionSpecies, speciesDefs, toMinerals, type Species, type SpeciesDef } from './species';
import { Stream } from './streams';

export function limsCapture(defs: SpeciesDef[], ore: ResolvedOre, mp: MagneticPlant, entrapmentFactor: number): Species {
  const size = grid().size;
  const n = size.length;
  const fine = new Float64Array(n);
  const entrapment = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    fine[i] = 1.0 - Math.exp(-size[i] / mp.fine_scale_um);
    entrapment[i] = entrapmentFactor * (mp.entrapment_base + mp.entrapment_fines * Math.exp(-size[i] / mp.entrapment_scale_um));
  }
  const out: Species = {};
  for (const d of defs) {
    const magnetic = ore.spec[d.mineral].magnetic;
    const v = new Float64Array(n);
    if (magnetic && d.kind === 'liberated') {
      for (let i = 0; i < n; i += 1) v[i] = mp.max_capture * fine[i];
    } else if (magnetic && d.kind === 'composite') {
      const c = ore.spec[d.mineral].composite_content;
      const scale = mp.max_capture * (1.0 - Math.exp(-c / mp.composite_threshold));
      for (let i = 0; i < n; i += 1) v[i] = scale * fine[i];
    } else {
      v.set(entrapment);
    }
    out[d.id] = v;
  }
  return out;
}

export type MagneticResult = { streams: Record<string, Stream>; capture_rougher: Species; capture_cleaner: Species; defs: SpeciesDef[] };

function splitWater(magsSolids: number, feedWater: number, solidsFraction: number): number {
  return Math.min(feedWater, magsSolids * (1.0 - solidsFraction) / solidsFraction);
}

const total = (species: Species) => { let s = 0.0; for (const v of Object.values(species)) for (let i = 0; i < v.length; i += 1) s += v[i]; return s; };

export function runMagnetic(x: Species, feedWater: number, ore: ResolvedOre, mp: MagneticPlant): MagneticResult {
  const defs = speciesDefs(ore);
  const capR = limsCapture(defs, ore, mp, 1.0);
  const capC = limsCapture(defs, ore, mp, mp.cleaner_factor);
  const magsR: Species = {}; const tailR: Species = {}; const magsC: Species = {}; const tailC: Species = {};
  for (const k of Object.keys(x)) {
    const n = x[k].length;
    magsR[k] = new Float64Array(n); tailR[k] = new Float64Array(n); magsC[k] = new Float64Array(n); tailC[k] = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      magsR[k][i] = capR[k][i] * x[k][i];
      tailR[k][i] = x[k][i] - magsR[k][i];
    }
  }
  const waterMagsR = splitWater(total(magsR), feedWater, mp.concentrate_solids);
  for (const k of Object.keys(x)) {
    for (let i = 0; i < x[k].length; i += 1) {
      magsC[k][i] = capC[k][i] * magsR[k][i];
      tailC[k][i] = magsR[k][i] - magsC[k][i];
    }
  }
  const waterMagsC = splitWater(total(magsC), waterMagsR, mp.concentrate_solids);
  const stream = (species: Species, water: number) => new Stream(toMinerals(species, defs, ore), water);
  return {
    streams: {
      lims_feed: stream(x, feedWater),
      lims_rougher_concentrate: stream(magsR, waterMagsR),
      lims_rougher_tail: stream(tailR, feedWater - waterMagsR),
      lims_cleaner_concentrate: stream(magsC, waterMagsC),
      lims_cleaner_tail: stream(tailC, waterMagsR - waterMagsC),
    },
    capture_rougher: capR, capture_cleaner: capC, defs,
  };
}

export type DeslimeResult = { underflow: Stream; slimes: Stream; partition: Species; underflow_species: Species; underflow_water: number; bypass: number };

/** The desliming cyclone at its declared underflow density: R_f = k Y / (1 - k X + k Y), k = (1 - s_u)/(s_u W)
 * (separation.py run_deslime, P-04); declared grains classify with the GRG exponent (L-1). */
export function runDeslime(x: Species, feedWater: number, ore: ResolvedOre, dp: DeslimePlant, cutUm: number, flags: Flags | null = null): DeslimeResult {
  const defs = speciesDefs(ore);
  const rhoRef = ore.density[ore.host];
  const grg = constant('cyclone.grg_density_exponent');
  const corrected: Species = {};
  for (const d of defs) {
    const exponent = d.kind === 'liberated' && (ore.spec[d.mineral].grains ?? null) !== null ? grg : 0.5;
    corrected[d.id] = reducedPartition(correctedCut(cutUm, rhoRef, d.density, exponent), dp.sharpness);
  }
  let solids = 0.0;
  let classified = 0.0;
  for (const key of Object.keys(x)) {
    let a = 0.0;
    let b = 0.0;
    for (let i = 0; i < x[key].length; i += 1) { a += x[key][i]; b += corrected[key][i] * x[key][i]; }
    solids += a;
    classified += b;
  }
  const k = (1.0 - dp.underflow_solids) / (dp.underflow_solids * feedWater);
  let rf = 1.0;
  if (k * solids < 1.0) rf = k * classified / (1.0 - k * solids + k * classified);
  else if (flags !== null) flags.add('deslime_water_short', 'The desliming feed carries too little water for the declared underflow density; all of it reports to the underflow.');
  const partition: Species = {};
  for (const [key, y] of Object.entries(corrected)) partition[key] = Float64Array.from(y, v => rf + (1.0 - rf) * v);
  const [under, over] = partitionSpecies(x, partition);
  const waterUnder = rf * feedWater;
  return { underflow: new Stream(toMinerals(under, defs, ore), waterUnder), slimes: new Stream(toMinerals(over, defs, ore), feedWater - waterUnder),
    partition, underflow_species: under, underflow_water: waterUnder, bypass: rf };
}
