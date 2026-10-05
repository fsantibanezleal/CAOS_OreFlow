/**
 * The exported surrogate and guard in the browser (onnxruntime-web, WebAssembly, one thread). A state's
 * features are standardized with the scalers written by the bake, the surrogate predicts the three
 * targets, and the guard's reconstruction error is compared with its threshold, so the workbench can
 * show the learned answer beside the engine's and say when the state lies outside the training design.
 */
import type { OperatingPoint, Ore, Plant } from '../engine/model';
import { APP_VERSION } from '../lib/version';
import { features } from './features';

export type Scalers = {
  features: string[]; targets: string[]; feature_mean: number[]; feature_scale: number[]; target_mean: number[]; target_scale: number[];
  guard_feature_mean: number[]; guard_feature_scale: number[]; guard_threshold: number;
  reference?: Array<{ case_id: string; features: number[]; prediction: Record<string, number>; guard_error: number; guard_flag: boolean }>;
};
/** Why the lane does not describe a state at all, or null: its features carry the grind target and the design load, which a
 * set classifier cut ignores (L-02). */
export const outsideLearnedDomain = (point: OperatingPoint): 'cut_mode' | null => (point.d50c_um > 0.0 ? 'cut_mode' : null);

/** `notApplicable` marks a state the lane never learned (a set classifier cut, L-02): no prediction, flagged outside. */
export type SurrogateAnswer = { prediction: Record<string, number>; guardError: number; guardThreshold: number; outside: boolean; notApplicable?: 'cut_mode' };

type Session = import('onnxruntime-web').InferenceSession;
let loaded: Promise<{ ort: typeof import('onnxruntime-web/wasm'); surrogate: Session; guard: Session; scalers: Scalers }> | null = null;

const url = (path: string) => `${import.meta.env.BASE_URL}${path}?v=${encodeURIComponent(APP_VERSION)}`;

function load() {
  loaded ??= (async () => {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
    const scalers = (await (await fetch(url('models/process_surrogate.json'), { cache: 'no-store' })).json()) as Scalers;
    const surrogate = await ort.InferenceSession.create(url('models/process_surrogate.onnx'), { executionProviders: ['wasm'] });
    const guard = await ort.InferenceSession.create(url('models/process_guard.onnx'), { executionProviders: ['wasm'] });
    return { ort, surrogate, guard, scalers };
  })();
  return loaded;
}

export function standardize(x: number[], mean: number[], scale: number[]): Float32Array {
  return Float32Array.from(x.map((v, i) => (v - mean[i]) / scale[i]));
}

/**
 * The surrogate's predictions and the guard's verdict for a batch of states, in one call per network
 * (both graphs are exported with a dynamic row axis).
 */
export async function askSurrogate(ore: Ore, plant: Plant, points: OperatingPoint[]): Promise<SurrogateAnswer[]> {
  const { ort, surrogate, guard, scalers } = await load();
  const width = scalers.features.length;
  const rows = points.length;
  const input = new Float32Array(rows * width);
  const guardInput = new Float32Array(rows * width);
  points.forEach((point, r) => {
    const x = features(ore, plant, point);
    input.set(standardize(x, scalers.feature_mean, scalers.feature_scale), r * width);
    guardInput.set(standardize(x, scalers.guard_feature_mean, scalers.guard_feature_scale), r * width);
  });
  const out = (await surrogate.run({ features: new ort.Tensor('float32', input, [rows, width]) })).targets.data as Float32Array;
  const rec = (await guard.run({ features: new ort.Tensor('float32', guardInput, [rows, width]) })).reconstruction.data as Float32Array;
  const targets = scalers.targets.length;
  return points.map((point, r) => {
    // the lane's features carry the grind target and the design load, which the cut mode ignores: a cut-mode state
    // would get the nominal state's answer and the guard's "inside" (review of 2026-10-04, L-02; the optimizer's screen
    // already declines the cut mode)
    const domain = outsideLearnedDomain(point);
    if (domain !== null) return { prediction: {}, guardError: Number.NaN, guardThreshold: scalers.guard_threshold, outside: true, notApplicable: domain };
    const prediction: Record<string, number> = {};
    scalers.targets.forEach((name, i) => { prediction[name] = out[r * targets + i] * scalers.target_scale[i] + scalers.target_mean[i]; });
    let error = 0.0;
    for (let i = 0; i < width; i += 1) error += (rec[r * width + i] - guardInput[r * width + i]) ** 2; // not-engine: the guard's error norm, as the bake defines it
    error /= width;
    return { prediction, guardError: error, guardThreshold: scalers.guard_threshold, outside: error > scalers.guard_threshold };
  });
}

/** The exported model's protocol results and scalers, for the view's context line. */
export async function surrogateScalers(): Promise<Scalers> {
  return (await load()).scalers;
}
