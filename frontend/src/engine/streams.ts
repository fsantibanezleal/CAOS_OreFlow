/** Streams: dry mass flow by mineral and size class, plus water (port of engine/streams.py). */
import { grid, type Vec } from './grid';

export type Compositions = Record<string, Record<string, number>>;

const sum = (v: Vec) => { let s = 0.0; for (let i = 0; i < v.length; i += 1) s += v[i]; return s; };

export class Stream {
  /** `solids[mineral]` is a vector over the size grid in t/h; `water` in t/h. */
  constructor(readonly solids: Record<string, Vec> = {}, public water = 0.0) {}

  copy(): Stream {
    const solids: Record<string, Vec> = {};
    for (const [k, v] of Object.entries(this.solids)) solids[k] = Float64Array.from(v);
    return new Stream(solids, this.water);
  }

  total(): Vec {
    const out = grid().zeros();
    for (const mass of Object.values(this.solids)) for (let i = 0; i < out.length; i += 1) out[i] += mass[i];
    return out;
  }

  tph(): number {
    let s = 0.0;
    for (const mass of Object.values(this.solids)) s += sum(mass);
    return s;
  }

  mineralTph(mineral: string): number {
    const mass = this.solids[mineral];
    return mass ? sum(mass) : 0.0;
  }

  /** Mass flow of an element or oxide species, given each mineral's content of it. */
  speciesTph(species: string, compositions: Compositions): number {
    let s = 0.0;
    for (const [m, mass] of Object.entries(this.solids)) s += (compositions[m][species] ?? 0.0) * sum(mass);
    return s;
  }

  /** Mass fraction of a species in the solids (0 when the stream is empty). */
  grade(species: string, compositions: Compositions): number {
    const solids = this.tph();
    return solids > 0.0 ? this.speciesTph(species, compositions) / solids : 0.0;
  }

  pctSolids(): number {
    const solids = this.tph();
    const total = solids + this.water;
    return total > 0.0 ? solids / total : 0.0;
  }

  p80(): number {
    return grid().p80(this.total());
  }

  /** Solids and water volumetric flows in m3/h. */
  volumeM3H(densities: Record<string, number>, waterDensity: number): [number, number] {
    let solids = 0.0;
    for (const [m, mass] of Object.entries(this.solids)) solids += sum(mass) / densities[m];
    return [solids, this.water / waterDensity];
  }
}

export function add(...streams: Stream[]): Stream {
  const out = new Stream({}, 0.0);
  for (const stream of streams) {
    for (const [mineral, mass] of Object.entries(stream.solids)) {
      const target = out.solids[mineral] ?? (out.solids[mineral] = grid().zeros());
      for (let i = 0; i < mass.length; i += 1) target[i] += mass[i];
    }
    out.water += stream.water;
  }
  return out;
}
