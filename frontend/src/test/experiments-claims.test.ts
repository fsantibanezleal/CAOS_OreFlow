import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VARIANT_KINDS } from '../content/design';

// The Experiments page states the design, the protocols and what every variant did; each of those
// statements is checked here against the committed artifacts, so a bake that changes a factor, a count
// or a direction fails instead of shipping text the engine no longer supports.
const derived = fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const read = <T>(path: string): T => JSON.parse(readFileSync(join(derived, path), 'utf-8')) as T;

type Metrics = Record<string, number | boolean | string[]>;
const benchmark = read<{
  cases: Array<{ case_id: string; family: string; kpis: Record<string, { within: boolean }>; variants: Record<string, Metrics> }>;
  kinetics: Record<string, { fits: number; converged_share: number }>;
  optimization: Record<string, Record<string, { decisions: Record<string, number> | null }>>;
}>('benchmark.json');
const learning = read<{
  design: { rows: number; per_case: number };
  interpolation: { train_rows: number; test_rows: number };
  leave_one_case_out: Array<{ train_rows: number; test_rows: number }>;
  guard: { in_envelope_rows: number; probe_rows: number };
}>('learning.json');

const MAGNETITE = 'iron_magnetite_fine';
const all = benchmark.cases.map(c => c.case_id);
/** The change of a metric under a variant, for every case that carries it. */
function changes(variant: string, metric: string) {
  return benchmark.cases.filter(c => c.variants[variant]).map(c => ({
    id: c.case_id,
    delta: (c.variants[variant][metric] as number) - (c.variants.nominal[metric] as number),
    limited: c.variants[variant].power_limited as boolean,
  }));
}
const rises = (rows: Array<{ delta: number }>) => rows.filter(r => r.delta > 0).length;
const falls = (rows: Array<{ delta: number }>) => rows.filter(r => r.delta < 0).length;
const ids = (rows: Array<{ id: string; delta: number }>, sign: 1 | -1) => rows.filter(r => sign * r.delta > 0).map(r => r.id).sort();
/** The rounded range the text quotes, at the decimals it quotes. */
const range = (rows: Array<{ delta: number }>, decimals: number) => {
  const values = rows.map(r => r.delta);
  return [Math.min(...values), Math.max(...values)].map(v => Number(v.toFixed(decimals)));
};

describe('the Experiments page says what the bake did', () => {
  it('declares the factor every case artifact applies, for every variant a case carries', () => {
    const kinds = Object.fromEntries(VARIANT_KINDS.map(k => [k.id, k]));
    for (const id of all) {
      const artifact = read<{ variants: Array<{ id: string; change: Record<string, number> }> }>(`cases/${id}.json`);
      for (const v of artifact.variants.slice(1)) {
        const kind = kinds[v.id];
        expect(kind, `${id}:${v.id}`).toBeDefined();
        expect(v.change, `${id}:${v.id}`).toEqual({ [kind.input]: kind.except?.[id] ?? kind.factor });
      }
      expect(artifact.variants[0].id).toBe('nominal');
      expect(artifact.variants).toHaveLength(6);
    }
  });

  it('matches the coverage and protocol numbers it quotes', () => {
    for (const record of Object.values(benchmark.kinetics)) {
      expect(record.fits).toBe(66); // every variant of the eleven cases with flotation
      expect(record.converged_share).toBe(1);
    }
    for (const c of benchmark.cases) {
      const decisions = Object.keys(benchmark.optimization[c.case_id].nominal.decisions ?? {}).sort();
      expect(decisions, c.case_id).toEqual(c.family === 'magnetic' ? ['target_p80_um'] : ['collector_gpt', 'jg_cm_s', 'target_p80_um']);
    }
    const soft = read<{ variants: Array<{ methods: Record<string, { samples?: number; base_samples?: number }>; trace: { methods: { kinetics: { times_min: number[] } } } }> }>('cases/copper_porphyry_soft.json');
    expect(soft.variants[0].methods.uncertainty.samples).toBe(128);
    expect(soft.variants[0].methods.sensitivity.base_samples).toBe(256);
    const times = soft.variants[0].trace.methods.kinetics.times_min;
    expect([times[0], times.at(-1)]).toEqual([0.5, 16]);
    expect([learning.design.rows, learning.design.per_case]).toEqual([3072, 256]);
    expect([learning.interpolation.train_rows, learning.interpolation.test_rows]).toEqual([2460, 612]);
    expect(learning.leave_one_case_out).toHaveLength(12);
    for (const fold of learning.leave_one_case_out) expect([fold.train_rows, fold.test_rows]).toEqual([2816, 256]);
    expect([learning.guard.in_envelope_rows, learning.guard.probe_rows]).toEqual([612, 11016]);
  });

  it('no nominal state is power-limited and every plausibility check holds', () => {
    for (const c of benchmark.cases) {
      expect(c.variants.nominal.power_limited, c.case_id).toBe(false);
      for (const [key, kpi] of Object.entries(c.kpis)) expect(kpi.within, `${c.case_id}:${key}`).toBe(true);
    }
  });

  it('harder ore: installed power everywhere, coarser product, more energy, lower grade; recovery falls except in magnetite', () => {
    const p80 = changes('harder_ore', 'p80_um');
    expect(p80.every(r => r.limited)).toBe(true);
    expect(rises(p80)).toBe(12);
    expect(range(p80, 0)).toEqual([9, 64]);
    const energy = changes('harder_ore', 'specific_energy_total_kwh_t');
    expect(rises(energy)).toBe(12);
    expect(range(energy, 1)).toEqual([0.5, 2.6]);
    expect(falls(changes('harder_ore', 'concentrate_grade'))).toBe(12);
    expect(ids(changes('harder_ore', 'recovery_pct'), 1)).toEqual([MAGNETITE]);
    expect(falls(changes('harder_ore', 'recovery_pct'))).toBe(11);
  });

  it('a coarser grind saves energy and lowers grade everywhere; recovery falls except in magnetite', () => {
    const energy = changes('coarser_grind', 'specific_energy_total_kwh_t');
    expect(falls(energy)).toBe(12);
    expect(range(energy, 1)).toEqual([-3.5, -1.0]);
    expect(falls(changes('coarser_grind', 'concentrate_grade'))).toBe(12);
    expect(ids(changes('coarser_grind', 'recovery_pct'), 1)).toEqual([MAGNETITE]);
    expect(falls(changes('coarser_grind', 'recovery_pct'))).toBe(11);
  });

  it('higher throughput: installed power, less energy per tonne, more metal per hour, less recovery except in magnetite', () => {
    const energy = changes('higher_throughput', 'specific_energy_total_kwh_t');
    expect(energy.every(r => r.limited)).toBe(true);
    expect(falls(energy)).toBe(12);
    expect(range(energy, 1)).toEqual([-2.8, -0.5]);
    expect(rises(changes('higher_throughput', 'p80_um'))).toBe(12);
    expect(rises(changes('higher_throughput', 'recovered_primary_tph'))).toBe(12);
    expect(ids(changes('higher_throughput', 'recovery_pct'), 1)).toEqual([MAGNETITE]);
    const grade = changes('higher_throughput', 'concentrate_grade');
    expect(rises(grade)).toBe(9);
    expect(ids(grade, -1)).toEqual(['copper_porphyry_hard', MAGNETITE, 'refractory_gold']);
  });

  it('more collector trades grade for recovery in all eleven flotation cases; more air raises recovery in all nine', () => {
    const collector = changes('more_collector', 'recovery_pct');
    expect(collector).toHaveLength(11);
    expect(rises(collector)).toBe(11);
    expect(range(collector, 1)).toEqual([0.5, 2.1]);
    expect(falls(changes('more_collector', 'concentrate_grade'))).toBe(11);
    const air = changes('more_air', 'recovery_pct');
    expect(air).toHaveLength(9);
    expect(rises(air)).toBe(9);
    expect(range(air, 1)).toEqual([1.0, 1.7]);
    const grade = changes('more_air', 'concentrate_grade');
    expect(rises(grade)).toBe(8);
    expect(ids(grade, -1)).toEqual(['refractory_gold']);
  });

  it('the families\' own levers move their results by the amounts quoted', () => {
    const one = (variant: string, metric: string) => {
      const rows = changes(variant, metric);
      expect(rows, variant).toHaveLength(1);
      return rows[0];
    };
    expect(Number(one('larger_bleed', 'recovery_pct').delta.toFixed(1))).toBe(0.7);
    expect(Number(one('finer_grind', 'concentrate_grade').delta.toFixed(1))).toBe(1.3);
    expect(Number(one('finer_grind', 'specific_energy_total_kwh_t').delta.toFixed(1))).toBe(2.3);
    expect(one('finer_grind', 'p80_um').limited).toBe(true);
    expect(Number(one('finer_crusher', 'specific_energy_total_kwh_t').delta.toFixed(2))).toBe(-0.18);
    expect(Math.abs(one('finer_crusher', 'p80_um').delta)).toBeLessThan(1e-6);
    expect(Number(one('coarser_deslime', 'recovery_pct').delta.toFixed(1))).toBe(-5.2);
  });
});
