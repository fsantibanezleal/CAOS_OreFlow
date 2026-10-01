import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { OperatingPoint, Ore, Plant } from '../engine';
import { uncertainty } from '../engine/uncertainty';
import type { Inbound, Outbound } from '../engine/worker';

// UQ-06: the worker re-runs the uncertainty record at a seed and sample count, streams its progress one engine
// run at a time, answers with the same record the synchronous run gives, and stops between runs when a newer
// run or a cancel arrives. The worker module runs against a stand-in for the worker scope, as in worker-sweeps.
const artifact = JSON.parse(readFileSync(fileURLToPath(new URL('../../../data/derived/cases/copper_porphyry_soft.json', import.meta.url)), 'utf-8')) as {
  definition: { ore: Ore; plant: Plant }; variants: Array<{ point: OperatingPoint }>;
};
const { ore, plant } = artifact.definition;
const point = artifact.variants[0].point;
const posted: Outbound[] = [];
let send: (message: Inbound) => void = () => undefined;

beforeAll(async () => {
  const scope: { onmessage: ((event: { data: Inbound }) => void) | null; postMessage: (message: Outbound) => void } = {
    onmessage: null, postMessage: message => { posted.push(message); },
  };
  (globalThis as unknown as { self: typeof scope }).self = scope;
  await import('../engine/worker');
  send = message => scope.onmessage?.({ data: message });
});

async function settle(predicate: () => boolean, ms = 60000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > ms) throw new Error('the worker did not settle');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
const of = (id: number) => posted.filter(m => m.id === id);

describe('the worker re-runs the uncertainty record', () => {
  it('streams progress and answers with the synchronous record', async () => {
    send({ type: 'uncertainty', id: 901, ore, plant, point, samples: 32, seed: 7 });
    await settle(() => of(901).some(m => m.type === 'record' || m.type === 'error'));
    const progress = of(901).filter(m => m.type === 'progress').map(m => (m as { done: number }).done);
    expect(progress).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    const reply = of(901).find(m => m.type === 'record') as { record: ReturnType<typeof uncertainty> };
    expect(reply.record).toEqual(uncertainty(ore, plant, point, 32, 7));
  }, 120_000);

  it('stops between runs on a cancel, and a newer run supersedes an older one', async () => {
    send({ type: 'uncertainty', id: 902, ore, plant, point, samples: 64, seed: 11 });
    await settle(() => of(902).some(m => m.type === 'progress'));
    send({ type: 'cancel', id: 902 });
    const count = of(902).length;
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(of(902).length).toBeLessThanOrEqual(count + 1); // at most the run already in progress reports
    expect(of(902).some(m => m.type === 'record')).toBe(false);

    send({ type: 'uncertainty', id: 903, ore, plant, point, samples: 64, seed: 12 });
    await settle(() => of(903).some(m => m.type === 'progress'));
    send({ type: 'uncertainty', id: 904, ore, plant, point, samples: 32, seed: 13 });
    await settle(() => of(904).some(m => m.type === 'record'));
    expect(of(903).some(m => m.type === 'record')).toBe(false);
  }, 120_000);
});
