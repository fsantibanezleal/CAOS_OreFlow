/**
 * The constrained operating-point optimizer in the browser (port of methods/optimization.py, OP-01 to OP-09). The
 * same objective, the same six starts, the same pattern search with its progressive barrier, the same surrogate
 * screen in its search step and the same weight path, in the same order, so the workbench reproduces the baked
 * record and can re-run it at another weight. The screen is passed in (learning/screen.ts), so the engine does not
 * depend on the learned lane.
 */
import { simulate } from './circuit';
import { constant } from './constants';
import { validate, type OperatingContract } from './contract';
import { InfeasibleState, type OperatingPoint, type Ore, type Plant } from './model';
import { patternSearch, type Iteration, type Point, type SearchState } from './pattern_search';
import type { PointScreen, Summary, Proposal, ScreenRecord, TraceRow, StartRecord, PathStep, OptimizationRecord } from './optimization-record';

export type { PointScreen, Summary, Proposal, ScreenRecord, TraceRow, StartRecord, PathStep, OptimizationRecord } from './optimization-record';

export const FLOTATION_DECISIONS = ['target_p80_um', 'collector_gpt', 'jg_cm_s'] as const;
export const MAGNETIC_DECISIONS = ['target_p80_um'] as const;
export const METHOD = 'gps-progressive-barrier';
export const PROPOSAL_COLUMNS = ['iteration', 'surrogate_recovery_pct', 'engine_recovery_pct', 'surrogate_objective', 'engine_objective',
  'runner_up_margin', 'improved'] as const;

type Evaluation = {
  point: OperatingPoint; valid: boolean; recovered_tph: number; recovery_pct?: number;
  values: Record<string, number>; slacks: Record<string, number>; relative: Record<string, number>;
};

/** Progress of a live run: called after every pattern-search start or path step; returning false stops the run. */
export type Progress = (done: number, total: number) => boolean;

/** The decisions an operator controls; in the cut mode the classifier cut replaces the grind target (CM-02). */
export const decisionsFor = (plant: Plant, cutMode = false): readonly string[] =>
  (plant.family === 'magnetic' ? MAGNETIC_DECISIONS : FLOTATION_DECISIONS).map(n => (cutMode && n === 'target_p80_um' ? 'd50c_um' : n));
const clip = (v: number) => Math.min(1, Math.max(0, v));
const keyOf = (x: number[]) => x.map(v => clip(v).toString()).join(',');

export class Cancelled extends Error {
  constructor() { super('optimization cancelled'); }
}

class Problem {
  readonly names: readonly string[];
  readonly bounds: Array<[number, number]>;
  readonly cache = new Map<string, Evaluation>();
  readonly scale: number;
  readonly energyScale: number;
  readonly recoveryScale: number;
  /** The codes for which the engine refuses the base state; a refused base has no scales (M-05). */
  readonly baseRefused: string[];

  constructor(readonly caseId: string, readonly ore: Ore, readonly plant: Plant, readonly base: OperatingPoint, readonly contract: OperatingContract,
              readonly screen: PointScreen | null) {
    this.names = decisionsFor(plant, base.d50c_um > 0);
    const inputs = contract.cases[caseId].inputs;
    this.bounds = this.names.map(n => [Number(inputs[n].min), Number(inputs[n].max)]);
    const b = this.evaluatePoint(base);
    this.baseRefused = b.valid ? [] : Object.keys(b.relative).sort();
    this.scale = b.recovered_tph > 0 ? b.recovered_tph : 1;
    this.energyScale = b.values.energy_kwh_t || 1;
    this.recoveryScale = b.recovery_pct || 1;
  }

  toUnit(point: OperatingPoint): number[] {
    return this.names.map((n, k) => ((point as unknown as Record<string, number>)[n] - this.bounds[k][0]) / (this.bounds[k][1] - this.bounds[k][0]));
  }

  fromUnit(x: number[]): OperatingPoint {
    const values: Record<string, number> = {};
    this.names.forEach((n, k) => { const [lo, hi] = this.bounds[k]; values[n] = lo + clip(x[k]) * (hi - lo); });
    return { ...this.base, ...values };
  }

  evaluatePoint(point: OperatingPoint): Evaluation {
    const verdict = validate(this.contract, this.caseId, point as unknown as Record<string, unknown>);
    if (!verdict.accepted) return { point, valid: false, recovered_tph: 0, values: {}, slacks: {}, relative: { contract: -1 } };
    let m: ReturnType<typeof simulate>['metrics'];
    try {
      m = simulate(this.ore, this.plant, point).metrics;
    } catch (error) {   // no steady state at this trial (E-01): infeasible, never a result (methods/optimization.py)
      if (error instanceof InfeasibleState) return { point, valid: false, recovered_tph: 0, values: {}, slacks: {}, relative: { [error.code]: -1 } };
      throw error;
    }
    const spec = this.plant.grade_spec as { minimum: number };
    const values = { grade: m.concentrate_grade, required_power_kw: m.required_mill_power_kw, water_m3_t: m.water_intensity_m3_t, energy_kwh_t: m.specific_energy_total_kwh_t };
    const slacks: Record<string, number> = { grade: m.concentrate_grade - spec.minimum, power: m.installed_mill_power_kw - m.required_mill_power_kw };
    const relative: Record<string, number> = { grade: slacks.grade / spec.minimum, power: slacks.power / m.installed_mill_power_kw };
    if (this.plant.water_limit_m3_t > 0) {
      slacks.water = this.plant.water_limit_m3_t - m.water_intensity_m3_t;
      relative.water = slacks.water / this.plant.water_limit_m3_t;
    }
    return { point, valid: true, recovered_tph: m.recovered_primary_tph, recovery_pct: m.recovery_pct, values, slacks, relative };
  }

  evaluate(x: number[]): Evaluation {
    const key = keyOf(x);
    let e = this.cache.get(key);
    if (e === undefined) { e = this.evaluatePoint(this.fromUnit(x.map(clip))); this.cache.set(key, e); }
    return e;
  }

  objective(e: { recovered_tph: number; values: Record<string, number> }, weight: number): number {
    return weight * e.recovered_tph / this.scale - (1 - weight) * e.values.energy_kwh_t / this.energyScale;
  }

  scored(weight: number, tolerance: number) {
    return (x: Point): [number, number] => {
      const e = this.evaluate(x);
      // a non-finite slack is no evidence of feasibility (M-10)
      if (!e.valid || !Object.values(e.relative).every(v => Number.isFinite(v))) return [Infinity, Infinity];
      let h = 0;
      for (const v of Object.values(e.relative)) { const d = Math.max(0, -v - tolerance); h += d * d; }
      return [-this.objective(e, weight), h];
    };
  }
}

const feasibleOf = (e: Evaluation, tolerance: number) => e.valid && Object.values(e.relative).every(v => v >= -tolerance);
const violationOf = (e: Evaluation) => Object.values(e.relative).reduce((s, v) => s + Math.max(0, -v), 0);

function summary(problem: Problem, e: Evaluation): Summary {
  const active = constant<number>('optimization.active_tolerance');
  const point = e.point as unknown as Record<string, number>;
  return {
    decisions: Object.fromEntries(problem.names.map(n => [n, point[n]])), recovered_tph: e.recovered_tph, recovery_pct: e.recovery_pct ?? 0,
    values: e.values, slacks: e.slacks, active: Object.entries(e.relative).filter(([, v]) => Math.abs(v) <= active).map(([c]) => c),
    feasible: feasibleOf(e, constant<number>('optimization.feasibility_tolerance')),
  };
}

function starts(problem: Problem): number[][] {
  const out = [problem.toUnit(problem.base)];
  for (const coords of constant<number[][]>('optimization.starts')) {
    const start = coords.slice(0, problem.names.length).map(Number);
    if (out.every(s => Math.max(...start.map((a, i) => Math.abs(a - s[i]))) > 0)) out.push(start);
  }
  return out;
}

type LogEntry = { screened: number; guard: number; interval: number; proposal: { x: number[]; objective: number; recovery_pct: number; margin: number | null } | null };

function screenStep(problem: Problem, weight: number, log: LogEntry[]) {
  const screen = problem.screen!;
  const bound = constant<number>('optimization.screen_half_width_pct');
  const steps = constant<number[]>('optimization.screen_steps').map(Number);
  const tol = constant<number>('optimization.decrease_tolerance');
  return (state: SearchState): Point[] => {
    const rows: number[][] = [];
    const seen = new Set<string>();
    for (const center of [state.feasible, state.infeasible]) {
      if (center === null) continue;
      for (const step of steps) {
        for (let i = 0; i < center.length; i += 1) {
          for (const sign of [1, -1]) {
            const x = [...center];
            x[i] = center[i] + sign * step * state.delta;
            const key = x.map(v => v.toString()).join(',');
            if (x.every(v => v >= 0 && v <= 1) && !problem.cache.has(key) && !seen.has(key)) { seen.add(key); rows.push(x); }
          }
        }
      }
    }
    const entry: LogEntry = { screened: rows.length, guard: 0, interval: 0, proposal: null };
    let best: [number[], number, number] | null = null;
    let runnerUp: number | null = null;
    for (const x of rows) {
      const judged = screen.judgePoint(problem.fromUnit(x));
      if (judged.guardError > screen.guardThreshold) { entry.guard += 1; continue; }
      if (judged.halfWidth > bound) { entry.interval += 1; continue; }
      const p = judged.prediction;
      const objective = weight * p.recovery_pct / problem.recoveryScale - (1 - weight) * p.specific_energy_total_kwh_t / problem.energyScale;
      // better only by more than round-off, so both languages rank alike; the first of equals is kept
      if (best === null || objective > best[1] + tol * Math.max(1.0, Math.abs(best[1]))) {
        if (best !== null) runnerUp = best[1];
        best = [x, objective, p.recovery_pct];
      } else if (runnerUp === null || objective > runnerUp) {
        runnerUp = objective;
      }
    }
    log.push(entry);
    if (best === null) return [];
    entry.proposal = { x: best[0], objective: best[1], recovery_pct: best[2], margin: runnerUp !== null ? best[1] - runnerUp : null };
    return [best[0]];
  };
}

const sameList = (a: number[], b: number[] | null) => b !== null && a.length === b.length && a.every((v, i) => v === b[i]);

function proposals(problem: Problem, log: LogEntry[], iterations: Iteration[], weight: number): ScreenRecord {
  const rows: Proposal[] = [];
  log.forEach((entry, k) => {
    const proposal = entry.proposal;
    if (proposal === null) return;
    const engine = problem.cache.get(keyOf(proposal.x));
    const evaluated = engine !== undefined && engine.valid;
    const after = iterations[k];
    const improved = after !== undefined && (sameList(proposal.x, after.feasible) || sameList(proposal.x, after.infeasible));
    rows.push([k, proposal.recovery_pct, evaluated ? engine!.recovery_pct! : null, proposal.objective, evaluated ? problem.objective(engine!, weight) : null,
      proposal.margin, improved]);
  });
  return {
    iterations: log.length, screened: log.reduce((s, e) => s + e.screened, 0),
    rejected: { guard: log.reduce((s, e) => s + e.guard, 0), interval: log.reduce((s, e) => s + e.interval, 0) },
    proposed: rows.length, improved: rows.filter(r => r[6]).length, proposals: rows,
  };
}

type Run = { evaluations: number; iterations: number; stop: string; message: string; screen?: ScreenRecord; trace: TraceRow[] };

function search(problem: Problem, start: number[], weight: number, tolerance: number): { end: Evaluation; run: Run } {
  const before = problem.cache.size;
  const log: LogEntry[] = [];
  const result = patternSearch(problem.scored(weight, tolerance), start.map(clip), {
    meshInitial: constant<number>('optimization.mesh_initial'), meshMinimum: constant<number>('optimization.mesh_minimum'),
    maxEvaluations: constant<number>('optimization.max_evaluations'),
    search: problem.screen !== null ? screenStep(problem, weight, log) : undefined,
    decrease: constant<number>('optimization.decrease_tolerance'),
  });
  const x = result.feasible ?? result.infeasible ?? start;
  const run: Run = {
    evaluations: problem.cache.size - before, iterations: result.iterations.length, stop: result.stop,
    message: `${result.stop}: ${result.feasible !== null ? 'feasible' : 'no feasible point'}`, trace: [],
  };
  if (problem.screen !== null) run.screen = proposals(problem, log, result.iterations, weight);
  run.trace = result.iterations.map(it => [it.outcome[0], it.delta, Number.isFinite(it.h_max) ? it.h_max : null,
    it.feasible_f !== null ? -it.feasible_f : null, it.evaluations]);
  return { end: problem.evaluate(x), run };
}

type Tick = () => void;

function multistart(problem: Problem, weight: number, tolerance: number, tick: Tick): Array<StartRecord & { trace: TraceRow[] }> {
  const runs: Array<StartRecord & { trace: TraceRow[] }> = [];
  for (const start of starts(problem)) {
    const { end, run } = search(problem, start, weight, tolerance);
    const startPoint = problem.fromUnit(start) as unknown as Record<string, number>;
    runs.push({ start: Object.fromEntries(problem.names.map(n => [n, startPoint[n]])), end: summary(problem, end), violation: violationOf(end), ...run });
    tick();
  }
  return runs;
}

function bestOf(problem: Problem, runs: Array<StartRecord & { trace: TraceRow[] }>, weight: number) {
  const tol = constant<number>('optimization.decrease_tolerance');
  let best: (StartRecord & { trace: TraceRow[] }) | null = null;
  let score = 0;
  for (const r of runs) {
    if (!r.end.feasible) continue;
    const value = problem.objective(r.end, weight);
    // starts that end at one optimum agree to round-off: the first of them is kept, in both languages
    if (best === null || value > score + tol * Math.max(1.0, Math.abs(score))) { best = r; score = value; }
  }
  return best;
}

export type OptimizeOptions = { weight?: number; path?: boolean; screen?: PointScreen | null; compare?: boolean; progress?: Progress };

/**
 * The optimization record at one weight on recovered metal (the bake's is 1). `path` adds the weight path; with a
 * screen, `compare` (on by default, as in the bake) re-runs the starts without it to measure the saving.
 */
export function optimize(caseId: string, ore: Ore, plant: Plant, base: OperatingPoint, contract: OperatingContract, options: OptimizeOptions = {}): OptimizationRecord {
  // the learned lane describes the target mode, so a cut-mode search runs without the screen and says so
  const unscreenedReason = options.screen && base.d50c_um > 0 ? 'cut_mode' : null;
  const screen = unscreenedReason ? null : options.screen ?? null;
  const withPath = options.path ?? true;
  const compare = screen !== null && (options.compare ?? true);
  const problem = new Problem(caseId, ore, plant, base, contract, screen);
  const tolerance = constant<number>('optimization.feasibility_tolerance');
  const w = options.weight ?? constant<number>('optimization.weight_default');
  const total = starts(problem).length * (compare ? 2 : 1) + (withPath ? constant<number[]>('optimization.weight_path').length : 0);
  let done = 0;
  const tick: Tick = () => {
    done += 1;
    if (options.progress && !options.progress(done, total)) throw new Cancelled();
  };
  if (problem.baseRefused.length > 0) {
    // nothing to optimize from: the engine refuses the base state, so no objective is defined (M-05)
    const refusedSpec = plant.grade_spec as { minimum: number; species: string };
    return { method: METHOD, weights: { recovered_metal: w, energy: 1 - w }, decisions: [...problem.names],
      bounds: Object.fromEntries(problem.names.map((n, k) => [n, problem.bounds[k]])),
      constraints: { grade: { minimum: refusedSpec.minimum, species: refusedSpec.species }, power: { maximum_kw: plant.mill.installed_power_kw },
        ...(plant.water_limit_m3_t > 0 ? { water: { maximum_m3_t: plant.water_limit_m3_t } } : {}) },
      screened: false, base: summary(problem, problem.evaluatePoint(base)), starts: [], evaluations: problem.cache.size, status: 'base_refused',
      refused: problem.baseRefused, optimum: null };
  }
  const runs = multistart(problem, w, tolerance, tick);
  const baseSummary = summary(problem, problem.evaluatePoint(base));
  const spec = plant.grade_spec as { minimum: number; species: string };
  const record: OptimizationRecord = {
    method: METHOD, weights: { recovered_metal: w, energy: 1 - w }, decisions: [...problem.names],
    bounds: Object.fromEntries(problem.names.map((n, k) => [n, problem.bounds[k]])),
    constraints: { grade: { minimum: spec.minimum, species: spec.species }, power: { maximum_kw: plant.mill.installed_power_kw },
      ...(plant.water_limit_m3_t > 0 ? { water: { maximum_m3_t: plant.water_limit_m3_t } } : {}) },
    screened: screen !== null, ...(unscreenedReason ? { unscreened_reason: unscreenedReason } : {}), base: baseSummary, starts: runs.map(({ trace: _trace, ...r }) => r), evaluations: problem.cache.size,
    status: 'infeasible', optimum: null,
  };
  if (screen !== null) {
    record.screen_bound_pct = constant<number>('optimization.screen_half_width_pct');
    record.proposal_columns = [...PROPOSAL_COLUMNS];
  }
  const best = bestOf(problem, runs, w);
  let bestDecisions: Record<string, number> | null = null;
  if (best !== null) {
    bestDecisions = best.end.decisions;
    record.trace = best.trace;
    const optimum = summary(problem, problem.evaluatePoint({ ...base, ...bestDecisions }));
    if (optimum.feasible) {
      record.status = 'optimal';
      record.optimum = optimum;
      // a best start that stopped on its evaluation budget did not meet the mesh criterion (M-09)
      record.converged = best.stop === 'mesh';
      record.gain_tph = optimum.recovered_tph - baseSummary.recovered_tph;
      record.gain_pct = baseSummary.recovered_tph > 0 ? 100 * record.gain_tph / baseSummary.recovered_tph : null;
    }
  }
  if (record.optimum === null) {
    const least = runs.reduce((a, b) => (b.violation < a.violation ? b : a));
    record.least_violating = least.end;
    record.trace = least.trace;
  }
  if (compare) {
    const plain = new Problem(caseId, ore, plant, base, contract, null);
    const plainRuns = multistart(plain, w, tolerance, tick);
    const plainBest = bestOf(plain, plainRuns, w);
    record.without_screen = {
      evaluations: plain.cache.size, starts: plainRuns.map(r => r.evaluations), status: plainBest !== null ? 'optimal' : 'infeasible',
      decisions: plainBest !== null ? plainBest.end.decisions : null, recovered_tph: plainBest !== null ? plainBest.end.recovered_tph : null,
    };
  }
  if (withPath) record.path = weightPath(problem, bestDecisions, tolerance, tick);
  return record;
}

function weightPath(problem: Problem, startDecisions: Record<string, number> | null, tolerance: number, tick: Tick): PathStep[] {
  const steps: PathStep[] = [];
  let current = problem.toUnit(startDecisions ? { ...problem.base, ...startDecisions } : problem.base);
  for (const weight of constant<number[]>('optimization.weight_path').map(Number)) {
    const { end, run } = search(problem, current, weight, tolerance);
    const s = summary(problem, end);
    const step: PathStep = { weight, status: s.feasible ? 'optimal' : 'infeasible', decisions: s.decisions, recovered_tph: s.recovered_tph,
      energy_kwh_t: s.values.energy_kwh_t, evaluations: run.evaluations, stop: run.stop, converged: run.stop === 'mesh' };
    if (run.screen) { const { proposals: _p, ...counts } = run.screen; step.screen = counts; }
    steps.push(step);
    if (s.feasible) current = problem.toUnit({ ...problem.base, ...s.decisions });
    tick();
  }
  return steps;
}
