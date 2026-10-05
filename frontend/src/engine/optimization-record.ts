/**
 * The optimizer record's shape (engine/optimize.ts writes it, the bake's methods/optimization.py writes the same):
 * types only, so the interface can read a record without importing the solver (scripts/check_ui_formulas.py).
 */
import type { OperatingPoint } from './model';

/** What the optimizer reads from the screen: the learned lane's view of one operating point. */
export type PointScreen = {
  guardThreshold: number;
  judgePoint(point: OperatingPoint): { prediction: Record<string, number>; guardError: number; halfWidth: number };
};

export type Summary = {
  decisions: Record<string, number>; recovered_tph: number; recovery_pct: number; values: Record<string, number>;
  slacks: Record<string, number>; active: string[]; feasible: boolean;
};
export type Proposal = [number, number, number | null, number, number | null, number | null, boolean];
export type ScreenRecord = {
  iterations: number; screened: number; rejected: { guard: number; interval: number }; proposed: number; improved: number; proposals: Proposal[];
};
/** One iteration of the incumbent's path: outcome initial, mesh size, barrier, feasible objective, engine evaluations. */
export type TraceRow = [string, number, number | null, number | null, number];
export type StartRecord = {
  start: Record<string, number>; end: Summary; violation: number; evaluations: number; iterations: number; stop: string; message: string;
  screen?: ScreenRecord;
};
export type PathStep = {
  weight: number; status: string; decisions: Record<string, number>; recovered_tph: number; energy_kwh_t: number | undefined;
  evaluations: number; stop: string; screen?: Omit<ScreenRecord, 'proposals'>;
  /** The step's search stopped on its mesh, not on its evaluation budget (M-09). */
  converged?: boolean;
};
export type OptimizationRecord = {
  method: string; weights: { recovered_metal: number; energy: number }; decisions: string[]; bounds: Record<string, [number, number]>;
  constraints: { grade: { minimum: number; species: string }; power: { maximum_kw: number }; water?: { maximum_m3_t: number } };
  screened: boolean; unscreened_reason?: string; base: Summary; starts: StartRecord[];
  evaluations: number; status: 'optimal' | 'infeasible' | 'base_refused'; optimum: Summary | null; screen_bound_pct?: number; proposal_columns?: string[];
  /** The engine's refusal codes of the base state, when it refuses it (M-05). */
  refused?: string[];
  /** The best start stopped on its mesh, not on its evaluation budget (M-09). */
  converged?: boolean;
  trace?: TraceRow[]; gain_tph?: number; gain_pct?: number | null; least_violating?: Summary;
  without_screen?: { evaluations: number; starts: number[]; status: string; decisions: Record<string, number> | null; recovered_tph: number | null };
  path?: PathStep[];
};
