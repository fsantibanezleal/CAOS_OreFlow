/**
 * The interface's handle on the engine worker. `evaluate` keeps only the reply to the latest request,
 * so a slider dragged across its range never queues stale traces; `sweep` streams cells and can be
 * cancelled. One worker per page, created on first use.
 */
import type { OperatingContract } from './contract';
import type { OperatingPoint, Ore, Plant } from './model';
import type { SweepCell, SweepRequest } from './sweep';
import type { Trace } from './trace';
import type { UncertaintyRecord } from './uncertainty';
import type { OptimizationRecord } from './optimize';
import type { OptimizerInbound, OptimizerOutbound } from './optimizer-worker';
import type { Inbound, Outbound } from './worker';

type Pending = { resolve: (trace: Trace) => void; reject: (error: Error) => void };
type SweepHandlers = { onCell: (cell: SweepCell, done: number, total: number) => void; resolve: (cells: SweepCell[]) => void; reject: (error: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
let latestEvaluate = 0;
const evaluations = new Map<number, Pending>();
const sweeps = new Map<number, SweepHandlers>();
type RunHandlers = { onProgress: (done: number, total: number) => void; resolve: (record: UncertaintyRecord) => void; reject: (error: Error) => void };
const runs = new Map<number, RunHandlers>();

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
    } else if (message.type === 'progress') {
      runs.get(message.id)?.onProgress(message.done, message.total);
    } else if (message.type === 'record') {
      runs.get(message.id)?.resolve(message.record);
      runs.delete(message.id);
    } else if (message.type === 'error') {
      const error = new Error(message.message);
      evaluations.get(message.id)?.reject(error);
      evaluations.delete(message.id);
      sweeps.get(message.id)?.reject(error);
      sweeps.delete(message.id);
      runs.get(message.id)?.reject(error);
      runs.delete(message.id);
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

/** Re-runs the uncertainty record at a seed and sample count (UQ-06); progress streams to `onProgress`. */
export function uncertaintyInWorker(ore: Ore, plant: Plant, point: OperatingPoint, samples: number, seed: number,
  onProgress: (done: number, total: number) => void): { id: number; done: Promise<UncertaintyRecord> } {
  const id = nextId++;
  const done = new Promise<UncertaintyRecord>((resolve, reject) => {
    runs.set(id, { onProgress, resolve, reject });
    post({ type: 'uncertainty', id, ore, plant, point, samples, seed });
  });
  return { id, done };
}

export function cancelRun(id: number): void {
  const handlers = runs.get(id);
  runs.delete(id);
  handlers?.reject(new Error('cancelled'));
  post({ type: 'cancel', id });
}

// The optimizer runs in a worker of its own (OP-09): its run is one synchronous computation that no message can
// interrupt, so a cancel or a newer run terminates that worker. The engine worker's live views never wait on it.
type OptimizerRun = { id: number; onProgress: (done: number, total: number) => void; resolve: (record: OptimizationRecord) => void; reject: (error: Error) => void };
let optimizerWorker: Worker | null = null;
let optimizerRun: OptimizerRun | null = null;

function stopOptimizer(reason: string): void {
  const run = optimizerRun;
  optimizerRun = null;
  optimizerWorker?.terminate();
  optimizerWorker = null;
  run?.reject(new Error(reason));
}

/** Runs the screened optimizer at a weight on recovered metal; a newer run supersedes this one. */
export function optimizeInWorker(caseId: string, ore: Ore, plant: Plant, point: OperatingPoint, contract: OperatingContract, weight: number,
  onProgress: (done: number, total: number) => void): { id: number; done: Promise<OptimizationRecord> } {
  if (optimizerRun) stopOptimizer('superseded');
  const id = nextId++;
  const worker = optimizerWorker ?? new Worker(new URL('./optimizer-worker.ts', import.meta.url), { type: 'module' });
  optimizerWorker = worker;
  const done = new Promise<OptimizationRecord>((resolve, reject) => {
    optimizerRun = { id, onProgress, resolve, reject };
    worker.onmessage = (event: MessageEvent<OptimizerOutbound>) => {
      const message = event.data;
      const run = optimizerRun;
      if (!run || message.id !== run.id) return;
      if (message.type === 'progress') { run.onProgress(message.done, message.total); return; }
      optimizerRun = null;          // the worker stays for the next run: its screen is already loaded
      if (message.type === 'record') run.resolve(message.record);
      else run.reject(new Error(message.message));
    };
    worker.onerror = event => { if (optimizerRun?.id === id) stopOptimizer(event.message || 'the optimizer worker failed'); };
    const request: OptimizerInbound = { type: 'optimize', id, caseId, ore, plant, point, contract, weight };
    worker.postMessage(request);
  });
  return { id, done };
}

export function cancelOptimize(id: number): void {
  if (optimizerRun?.id === id) stopOptimizer('cancelled');
}
