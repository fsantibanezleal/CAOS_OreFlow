/**
 * The optimizer's surrogate screen in the browser (port of pipeline/methods/screen.py, OP-05). The exported
 * surrogate and guard run from their weights in float64, and the Gaussian process on recovery from its training
 * rows, hyperparameters, alpha and Cholesky factor, in the bake's order of operations, so the screen's verdicts and
 * rankings are the bake's. The learned-lane view keeps onnxruntime-web in float32; the screen does not, because a
 * float32 difference between runtimes can reorder two candidates on a fine mesh.
 */
import type { OperatingPoint, Ore, Plant } from '../engine/model';
import type { PointScreen } from '../engine/optimization-record';
import { APP_VERSION } from '../lib/version';
import { features } from './features';
import type { Scalers } from './surrogate';

type Layer = { weight: number[][]; bias: number[]; activation: 'silu' | 'tanh' | null };
export type ScreenDoc = {
  schema: string;
  networks: { surrogate: Layer[]; guard: Layer[] };
  gp: {
    target: string; rows: number; amplitude: number; length_scales: number[]; noise_level: number; y_mean: number; y_std: number;
    interval_z: number; training: number[][]; alpha: number[]; cholesky: { file: string; packing: string; values: number };
  };
};
export type Judged = { prediction: Record<string, number>; guardError: number; halfWidth: number };

export class Screen {
  readonly guardThreshold: number;
  private readonly scaled: number[][];
  private readonly offsets: number[];

  constructor(readonly doc: ScreenDoc, readonly scalers: Scalers, private readonly lower: Float64Array) {
    const g = doc.gp;
    if (lower.length !== g.cholesky.values) throw new Error(`the Cholesky factor has ${lower.length} values, the export declares ${g.cholesky.values}`);
    this.scaled = g.training.map(row => row.map((v, k) => v / g.length_scales[k]));
    this.offsets = Array.from({ length: g.rows }, (_, i) => (i * (i + 1)) / 2);
    this.guardThreshold = scalers.guard_threshold;
  }

  forward(name: 'surrogate' | 'guard', x: number[]): number[] {
    let h = x;
    for (const layer of this.doc.networks[name]) {
      const next = layer.weight.map((row, i) => {
        let s = 0.0;
        for (let j = 0; j < row.length; j += 1) s += row[j] * h[j];
        return s + layer.bias[i];
      });
      h = layer.activation === 'silu' ? next.map(v => v / (1.0 + Math.exp(-v))) : layer.activation === 'tanh' ? next.map(Math.tanh) : next; // not-engine: the exported network's activations
    }
    return h;
  }

  /** Mean and standard deviation of the GP's target at one standardized state. */
  gp(xs: number[]): [number, number] {
    const g = this.doc.gp;
    const n = g.rows;
    const u = xs.map((v, k) => v / g.length_scales[k]);
    const k = new Float64Array(n);
    let mean = 0.0;
    for (let i = 0; i < n; i += 1) {
      const row = this.scaled[i];
      let d = 0.0;
      for (let j = 0; j < row.length; j += 1) { const e = u[j] - row[j]; d += e * e; }
      k[i] = g.amplitude * Math.exp(-0.5 * d); // not-engine: the Gaussian process's squared-exponential kernel
      mean += k[i] * g.alpha[i];
    }
    // forward substitution with the packed lower factor: v = L^-1 k
    const v = new Float64Array(n);
    let vv = 0.0;
    for (let i = 0; i < n; i += 1) {
      const o = this.offsets[i];
      let s = k[i];
      for (let j = 0; j < i; j += 1) s -= this.lower[o + j] * v[j];
      v[i] = s / this.lower[o + i];
      vv += v[i] * v[i];
    }
    const variance = Math.max(0.0, g.amplitude + g.noise_level - vv);
    return [mean * g.y_std + g.y_mean, Math.sqrt(variance) * g.y_std];
  }

  judge(x: number[]): Judged {
    const s = this.scalers;
    const standardized = x.map((v, i) => (v - s.feature_mean[i]) / s.feature_scale[i]);
    const out = this.forward('surrogate', standardized);
    const prediction = Object.fromEntries(s.targets.map((name, i) => [name, out[i] * s.target_scale[i] + s.target_mean[i]]));
    const g = x.map((v, i) => (v - s.guard_feature_mean[i]) / s.guard_feature_scale[i]);
    const rec = this.forward('guard', g);
    let error = 0.0;
    for (let i = 0; i < g.length; i += 1) error += (rec[i] - g[i]) ** 2; // not-engine: the guard's error norm
    const [, std] = this.gp(standardized);
    return { prediction, guardError: error / g.length, halfWidth: this.doc.gp.interval_z * std };
  }

  /** The screen of one case's states, as the optimizer reads it. */
  forCase(ore: Ore, plant: Plant): PointScreen {
    return { guardThreshold: this.guardThreshold, judgePoint: (point: OperatingPoint) => this.judge(features(ore, plant, point)) };
  }
}

export function choleskyFrom(buffer: ArrayBuffer): Float64Array {
  const view = new DataView(buffer);
  const out = new Float64Array(buffer.byteLength / 8);
  for (let i = 0; i < out.length; i += 1) out[i] = view.getFloat64(8 * i, true);
  return out;
}

let loaded: Promise<Screen> | null = null;
const url = (path: string) => `${import.meta.env.BASE_URL}${path}?v=${encodeURIComponent(APP_VERSION)}`;

/** The screen the worker uses, fetched once: the export, the scalers and the Cholesky factor. */
export function loadScreen(): Promise<Screen> {
  loaded ??= (async () => {
    const [doc, scalers] = await Promise.all([
      fetch(url('models/process_screen.json')).then(r => r.json() as Promise<ScreenDoc>),
      fetch(url('models/process_surrogate.json')).then(r => r.json() as Promise<Scalers>),
    ]);
    const buffer = await (await fetch(url(`models/${doc.gp.cholesky.file}`))).arrayBuffer();
    return new Screen(doc, scalers, choleskyFrom(buffer));
  })();
  loaded.catch(() => { loaded = null; });
  return loaded;
}
