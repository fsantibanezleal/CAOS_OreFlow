import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { OperatingPoint, Ore, Plant } from '../engine';
import type { OperatingContract } from '../engine/contract';
import { optimize, type OptimizationRecord } from '../engine/optimize';
import type { OptimizerInbound, OptimizerOutbound } from '../engine/optimizer-worker';
import { choleskyFrom, Screen, type ScreenDoc } from '../learning/screen';
import type { Scalers } from '../learning/surrogate';

// OP-09: the optimizer's worker runs the screened optimizer at the requested weight, streams its progress one
// pattern-search run at a time and answers with the record the synchronous run gives; the client supersedes an
// older run with a newer one and cancels a run by terminating the optimizer's worker, and keeps the worker (with
// its loaded screen) after a run that finished. The worker module runs against stand-ins for the worker scope and
// for fetch, which serves the models directory; the client runs against a stand-in Worker. OF_DERIVED and OF_MODELS
// point a development run at a sandbox bake.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const models = process.env.OF_MODELS ?? fileURLToPath(new URL('../../../models/', import.meta.url));
const contract = JSON.parse(readFileSync(join(derived, 'contract', 'operating_contract.json'), 'utf-8')) as OperatingContract;
const artifact = JSON.parse(readFileSync(join(derived, 'cases', 'iron_magnetite_fine.json'), 'utf-8')) as {
  definition: { ore: Ore; plant: Plant }; variants: Array<{ point: OperatingPoint }>;
};
const { ore, plant } = artifact.definition;
const point = artifact.variants[0].point;

const serve = (url: string) => {
  const file = join(models, decodeURIComponent(url.split('?')[0].replace(/^.*models\//, '')));
  const bytes = readFileSync(file);
  return { json: async () => JSON.parse(bytes.toString('utf-8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};

const posted: OptimizerOutbound[] = [];
let send: (message: OptimizerInbound) => void = () => undefined;

beforeAll(async () => {
  vi.stubGlobal('fetch', async (url: string) => serve(url));
  const scope: { onmessage: ((event: { data: OptimizerInbound }) => void) | null; postMessage: (message: OptimizerOutbound) => void } = {
    onmessage: null, postMessage: message => { posted.push(message); },
  };
  (globalThis as unknown as { self: typeof scope }).self = scope;
  await import('../engine/optimizer-worker');
  send = message => scope.onmessage?.({ data: message });
});
afterAll(() => { vi.unstubAllGlobals(); });

async function settle(predicate: () => boolean, ms = 240000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > ms) throw new Error('the worker did not settle');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

describe('the optimizer worker', () => {
  it('streams progress and answers with the synchronous record at the requested weight', async () => {
    send({ type: 'optimize', id: 71, caseId: 'iron_magnetite_fine', ore, plant, point, contract, weight: 0.5 });
    await settle(() => posted.some(m => m.id === 71 && m.type !== 'progress'));
    const reply = posted.find(m => m.id === 71 && m.type === 'record') as { record: OptimizationRecord } | undefined;
    expect(reply, JSON.stringify(posted.find(m => m.type === 'error'))).toBeDefined();
    const progress = posted.filter(m => m.id === 71 && m.type === 'progress') as Array<{ done: number; total: number }>;
    expect(progress.map(p => p.done)).toEqual(Array.from({ length: progress[0].total }, (_, i) => i + 1));
    const doc = JSON.parse(readFileSync(join(models, 'process_screen.json'), 'utf-8')) as ScreenDoc;
    const scalers = JSON.parse(readFileSync(join(models, 'process_surrogate.json'), 'utf-8')) as Scalers;
    const bin = readFileSync(join(models, doc.gp.cholesky.file));
    const screen = new Screen(doc, scalers, choleskyFrom(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)));
    const expected = optimize('iron_magnetite_fine', ore, plant, point, contract, { weight: 0.5, screen: screen.forCase(ore, plant) });
    expect(reply!.record).toEqual(expected);
    expect(reply!.record.weights).toEqual({ recovered_metal: 0.5, energy: 0.5 });
  }, 300_000);
});

describe('the optimizer client', () => {
  it('supersedes, cancels by terminating, and keeps a worker that finished', async () => {
    class FakeWorker {
      static made: FakeWorker[] = [];
      onmessage: ((event: { data: OptimizerOutbound }) => void) | null = null;
      onerror: ((event: { message: string }) => void) | null = null;
      requests: OptimizerInbound[] = [];
      terminated = false;
      constructor() { FakeWorker.made.push(this); }
      postMessage(message: OptimizerInbound) { this.requests.push(message); }
      terminate() { this.terminated = true; }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const { cancelOptimize, optimizeInWorker } = await import('../engine/client');
    const progress: number[] = [];
    const first = optimizeInWorker('iron_magnetite_fine', ore, plant, point, contract, 1, d => progress.push(d));
    const firstOutcome = first.done.then(() => 'resolved', (e: Error) => e.message);
    const second = optimizeInWorker('iron_magnetite_fine', ore, plant, point, contract, 0.75, d => progress.push(d));
    expect(await firstOutcome).toBe('superseded');
    expect(FakeWorker.made).toHaveLength(2);
    expect(FakeWorker.made[0].terminated).toBe(true);
    const worker = FakeWorker.made[1];
    expect(worker.requests[0]).toMatchObject({ type: 'optimize', id: second.id, weight: 0.75 });
    worker.onmessage!({ data: { type: 'progress', id: first.id, done: 9, total: 9 } });   // a stale reply is ignored
    worker.onmessage!({ data: { type: 'progress', id: second.id, done: 1, total: 15 } });
    const record = { status: 'optimal' } as unknown as OptimizationRecord;
    worker.onmessage!({ data: { type: 'record', id: second.id, record, ms: 1 } });
    expect(await second.done).toBe(record);
    expect(progress).toEqual([1]);
    expect(worker.terminated).toBe(false);

    const third = optimizeInWorker('iron_magnetite_fine', ore, plant, point, contract, 0.25, () => undefined);
    expect(FakeWorker.made).toHaveLength(2);                 // the finished worker is reused
    const thirdOutcome = third.done.then(() => 'resolved', (e: Error) => e.message);
    cancelOptimize(third.id);
    expect(await thirdOutcome).toBe('cancelled');
    expect(worker.terminated).toBe(true);
  });
});
