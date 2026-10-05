import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { audit, type Unit } from '../engine/balance';
import { simulate } from '../engine/circuit';
import type { OperatingPoint, Ore, Plant } from '../engine/model';

// K-01, C-02 (implementation review of 2026-10-04), as tests/test_engine_balances.py and tests/test_energy.py.
const root = process.env.OF_DERIVED ? join(process.env.OF_DERIVED, 'cases') : fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
type Baked = { definition: { ore: Ore; plant: Plant }; variants: Array<{ id: string; point: OperatingPoint }> };
const load = (id: string) => JSON.parse(readFileSync(join(root, `${id}.json`), 'utf-8')) as Baked;

describe('the audit', () => {
  it('sees a size-class error at a non-breakage unit, and audits the mill by its own equation', () => {
    const a = load('copper_porphyry_soft');
    const result = simulate(a.definition.ore, a.definition.plant, a.variants[0].point);
    const units = (): Unit[] => result.topology.map(u => [u.unit, u.inputs.map(n => result.streams[n]), u.outputs.map(n => result.streams[n]), u.water_added_tph]);
    expect(audit(units(), result.ore).max_relative_error).toBeLessThan(1e-9);
    expect(result.balance.units.mill_equation).toBeLessThan(1e-12);
    const host = result.ore.host;
    const v = result.streams.cyclone_overflow.solids[host];
    const original = Float64Array.from(v);
    for (let i = 0; i < v.length; i += 1) v[i] = original[(i + v.length - 1) % v.length];
    expect(audit(units(), result.ore).max_relative_error).toBeGreaterThan(1e-3);
  });

  it('qualifies the Bond efficiency below 70 um (C-02)', () => {
    const a = load('iron_magnetite_fine');
    const codes = simulate(a.definition.ore, a.definition.plant, a.variants[0].point).flags.map(f => f.code);
    expect(codes).toContain('bond_efficiency_fine_product');
  });
});
