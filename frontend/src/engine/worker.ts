/**
 * Web Worker entry: the engine runs off the interface thread. Two requests:
 * - `evaluate`: one state to its trace, for the live views; the client keeps only the latest reply.
 * - `sweep`: a one- or two-input grid, streamed cell by cell (PE-38); only ever posted by an explicit
 *   user action, and a newer sweep or a cancel stops the one in progress between cells.
 * - `uncertainty`: the seeded uncertainty record at a seed and sample count (UQ-06), one engine run per
 *   tick with its progress; posted only by a user action, and a newer run or a cancel stops it between runs.
 */
import type { OperatingContract } from './contract';
import { InfeasibleState, type OperatingPoint, type Ore, type Plant } from './model';
import { gridPoints, sweepCell, type SweepCell, type SweepRequest } from './sweep';
import { evaluate } from './index';
import type { Trace } from './trace';
import { designFor, evaluateSample, factorsOf, summarize, type Evaluation, type Refused, type UncertaintyRecord } from './uncertainty';

export type Inbound =
  | { type: 'evaluate'; id: number; ore: Ore; plant: Plant; point: OperatingPoint }
  | { type: 'sweep'; request: SweepRequest; contract: OperatingContract }
  | { type: 'uncertainty'; id: number; ore: Ore; plant: Plant; point: OperatingPoint; samples: number; seed: number }
  | { type: 'cancel'; id: number };
export type Outbound =
  | { type: 'trace'; id: number; trace: Trace; ms: number }
  | { type: 'cell'; id: number; cell: SweepCell; done: number; total: number }
  | { type: 'done'; id: number; cells: SweepCell[]; ms: number }
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'record'; id: number; record: UncertaintyRecord; ms: number }
  | { type: 'refused'; id: number; error: { code: string; input: string; value: number; max?: number } }
  | { type: 'error'; id: number; message: string };

let currentSweep = 0;
let currentRun = 0;
const scope = self as unknown as { onmessage: ((event: MessageEvent<Inbound>) => void) | null; postMessage: (message: Outbound) => void };

scope.onmessage = event => {
  const message = event.data;
  if (message.type === 'cancel') { if (message.id === currentSweep) currentSweep = 0; if (message.id === currentRun) currentRun = 0; return; }
  if (message.type === 'uncertainty') {
    const { id, ore, plant, point } = message;
    currentRun = id;
    const started = performance.now();
    let design: ReturnType<typeof designFor>;
    try { design = designFor(plant, message.samples, message.seed); } catch (error) {
      scope.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
      return;
    }
    const rows: Array<Evaluation | Refused> = [];
    const step = () => {
      if (currentRun !== id) return;
      try {
        if (rows.length < design.factors.length) {
          rows.push(evaluateSample(ore, plant, point, factorsOf(design.names, design.factors[rows.length])));
          scope.postMessage({ type: 'progress', id, done: rows.length, total: design.factors.length });
          setTimeout(step, 0);
          return;
        }
        const record = summarize(design, rows, evaluateSample(ore, plant, point, {}));
        scope.postMessage({ type: 'record', id, record, ms: performance.now() - started });
      } catch (error) {
        if (error instanceof InfeasibleState) scope.postMessage({ type: 'refused', id, error: error.error() });
        else scope.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
      }
    };
    step();
    return;
  }
  if (message.type === 'evaluate') {
    const started = performance.now();
    try {
      const trace = evaluate(message.ore, message.plant, message.point);
      scope.postMessage({ type: 'trace', id: message.id, trace, ms: performance.now() - started });
    } catch (error) {
      if (error instanceof InfeasibleState) scope.postMessage({ type: 'refused', id: message.id, error: error.error() });
      else scope.postMessage({ type: 'error', id: message.id, message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  const { request, contract } = message;
  currentSweep = request.id;
  const indices = gridPoints(request.axes);
  const cells: SweepCell[] = [];
  const started = performance.now();
  const step = (n: number) => {
    if (currentSweep !== request.id) return;
    if (n >= indices.length) { scope.postMessage({ type: 'done', id: request.id, cells, ms: performance.now() - started }); return; }
    try {
      const cell = sweepCell(request, contract, indices[n]);
      cells.push(cell);
      scope.postMessage({ type: 'cell', id: request.id, cell, done: n + 1, total: indices.length });
    } catch (error) {
      scope.postMessage({ type: 'error', id: request.id, message: error instanceof Error ? error.message : String(error) });
      return;
    }
    setTimeout(() => step(n + 1), 0);
  };
  step(0);
};
