import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import type { OperatingContract, OperatingPoint, Ore, Plant } from '../engine';
import type { SweepRequest } from '../engine/sweep';
import type { Inbound, Outbound } from '../engine/worker';

// PE-38: the engine worker streams a sweep cell by cell, a newer sweep or a cancel stops the one in
// progress between cells, and an evaluation replies with the trace of exactly the state it was sent.
// The worker module runs here against a stand-in for the worker scope; that sweeps start only from an
// explicit request, never from a slider event, is checked statically by scripts/check_ui_formulas.py.
const contract = contractDoc as unknown as OperatingContract;
const artifact = JSON.parse(readFileSync(fileURLToPath(new URL('../../../data/derived/cases/copper_porphyry_soft.json', import.meta.url)), 'utf-8')) as {
  case_id: string; definition: { ore: Ore; plant: Plant }; nominal: OperatingPoint;
};
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

const idle = () => new Promise(resolve => setTimeout(resolve, 30));
async function settle(predicate: () => boolean, ms = 60000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > ms) throw new Error('the worker did not settle');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
const of = (id: number) => posted.filter(m => m.id === id);
const request = (id: number, values: number[]): SweepRequest => ({
  id, caseId: artifact.case_id, ore: artifact.definition.ore, plant: artifact.definition.plant, base: artifact.nominal,
  axes: [{ input: 'target_p80_um', values }], outputs: ['recovery_pct', 'p80_um'],
});
const grind = (n: number) => {
  const { min, max } = contract.cases[artifact.case_id].inputs.target_p80_um;
  return Array.from({ length: n }, (_, i) => min + (max - min) * i / (n - 1));
};

describe('the engine worker', () => {
  it('streams a sweep cell by cell and then reports it done', async () => {
    send({ type: 'sweep', request: request(1, grind(4)), contract });
    await settle(() => of(1).some(m => m.type === 'done'));
    const cells = of(1).filter(m => m.type === 'cell');
    expect(cells.map(m => (m.type === 'cell' ? m.done : 0))).toEqual([1, 2, 3, 4]);
    const done = of(1).find(m => m.type === 'done');
    expect(done?.type === 'done' && done.cells.length).toBe(4);
    for (const m of cells) if (m.type === 'cell') expect(Object.keys(m.cell.metrics).sort()).toEqual(['p80_um', 'recovery_pct']);
  });

  it('stops a sweep between cells when a newer one starts', async () => {
    send({ type: 'sweep', request: request(2, grind(9)), contract });
    send({ type: 'sweep', request: request(3, grind(3)), contract });
    await settle(() => of(3).some(m => m.type === 'done'));
    await idle();
    expect(of(2).filter(m => m.type === 'cell').length).toBe(1);
    expect(of(2).some(m => m.type === 'done')).toBe(false);
    expect(of(3).filter(m => m.type === 'cell').length).toBe(3);
  });

  it('stops a sweep between cells on cancel', async () => {
    send({ type: 'sweep', request: request(4, grind(9)), contract });
    send({ type: 'cancel', id: 4 });
    await idle();
    await idle();
    expect(of(4).filter(m => m.type === 'cell').length).toBe(1);
    expect(of(4).some(m => m.type === 'done')).toBe(false);
  });

  it('answers an evaluation with the trace of the state it was sent', async () => {
    const point = { ...artifact.nominal, target_p80_um: grind(3)[1] };
    send({ type: 'evaluate', id: 5, ore: artifact.definition.ore, plant: artifact.definition.plant, point });
    await settle(() => of(5).length > 0);
    const reply = of(5)[0];
    expect(reply.type).toBe('trace');
    if (reply.type === 'trace') expect((reply.trace.point as unknown as OperatingPoint).target_p80_um).toBe(point.target_p80_um);
  });
});
