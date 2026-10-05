import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { simulate } from '../engine/circuit';
import { bank, pulpFlowM3Min, rateConstants } from '../engine/flotation';
import { grid } from '../engine/grid';
import { kineticRecord } from '../engine/kinetics';
import type { OperatingPoint, Ore, Plant } from '../engine/model';
import { speciesDefs, type SpeciesDef } from '../engine/species';

// F-01, F-02, F-07, F-08 (implementation review of 2026-10-04), the same checks as tests/test_flotation.py and
// tests/test_kinetics.py.
const root = process.env.OF_DERIVED ? join(process.env.OF_DERIVED, 'cases') : fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
type Baked = { definition: { ore: Ore; plant: Plant }; variants: Array<{ id: string; point: OperatingPoint }> };
const load = (id: string) => JSON.parse(readFileSync(join(root, `${id}.json`), 'utf-8')) as Baked;
const ONE: SpeciesDef[] = [{ id: 'a', mineral: 'a', kind: 'free', makeup: [['a', 1.0]], density: 2.7 } as SpeciesDef];

describe('flotation cells', () => {
  it('a cell takes its residence on its own tail flow (F-02)', () => {
    const n = grid().n;
    const bankDef = { cell_volume_m3: 100.0, gas_holdup: 0.12, wash_factor: 1.0 } as never;
    const feed = { a: new Float64Array(n).fill(600.0 / n) };
    const result = bank({ a: new Float64Array(n).fill(3.0) }, new Float64Array(n).fill(0.5), 1, bankDef, feed, 900.0, ONE, 40.0, 2.0e-5);
    const r = result.cell_recovery[0].a;
    const tail = pulpFlowM3Min({ a: Float64Array.from(feed.a, (v, i) => v * (1.0 - r[i])) }, ONE, 900.0 * (1.0 - result.water_recovery));
    const tau = 100.0 * (1.0 - 0.12) / tail;
    expect(Math.abs(result.cell_residence_min[0] / tau - 1.0)).toBeLessThan(1e-12);
    const w = 60.0 * 2.0e-5 * 40.0 * tau;
    expect(Math.abs(r[0] - (3.0 * tau + 0.5 * w) / (1.0 + 3.0 * tau + 0.5 * w))).toBeLessThan(1e-12);
  });

  it('a composite floats on the valuable volume share (F-01)', () => {
    const a = load('copper_porphyry_soft');
    const result = simulate(a.definition.ore, a.definition.plant, a.variants[0].point);
    const ore = result.ore;
    const rates = rateConstants(ore, speciesDefs(ore), 50.0, 30.0);
    const c = ore.spec.chalcopyrite.composite_content;
    const phi = (c / ore.density.chalcopyrite) / (c / ore.density.chalcopyrite + (1.0 - c) / ore.density[ore.host]);
    const i = 30;
    expect(Math.abs(rates['chalcopyrite:composite'][i] / rates['chalcopyrite:liberated'][i] / phi ** (2.0 / 3.0) - 1.0)).toBeLessThan(1e-12);
  });
});

describe('kinetic fits (F-07, F-08)', () => {
  it('a curve without signal is not fitted', () => {
    const a = load('copper_oxide');
    const point = { ...a.variants[0].point, collector_gpt: 0.0 } as OperatingPoint;
    const result = simulate(a.definition.ore, a.definition.plant, point);
    const record = kineticRecord(result.flotation!, result.ore, point.rougher_cells, result.metrics.rougher_recovery_pct);
    expect(record.status).toBe('no_signal');
    expect(record.models).toBeUndefined();
  });

  it('a fit says which bound it rests on', () => {
    const a = load('gold_free_milling');
    const point = a.variants[0].point;
    const result = simulate(a.definition.ore, a.definition.plant, point);
    const record = kineticRecord(result.flotation!, result.ore, point.rougher_cells, result.metrics.rougher_recovery_pct) as { models: Array<{ id: string; at_bound: string[]; parameters: Record<string, number> }> };
    for (const m of record.models) expect(m.at_bound.includes('R_inf'), m.id).toBe(Math.abs(m.parameters.R_inf - 100.0) <= 1e-7);
    expect(record.models.find(m => m.id === 'klimpel')!.at_bound).toEqual(['R_inf']);
  });
});
