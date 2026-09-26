/**
 * Operating-point sweeps over one or two Contract 1 inputs, run by the Web Worker on request (PE-38).
 * Every grid point is validated first; a rejected state is reported with its codes and never simulated.
 */
import { simulate } from './circuit';
import { validate, type OperatingContract } from './contract';
import type { OperatingPoint, Ore, Plant } from './model';

export type Axis = { input: string; values: number[] };
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
  const result = simulate(request.ore, request.plant, point);
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
