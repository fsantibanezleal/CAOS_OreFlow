import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import { gridPoints, sweep, type OperatingContract, type SweepRequest } from '../engine';

const contract = contractDoc as unknown as OperatingContract;
const artifact = JSON.parse(readFileSync(fileURLToPath(new URL('../../../data/derived/cases/phosphate_clay.json', import.meta.url)), 'utf-8'));

describe('operating-point sweeps', () => {
  it('enumerates the grid in row-major order', () => {
    const cells = gridPoints([{ input: 'a', values: [1, 2] }, { input: 'b', values: [10, 20, 30] }]);
    expect(cells).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
    expect(gridPoints([])).toEqual([[]]);
  });

  it('validates every state first and never simulates a rejected one', () => {
    const bounds = contract.cases.phosphate_clay.inputs;
    const request: SweepRequest = {
      id: 1, caseId: 'phosphate_clay', ore: artifact.definition.ore, plant: artifact.definition.plant, base: artifact.nominal,
      // the desliming rule rejects a 45 um cut against a 75 um grind target
      axes: [{ input: 'target_p80_um', values: [bounds.target_p80_um.min, artifact.nominal.target_p80_um] },
        { input: 'deslime_cut_um', values: [20, bounds.deslime_cut_um.max] }],
      outputs: ['recovery_pct', 'slimes_loss_pct'],
    };
    const seen: number[] = [];
    const cells = sweep(request, contract, (_, done) => seen.push(done));
    expect(seen).toEqual([1, 2, 3, 4]);
    const rejected = cells.filter(c => !c.accepted);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].errors).toEqual(['deslime_cut_above_half_target']);
    expect(rejected[0].metrics).toEqual({});
    for (const cell of cells.filter(c => c.accepted)) expect(Object.keys(cell.metrics).sort()).toEqual(['recovery_pct', 'slimes_loss_pct']);
  });
});

// M-04 (implementation review of 2026-10-04): every grid the views build keeps both declared bounds exactly, so the
// maximum is never rejected as out of range.
describe('sweep grids keep both bounds exactly (M-04)', () => {
  it('every input of every case, every count the views use', async () => {
    const { gridValues } = await import('../engine/sweep');
    const { validate } = await import('../engine/contract');
    const doc = (await import('../../../data/derived/contract/operating_contract.json')).default as unknown as import('../engine/contract').OperatingContract;
    const integer: Record<string, boolean> = {};
    for (const spec of doc.inputs) integer[spec.name] = spec.integer;
    for (const [caseId, entry] of Object.entries(doc.cases)) {
      for (const [name, bounds] of Object.entries(entry.inputs)) {
        for (let n = 3; n <= 21; n += 1) {
          const values = gridValues(bounds.min, bounds.max, n, integer[name]);
          expect(values[0], `${caseId} ${name} ${n}`).toBe(bounds.min);
          expect(values[values.length - 1], `${caseId} ${name} ${n}`).toBe(bounds.max);
          for (const v of [values[values.length - 1]]) expect(validate(doc, caseId, { [name]: v }).errors.map(e => e.code).filter(c => c === 'out_of_range')).toEqual([]);
        }
      }
    }
  });
});
