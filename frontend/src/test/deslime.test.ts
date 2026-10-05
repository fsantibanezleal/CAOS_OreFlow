import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { simulate } from '../engine/circuit';
import { InfeasibleState, type OperatingPoint, type Ore, type Plant } from '../engine/model';

// P-04, K-02 (implementation review of 2026-10-04), as tests/test_separation.py.
const root = process.env.OF_DERIVED ? join(process.env.OF_DERIVED, 'cases') : fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
type Baked = { definition: { ore: Ore; plant: Plant }; variants: Array<{ id: string; point: OperatingPoint }> };
const load = (id: string) => JSON.parse(readFileSync(join(root, `${id}.json`), 'utf-8')) as Baked;

describe('desliming', () => {
  it('the underflow leaves at its declared density (P-04)', () => {
    const a = load('phosphate_clay');
    // the definition of 0.09.000 declares the underflow density; a record baked before it carries the old bypass
    const plant = { ...a.definition.plant, deslime: { sharpness: 2.5, underflow_solids: 0.7 } } as Plant;
    const point = { ...a.variants[0].point, water_m3_t: 1.0, deslime_cut_um: 8.0 } as OperatingPoint;
    const u = simulate(a.definition.ore, plant, point).streams.deslime_underflow;
    expect(Math.abs(u.tph() / (u.tph() + u.water) - 0.7)).toBeLessThan(1e-12);
  });

  it('the cut mode refuses a desliming cut above half the achieved product (K-02)', () => {
    const a = load('phosphate_clay');
    const plant = { ...a.definition.plant, deslime: { sharpness: 2.5, underflow_solids: 0.7 } } as Plant;
    const point = { ...a.variants[0].point, throughput_tph: 235.0, d50c_um: 150.7, deslime_cut_um: 45.0 } as OperatingPoint;
    let refusal: unknown = null;
    try { simulate(a.definition.ore, plant, point); } catch (error) { refusal = error; }
    expect(refusal).toBeInstanceOf(InfeasibleState);
    expect((refusal as InfeasibleState).code).toBe('deslime_cut_above_half_p80');
  });
});
