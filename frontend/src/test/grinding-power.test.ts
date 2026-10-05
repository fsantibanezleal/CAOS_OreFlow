import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { simulate } from '../engine/circuit';
import type { OperatingPoint, Ore, Plant } from '../engine/model';

// C-03, P-05, K-07 (implementation review of 2026-10-04): the energy per pass acts on the mill feed, which with the
// gravity unit on the underflow is the new feed plus the underflow less the gravity concentrate; 0.08.001 counted the
// concentrate (4.3e-4 too much power at a bleed of 0.6). P-02: the partition curve is the one the circuit applies.
const root = process.env.OF_DERIVED ? join(process.env.OF_DERIVED, 'cases') : fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
type Baked = { definition: { ore: Ore; plant: Plant }; variants: Array<{ id: string; point: OperatingPoint }> };
const load = (id: string) => JSON.parse(readFileSync(join(root, `${id}.json`), 'utf-8')) as Baked;

describe('mill power on the mill feed (C-03)', () => {
  it.each([0.1, 0.6])('gold, gravity bleed %s', bleed => {
    const a = load('gold_free_milling');
    const point = { ...a.variants[0].point, gravity_bleed: bleed } as OperatingPoint;
    const g = simulate(a.definition.ore, a.definition.plant, point).grinding;
    const millFeed = g.streams.mill_feed.tph();
    expect(Math.abs(g.power_kw / (g.energy_per_pass_kwh_t * millFeed) - 1.0)).toBeLessThan(1e-12);
    expect(Math.abs(g.specific_energy_kwh_t / (g.energy_per_pass_kwh_t * millFeed / g.streams.new_feed.tph()) - 1.0)).toBeLessThan(1e-12);
  });
});

describe('the reported partition is the applied one (P-02)', () => {
  it.each(['copper_porphyry_soft', 'gold_free_milling', 'iron_magnetite_fine'])('%s', id => {
    const a = load(id);
    const result = simulate(a.definition.ore, a.definition.plant, a.variants[0].point);
    const g = result.grinding;
    const feed = g.streams.sump_feed ?? g.streams.cyclone_feed;
    const under = g.streams.cyclone_underflow;
    for (const [key, curve] of Object.entries(g.partition)) {
      const m = key === 'host' ? result.ore.host : key;
      let shown = 0;
      curve.forEach((share, i) => {
        if (share === null) return;
        shown += 1;
        expect(Math.abs(share - under.solids[m][i] / feed.solids[m][i])).toBeLessThanOrEqual(1e-12 * Math.abs(share));
      });
      expect(shown).toBeGreaterThan(0);
    }
  });
});

describe('a trial point flag does not reach the reported state (K-13)', () => {
  it('iron cut-mode corner', () => {
    const a = load('iron_magnetite_fine');
    const point = { ...a.variants[0].point, throughput_tph: 460.0, water_m3_t: 4.0, crusher_css_mm: 4.0, work_index_kwh_t: 9.45,
      head_grade: 44.55, d50c_um: 130.651135861 } as OperatingPoint;
    const codes = simulate(a.definition.ore, a.definition.plant, point).flags.map(f => f.code);
    expect(codes).not.toContain('composite_scale_not_converged');
    expect(codes).toContain('circulating_load_out_of_range');
  });
});
