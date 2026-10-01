/**
 * The seeded uncertainty record of an operating point in the browser (port of methods/uncertainty.py,
 * UQ-05 and UQ-06). The ore's work index, head grade, liberation size and floatability vary on
 * [1 - h, 1 + h] times their values by the SplitMix64 Latin hypercube, identical to the bake's, so the
 * baked seed and sample count give the baked factors bit for bit and any other seed re-runs the same
 * design live. The engine runs every sample; the quantiles use NumPy's linear rule.
 */
import { simulate } from './circuit';
import { constant } from './constants';
import type { MineralSpec, OperatingPoint, Ore, Plant } from './model';
import { latinHypercube } from './sampling';

export const UNCERTAIN_INPUTS = ['work_index', 'head_grade', 'liberation_size', 'floatability'] as const;
export const UNCERTAIN_OUTPUTS = ['recovery_pct', 'concentrate_grade', 'specific_energy_grinding_kwh_t', 'recovered_primary_tph'] as const;
export type UncertainInput = (typeof UNCERTAIN_INPUTS)[number];
export type UncertainOutput = (typeof UNCERTAIN_OUTPUTS)[number];

export type OutputSummary = { p05: number; p50: number; p95: number; mean: number; std: number; base: number; values: number[] };
export type UncertaintyRecord = {
  status: 'computed';
  samples: number;
  seed: number;
  design: 'Latin hypercube';
  generator: 'SplitMix64';
  inputs: Record<string, { half_width: number }>;
  factors: number[][];
  outputs: Record<UncertainOutput, OutputSummary>;
  probabilities: Record<string, number>;
  base_checks: Record<string, boolean>;
  flag_counts: Record<string, number>;
  max_balance_error: number;
};

export function inputsFor(plant: Plant): UncertainInput[] {
  return UNCERTAIN_INPUTS.filter(n => n !== 'floatability' || plant.flotation !== null);
}

/** The ore and operating point with each uncertain property multiplied by its factor. */
export function perturbed(ore: Ore, point: OperatingPoint, factors: Partial<Record<UncertainInput, number>>): [Ore, OperatingPoint] {
  const minerals: MineralSpec[] = ore.minerals.map(m => {
    if (m.liberation_size_um <= 0) return m; // the valuable minerals: liberation is declared for them
    let flotation = m.flotation;
    if (flotation !== null && factors.floatability !== undefined) flotation = { ...flotation, floatability: flotation.floatability * factors.floatability };
    return { ...m, liberation_size_um: m.liberation_size_um * (factors.liberation_size ?? 1), flotation };
  });
  return [{ ...ore, minerals },
    { ...point, work_index_kwh_t: point.work_index_kwh_t * (factors.work_index ?? 1), head_grade: point.head_grade * (factors.head_grade ?? 1) }];
}

export type Evaluation = { outputs: Record<UncertainOutput, number>; checks: Record<string, boolean>; flags: string[]; balance: number };

export function evaluateSample(ore: Ore, plant: Plant, point: OperatingPoint, factors: Partial<Record<UncertainInput, number>>): Evaluation {
  const [o, p] = perturbed(ore, point, factors);
  const result = simulate(o, plant, p);
  const m = result.metrics;
  const checks: Record<string, boolean> = {
    grade_meets_spec: m.concentrate_grade >= (plant.grade_spec as { minimum: number }).minimum,
    power_within_installed: m.required_mill_power_kw <= plant.mill.installed_power_kw,
  };
  if (plant.water_limit_m3_t > 0) checks.water_within_capacity = m.water_intensity_m3_t <= plant.water_limit_m3_t;
  const outputs = Object.fromEntries(UNCERTAIN_OUTPUTS.map(k => [k, m[k]])) as Record<UncertainOutput, number>;
  return { outputs, checks, flags: result.flags.map(f => f.code), balance: m.balance_max_relative_error };
}

/** NumPy's default (linear) quantile of unsorted values, including its two-sided interpolation. */
export function quantile(values: number[], q: number): number {
  const x = [...values].sort((a, b) => a - b);
  const position = (x.length - 1) * q;
  const lo = Math.floor(position), hi = Math.min(lo + 1, x.length - 1), t = position - lo;
  const a = x[lo], b = x[hi], diff = b - a;
  return t >= 0.5 ? b - diff * (1 - t) : a + diff * t;
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function std(values: number[]): number {
  const mu = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - mu) * (v - mu), 0) / (values.length - 1));
}

/** The design of a run: the input names, their half widths and the factor rows, as the bake draws them. */
export function designFor(plant: Plant, samples?: number, seed?: number): { names: UncertainInput[]; widths: number[]; samples: number; seed: number; factors: number[][] } {
  const names = inputsFor(plant);
  const table = constant<Record<string, number>>('uncertainty.half_widths');
  const widths = names.map(n => Number(table[n]));
  const n = samples ?? constant<number>('uncertainty.samples');
  const s = seed ?? constant<number>('uncertainty.seed');
  const factors = latinHypercube(n, names.length, s).map(row => row.map((u, k) => (1 - widths[k]) + (2 * widths[k]) * u));
  return { names, widths, samples: n, seed: s, factors };
}

export const factorsOf = (names: UncertainInput[], row: number[]) => Object.fromEntries(names.map((name, k) => [name, row[k]])) as Partial<Record<UncertainInput, number>>;

/** The record from the evaluated samples and the base state (the order of `rows` is the design's). */
export function summarize(design: ReturnType<typeof designFor>, rows: Evaluation[], base: Evaluation): UncertaintyRecord {
  const levels = constant<number[]>('uncertainty.quantiles').map(Number);
  const outputs = {} as Record<UncertainOutput, OutputSummary>;
  for (const key of UNCERTAIN_OUTPUTS) {
    const values = rows.map(r => r.outputs[key]);
    outputs[key] = { p05: quantile(values, levels[0]), p50: quantile(values, levels[1]), p95: quantile(values, levels[2]),
      mean: mean(values), std: std(values), base: base.outputs[key], values };
  }
  const probabilities: Record<string, number> = {};
  for (const c of Object.keys(base.checks)) probabilities[c] = mean(rows.map(r => (r.checks[c] ? 1 : 0)));
  probabilities.all_constraints = mean(rows.map(r => (Object.values(r.checks).every(Boolean) ? 1 : 0)));
  const flagCounts: Record<string, number> = {};
  for (const r of rows) for (const code of r.flags) flagCounts[code] = (flagCounts[code] ?? 0) + 1;
  return {
    status: 'computed', samples: design.samples, seed: design.seed, design: 'Latin hypercube', generator: 'SplitMix64',
    inputs: Object.fromEntries(design.names.map((name, k) => [name, { half_width: design.widths[k] }])),
    factors: design.factors, outputs, probabilities, base_checks: base.checks, flag_counts: flagCounts,
    max_balance_error: Math.max(...rows.map(r => r.balance)),
  };
}

/** The uncertainty record for this state, in one synchronous run (the worker steps the same pieces). */
export function uncertainty(ore: Ore, plant: Plant, point: OperatingPoint, samples?: number, seed?: number): UncertaintyRecord {
  const design = designFor(plant, samples, seed);
  const rows = design.factors.map(row => evaluateSample(ore, plant, point, factorsOf(design.names, row)));
  return summarize(design, rows, evaluateSample(ore, plant, point, {}));
}
