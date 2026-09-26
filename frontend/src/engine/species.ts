/**
 * Particle classes at a separation: liberated grains, binary composites and free gangue (port of
 * engine/species.py). The split applies only to a product of breakage; composites are limited by
 * the host gangue each class carries, which liberates the balance of the valuable mineral.
 */
import { grid, type Vec } from './grid';
import type { ResolvedOre } from './ore';
import type { Stream } from './streams';

export type SpeciesDef = {
  id: string;
  mineral: string;
  kind: 'liberated' | 'composite' | 'free';
  makeup: Array<[string, number]>;
  density: number;
};
export type Species = Record<string, Vec>;

export function speciesDefs(ore: ResolvedOre): SpeciesDef[] {
  const out: SpeciesDef[] = [];
  for (const m of ore.valuable) {
    const spec = ore.spec[m];
    out.push({ id: `${m}:liberated`, mineral: m, kind: 'liberated', makeup: [[m, 1.0]], density: ore.density[m] });
    if (spec.composite_content > 0.0) {
      const c = spec.composite_content;
      out.push({ id: `${m}:composite`, mineral: m, kind: 'composite', makeup: [[m, c], [ore.host, 1.0 - c]], density: ore.compositeDensity(m) });
    }
  }
  for (const m of ore.ids) {
    if (!ore.valuable.includes(m)) out.push({ id: `${m}:free`, mineral: m, kind: 'free', makeup: [[m, 1.0]], density: ore.density[m] });
  }
  return out;
}

/** Split a product of breakage into particle classes (host-limited composites). */
export function toSpecies(stream: Stream, ore: ResolvedOre, defs: SpeciesDef[]): Species {
  const n = grid().n;
  const out: Species = {};
  for (const d of defs) out[d.id] = new Float64Array(n);
  const zeros = new Float64Array(n);
  const host = stream.solids[ore.host] ?? zeros;
  const demand: Record<string, Vec> = {};
  for (const m of ore.valuable) {
    const c = ore.spec[m].composite_content;
    if (c > 0.0) {
      const mass = stream.solids[m] ?? zeros;
      const lib = ore.liberation[m];
      const v = new Float64Array(n);
      for (let i = 0; i < n; i += 1) v[i] = (1.0 - lib[i]) * mass[i] * (1.0 - c) / c;
      demand[m] = v;
    }
  }
  const totalDemand = new Float64Array(n);
  for (const v of Object.values(demand)) for (let i = 0; i < n; i += 1) totalDemand[i] += v[i];
  const scale = new Float64Array(n).fill(1.0);
  for (let i = 0; i < n; i += 1) if (totalDemand[i] > host[i]) scale[i] = host[i] / totalDemand[i];
  const locked = new Float64Array(n);
  for (const m of ore.valuable) {
    const mass = stream.solids[m] ?? zeros;
    const c = ore.spec[m].composite_content;
    if (m in demand) {
      const composite = new Float64Array(n);
      const liberated = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        const hostLocked = demand[m][i] * scale[i];
        composite[i] = hostLocked / (1.0 - c);
        liberated[i] = mass[i] - c * composite[i];
        locked[i] += hostLocked;
      }
      out[`${m}:composite`] = composite;
      out[`${m}:liberated`] = liberated;
    } else {
      out[`${m}:liberated`] = Float64Array.from(mass);
    }
  }
  for (const m of ore.ids) {
    if (ore.valuable.includes(m)) continue;
    const mass = stream.solids[m] ?? zeros;
    const free = new Float64Array(n);
    for (let i = 0; i < n; i += 1) free[i] = m === ore.host ? mass[i] - locked[i] : mass[i];
    out[`${m}:free`] = free;
  }
  return out;
}

/** Split particle classes by per-class fractions to the first product. */
export function partitionSpecies(species: Species, fractions: Species): [Species, Species] {
  const first: Species = {};
  const second: Species = {};
  for (const [k, v] of Object.entries(species)) {
    const f = fractions[k];
    const a = new Float64Array(v.length);
    const b = new Float64Array(v.length);
    for (let i = 0; i < v.length; i += 1) { a[i] = f[i] * v[i]; b[i] = v[i] - a[i]; }
    first[k] = a;
    second[k] = b;
  }
  return [first, second];
}

export function toMinerals(species: Species, defs: SpeciesDef[], ore: ResolvedOre): Record<string, Vec> {
  const n = grid().n;
  const out: Record<string, Vec> = {};
  for (const m of ore.ids) out[m] = new Float64Array(n);
  for (const d of defs) {
    const v = species[d.id];
    for (const [mineral, share] of d.makeup) for (let i = 0; i < n; i += 1) out[mineral][i] += share * v[i];
  }
  return out;
}

export function speciesContentOf(d: SpeciesDef, ore: ResolvedOre, name: string): number {
  let s = 0.0;
  for (const [m, share] of d.makeup) s += share * ore.content(m, name);
  return s;
}
