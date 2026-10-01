/**
 * The optimizer's own Web Worker (OP-09): one `optimize` request, the screened pattern search of
 * engine/optimize.ts at the requested weight, with the bake's screen fetched once. The run is one
 * synchronous computation, so no message can reach it until it ends: a cancel or a newer run makes the
 * client terminate this worker (engine/client.ts), which stops it at once, and the next run starts a new
 * one. Progress (each start, each start without the screen and each weight-path step) is posted as it
 * happens. Nothing runs without a user action.
 */
import { loadScreen } from '../learning/screen';
import type { OperatingContract } from './contract';
import type { OperatingPoint, Ore, Plant } from './model';
import { optimize, type OptimizationRecord } from './optimize';

export type OptimizerInbound = {
  type: 'optimize'; id: number; caseId: string; ore: Ore; plant: Plant; point: OperatingPoint; contract: OperatingContract; weight: number;
};
export type OptimizerOutbound =
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'record'; id: number; record: OptimizationRecord; ms: number }
  | { type: 'error'; id: number; message: string };

const scope = self as unknown as { onmessage: ((event: MessageEvent<OptimizerInbound>) => void) | null; postMessage: (message: OptimizerOutbound) => void };

scope.onmessage = event => {
  const { id, caseId, ore, plant, point, contract, weight } = event.data;
  const started = performance.now();
  loadScreen().then(screen => {
    const record = optimize(caseId, ore, plant, point, contract, {
      weight, screen: screen.forCase(ore, plant),
      progress: (done, total) => { scope.postMessage({ type: 'progress', id, done, total }); return true; },
    });
    scope.postMessage({ type: 'record', id, record, ms: performance.now() - started });
  }).catch((error: unknown) => {
    scope.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
  });
};
