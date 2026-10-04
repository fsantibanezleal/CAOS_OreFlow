import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import type { OperatingContract } from '../engine/contract';
import { simulate } from '../engine/circuit';
import { InfeasibleState, type OperatingPoint, type Ore, type Plant } from '../engine/model';
import { sweepCell } from '../engine/sweep';
import { uncertainty } from '../engine/uncertainty';

// E-01 (review of 2026-10-02): the browser refuses the cut-mode states with no steady state at installed power that
// the bake and the service refuse, with the same code. Until 0.08.000 both engines returned them as solved, with loads
// of millions of percent. OF_DERIVED points a development run at a sandbox bake.
const root = process.env.OF_DERIVED ? join(process.env.OF_DERIVED, 'cases') : fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
type Baked = {
  case_id: string; definition: { ore: Ore; plant: Plant };
  variants: Array<{ id: string; point: OperatingPoint; methods: { uncertainty: { samples: number; seed: number; refused: Record<string, number>; outputs: Record<string, { values: number[] }>; probabilities: Record<string, number> } } }>;
};
const load = (id: string) => JSON.parse(readFileSync(join(root, `${id}.json`), 'utf-8')) as Baked;
const contract = contractDoc as unknown as OperatingContract;

const REFUSED: Array<[string, Partial<OperatingPoint>]> = [
  ['copper_porphyry_soft', { throughput_tph: 1080.0, d50c_um: 147.127261101 }],
  ['copper_porphyry_soft', { work_index_kwh_t: 16.5, d50c_um: 147.127261101 }],
  ['iron_magnetite_fine', { water_m3_t: 1.0, d50c_um: 65.3 }],
];

describe('the browser refuses a cut-mode state without a steady state (E-01)', () => {
  it.each(REFUSED)('%s %o', (caseId, change) => {
    const a = load(caseId);
    const point = { ...a.variants[0].point, ...change } as OperatingPoint;
    let refusal: unknown = null;
    try { simulate(a.definition.ore, a.definition.plant, point); } catch (error) { refusal = error; }
    expect(refusal).toBeInstanceOf(InfeasibleState);
    expect(['power_unreachable_at_cut', 'circulating_load_above_bound']).toContain((refusal as InfeasibleState).code);
  });

  it('a refused sweep cell is a rejected cell with the code', () => {
    const a = load('copper_porphyry_soft');
    const cell = sweepCell({ caseId: 'copper_porphyry_soft', ore: a.definition.ore, plant: a.definition.plant, base: { ...a.variants[0].point, throughput_tph: 1080.0 },
      axes: [{ input: 'd50c_um', values: [147.127261101] }], outputs: ['recovery_pct'] } as never, contract, [0]);
    expect(cell.accepted).toBe(false);
    expect(cell.errors).toEqual(['power_unreachable_at_cut']);
  });

  it('the cut variants\' uncertainty records count their refused draws as the bake does', () => {
    for (const id of ['copper_porphyry_hard', 'copper_porphyry_soft']) {
      const a = load(id);
      const v = a.variants.find(x => x.id === 'cut_finer')!;
      const baked = v.methods.uncertainty;
      const mine = uncertainty(a.definition.ore, a.definition.plant, v.point, baked.samples, baked.seed);
      expect(mine.refused, id).toEqual(baked.refused);
      const refused = Object.values(baked.refused).reduce((s, n) => s + n, 0);
      expect(mine.outputs.recovery_pct.values.length, id).toBe(baked.samples - refused);
    }
  }, 180000);   // 2 x 128 engine evaluations: about 15 s alone, more beside the other suites
});
