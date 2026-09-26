/**
 * Web Worker entry: the engine runs off the interface thread. Two requests:
 * - `evaluate`: one state to its trace, for the live views; the client keeps only the latest reply.
 * - `sweep`: a one- or two-input grid, streamed cell by cell (PE-38); only ever posted by an explicit
 *   user action, and a newer sweep or a cancel stops the one in progress between cells.
 */
import type { OperatingContract } from './contract';
import type { OperatingPoint, Ore, Plant } from './model';
import { gridPoints, sweepCell, type SweepCell, type SweepRequest } from './sweep';
import { evaluate } from './index';
import type { Trace } from './trace';

export type Inbound =
  | { type: 'evaluate'; id: number; ore: Ore; plant: Plant; point: OperatingPoint }
  | { type: 'sweep'; request: SweepRequest; contract: OperatingContract }
  | { type: 'cancel'; id: number };
export type Outbound =
  | { type: 'trace'; id: number; trace: Trace; ms: number }
  | { type: 'cell'; id: number; cell: SweepCell; done: number; total: number }
  | { type: 'done'; id: number; cells: SweepCell[]; ms: number }
  | { type: 'error'; id: number; message: string };

let currentSweep = 0;
const scope = self as unknown as { onmessage: ((event: MessageEvent<Inbound>) => void) | null; postMessage: (message: Outbound) => void };

scope.onmessage = event => {
  const message = event.data;
  if (message.type === 'cancel') { if (message.id === currentSweep) currentSweep = 0; return; }
  if (message.type === 'evaluate') {
    const started = performance.now();
    try {
      const trace = evaluate(message.ore, message.plant, message.point);
      scope.postMessage({ type: 'trace', id: message.id, trace, ms: performance.now() - started });
    } catch (error) {
      scope.postMessage({ type: 'error', id: message.id, message: error instanceof Error ? error.message : String(error) });
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
