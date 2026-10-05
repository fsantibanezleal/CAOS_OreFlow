import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import type { OperatingContract } from '../engine/contract';
import type { OperatingPoint, Ore, Plant } from '../engine/model';
import { optimize } from '../engine/optimize';
import { evaluateSample, perturbed, uncertainty } from '../engine/uncertainty';

// M-01, M-03, M-05 (implementation review of 2026-10-04), as tests/test_uncertainty.py and tests/test_optimization.py.
const root = process.env.OF_DERIVED ? join(process.env.OF_DERIVED, 'cases') : fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
type Baked = { definition: { ore: Ore; plant: Plant }; variants: Array<{ id: string; point: OperatingPoint }> };
const load = (id: string) => JSON.parse(readFileSync(join(root, `${id}.json`), 'utf-8')) as Baked;
const contract = contractDoc as unknown as OperatingContract;

describe('uncertainty', () => {
  it('the floatability factor reaches electrum (M-03)', () => {
    const a = load('gold_free_milling');
    const [ore] = perturbed(a.definition.ore, a.variants[0].point, { floatability: 1.1 });
    const before = a.definition.ore.minerals.find(m => m.id === 'electrum')!;
    const after = ore.minerals.find(m => m.id === 'electrum')!;
    expect(Math.abs(after.flotation!.floatability / (1.1 * before.flotation!.floatability) - 1)).toBeLessThan(1e-15);
  });

  it('the record says which draws the values belong to (M-01)', () => {
    const a = load('copper_porphyry_hard');
    const point = a.variants.find(v => v.id === 'cut_finer')!.point;
    const record = uncertainty(a.definition.ore, a.definition.plant, point, 24, 7);
    const refused = Object.values(record.refused).reduce((s, n) => s + n, 0);
    expect(refused).toBeGreaterThan(0);
    expect(record.solved.length).toBe(24 - refused);
    const names = Object.keys(record.inputs);
    const j = record.solved.length - 1;
    const row = record.factors[record.solved[j]];
    const again = evaluateSample(a.definition.ore, a.definition.plant, point, Object.fromEntries(names.map((n, k) => [n, row[k]])));
    expect('outputs' in again && Math.abs(again.outputs.recovery_pct / record.outputs.recovery_pct.values[j] - 1)).toBeLessThan(1e-12);
  }, 120000);
});

describe('optimizer', () => {
  it('a refused base has no optimum (M-05)', () => {
    const a = load('copper_porphyry_hard');
    const point = a.variants.find(v => v.id === 'cut_finer')!.point;
    const base = { ...point, work_index_kwh_t: 1.15 * point.work_index_kwh_t };
    const record = optimize('copper_porphyry_hard', a.definition.ore, a.definition.plant, base, contract, { weight: 0.5, path: false });
    expect(record.status).toBe('base_refused');
    expect(record.optimum).toBeNull();
    expect((record.refused ?? []).length).toBeGreaterThan(0);
  }, 120000);
});
