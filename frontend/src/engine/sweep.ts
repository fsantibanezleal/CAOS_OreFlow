/**
 * Operating-point sweeps over one or two Contract 1 inputs, run by the Web Worker on request (PE-38).
 * Every grid point is validated first; a rejected state is reported with its codes and never simulated.
 */
import { simulate } from './circuit';
import { validate, type OperatingContract } from './contract';
import { InfeasibleState, type OperatingPoint, type Ore, type Plant } from './model';

export type Axis = { input: string; values: number[] };

/** n values from lo to hi with both declared bounds exactly on the grid: lo + (hi - lo) i/(n - 1) rounds above hi for
 * some ranges (1.8000000000000003 for the nickel head grade), which the validator rejects as out of range (review of
 * 2026-10-04, M-04). Integer inputs keep their distinct rounded values. */
export function gridValues(lo: number, hi: number, n: number, integer: boolean): number[] {
  const values = Array.from({ length: n }, (_, i) => (i === 0 ? lo : i === n - 1 ? hi : Math.min(hi, Math.max(lo, lo + (hi - lo) * i / (n - 1)))));
  return integer ? [...new Set(values.map(v => Math.round(v)))] : values;
}
export type SweepRequest = {
  id: number;
  caseId: string;
  ore: Ore;
  plant: Plant;
  base: OperatingPoint;
  axes: Axis[];
  outputs: string[];
};
export type SweepCell = {
  index: number[];
  point: Record<string, number>;
  accepted: boolean;
  metrics: Record<string, number>;
  flags: string[];
  errors: string[];
};

export function gridPoints(axes: Axis[]): number[][] {
  if (axes.length === 0) return [[]];
  const [first, ...rest] = axes;
  const tail = gridPoints(rest);
  const out: number[][] = [];
  first.values.forEach((_, i) => { for (const t of tail) out.push([i, ...t]); });
  return out;
}

export function sweepCell(request: SweepRequest, contract: OperatingContract, index: number[]): SweepCell {
  const values: Record<string, number> = { ...(request.base as unknown as Record<string, number>) };
  request.axes.forEach((axis, k) => { values[axis.input] = axis.values[index[k]]; });
  const verdict = validate(contract, request.caseId, values);
  if (!verdict.accepted || verdict.point === null) {
    return { index, point: values, accepted: false, metrics: {}, flags: [], errors: verdict.errors.map(e => e.code) };
  }
  const point = verdict.point as unknown as OperatingPoint;
  let result: ReturnType<typeof simulate>;
  try {
    result = simulate(request.ore, request.plant, point);
  } catch (error) {   // refused by the engine (E-01): a rejected cell, with its code
    if (error instanceof InfeasibleState) return { index, point: verdict.point, accepted: false, metrics: {}, flags: [], errors: [error.code] };
    throw error;
  }
  const metrics: Record<string, number> = {};
  for (const key of request.outputs) if (key in result.metrics) metrics[key] = result.metrics[key];
  return { index, point: verdict.point, accepted: true, metrics, flags: result.flags.map(f => f.code), errors: [] };
}

export function sweep(request: SweepRequest, contract: OperatingContract, onCell?: (cell: SweepCell, done: number, total: number) => void): SweepCell[] {
  const indices = gridPoints(request.axes);
  const cells: SweepCell[] = [];
  indices.forEach((index, n) => {
    const cell = sweepCell(request, contract, index);
    cells.push(cell);
    onCell?.(cell, n + 1, indices.length);
  });
  return cells;
}
