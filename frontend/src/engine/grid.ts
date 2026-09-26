/**
 * The fixed fourth-root-of-two size grid shared by every stream (port of engine/grid.py).
 * Class i (0-based) spans [upper[i+1], upper[i]); the last class is the pan below upper[n-1].
 * Cumulative passing at upper[i] is the mass in classes i and finer.
 */
import { constant } from './constants';

export type Vec = Float64Array;

export class SizeGrid {
  readonly n: number;
  readonly ratio: number;
  readonly upper: Vec;
  readonly size: Vec;

  constructor() {
    const top = constant('grid.top_um');
    const perOctave = constant('grid.classes_per_octave');
    this.n = constant('grid.n_classes');
    this.ratio = Math.pow(2.0, 1.0 / perOctave);
    this.upper = new Float64Array(this.n);
    for (let i = 0; i < this.n; i += 1) this.upper[i] = top / Math.pow(this.ratio, i);
    this.size = new Float64Array(this.n);
    for (let i = 0; i < this.n - 1; i += 1) this.size[i] = Math.sqrt(this.upper[i] * this.upper[i + 1]);
    this.size[this.n - 1] = this.upper[this.n - 1] / Math.sqrt(this.ratio);
  }

  zeros(): Vec {
    return new Float64Array(this.n);
  }

  /** Cumulative fraction passing each upper bound. */
  passing(mass: Vec): Vec {
    let total = 0.0;
    for (let i = 0; i < mass.length; i += 1) total += mass[i];
    const out = new Float64Array(this.n);
    if (total <= 0.0) return out;
    let running = 0.0;
    for (let i = this.n - 1; i >= 0; i -= 1) { running += mass[i]; out[i] = running / total; }
    return out;
  }

  /** Size at which `level` of the mass passes, interpolated in (log size, passing). */
  percentile(mass: Vec, level: number): number {
    const passing = this.passing(mass);
    if (passing[this.n - 1] >= level) return this.size[this.n - 1];
    for (let i = 0; i < this.n - 1; i += 1) {
      const upperPass = passing[i];
      const lowerPass = passing[i + 1];
      if (upperPass >= level && level > lowerPass) {
        const fraction = (level - lowerPass) / (upperPass - lowerPass);
        const logSize = Math.log(this.upper[i + 1]) + fraction * (Math.log(this.upper[i]) - Math.log(this.upper[i + 1]));
        return Math.exp(logSize);
      }
    }
    return this.upper[0];
  }

  p80(mass: Vec): number {
    return this.percentile(mass, constant('psd.p80_level'));
  }

  /** Class mass fractions of a Rosin-Rammler distribution with the given P80. */
  rosinRammler(p80Um: number, slope: number): Vec {
    const level = constant('psd.p80_level');
    const scale = p80Um / Math.pow(-Math.log(1.0 - level), 1.0 / slope);
    const cumulative = new Float64Array(this.n);
    for (let i = 0; i < this.n; i += 1) cumulative[i] = 1.0 - Math.exp(-Math.pow(this.upper[i] / scale, slope));
    const mass = new Float64Array(this.n);
    for (let i = 0; i < this.n - 1; i += 1) mass[i] = cumulative[i] - cumulative[i + 1];
    mass[this.n - 1] = cumulative[this.n - 1];
    mass[0] += 1.0 - cumulative[0];
    let total = 0.0;
    for (let i = 0; i < this.n; i += 1) total += mass[i];
    for (let i = 0; i < this.n; i += 1) mass[i] /= total;
    return mass;
  }
}

let shared: SizeGrid | null = null;

export function grid(): SizeGrid {
  shared ??= new SizeGrid();
  return shared;
}
