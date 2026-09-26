/**
 * The interface's handle on the engine worker. `evaluate` keeps only the reply to the latest request,
 * so a slider dragged across its range never queues stale traces; `sweep` streams cells and can be
 * cancelled. One worker per page, created on first use.
 */
import type { OperatingContract } from './contract';
import type { OperatingPoint, Ore, Plant } from './model';
import type { SweepCell, SweepRequest } from './sweep';
import type { Trace } from './trace';
import type { Inbound, Outbound } from './worker';

type Pending = { resolve: (trace: Trace) => void; reject: (error: Error) => void };
type SweepHandlers = { onCell: (cell: SweepCell, done: number, total: number) => void; resolve: (cells: SweepCell[]) => void; reject: (error: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
let latestEvaluate = 0;
const evaluations = new Map<number, Pending>();
const sweeps = new Map<number, SweepHandlers>();

function engineWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<Outbound>) => {
    const message = event.data;
    if (message.type === 'trace') {
      const pending = evaluations.get(message.id);
      evaluations.delete(message.id);
      if (pending && message.id === latestEvaluate) pending.resolve(message.trace);
      else pending?.reject(new Error('superseded'));
    } else if (message.type === 'cell') {
      sweeps.get(message.id)?.onCell(message.cell, message.done, message.total);
    } else if (message.type === 'done') {
      sweeps.get(message.id)?.resolve(message.cells);
      sweeps.delete(message.id);
    } else if (message.type === 'error') {
      const error = new Error(message.message);
      evaluations.get(message.id)?.reject(error);
      evaluations.delete(message.id);
      sweeps.get(message.id)?.reject(error);
      sweeps.delete(message.id);
    }
  };
  return worker;
}

const post = (message: Inbound) => engineWorker().postMessage(message);

/** The trace of one state; rejects with 'superseded' when a newer request was made meanwhile. */
export function evaluateInWorker(ore: Ore, plant: Plant, point: OperatingPoint): Promise<Trace> {
  const id = nextId++;
  latestEvaluate = id;
  return new Promise((resolve, reject) => {
    evaluations.set(id, { resolve, reject });
    post({ type: 'evaluate', id, ore, plant, point });
  });
}

/** Starts a sweep; returns its id and a promise of all cells. Cells stream to `onCell`. */
export function sweepInWorker(request: Omit<SweepRequest, 'id'>, contract: OperatingContract,
  onCell: (cell: SweepCell, done: number, total: number) => void): { id: number; done: Promise<SweepCell[]> } {
  const id = nextId++;
  const done = new Promise<SweepCell[]>((resolve, reject) => {
    sweeps.set(id, { onCell, resolve, reject });
    post({ type: 'sweep', request: { ...request, id }, contract });
  });
  return { id, done };
}

export function cancelSweep(id: number): void {
  const handlers = sweeps.get(id);
  sweeps.delete(id);
  handlers?.reject(new Error('cancelled'));
  post({ type: 'cancel', id });
}
