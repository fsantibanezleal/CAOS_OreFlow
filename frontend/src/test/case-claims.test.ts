import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CASE_CONTEXT, VARIANT_NOTES } from '../content/cases';

// The Case view's authored context makes qualitative claims about each case; every one of them is
// checked here against the baked results, so a bake that contradicts the text fails instead of
// shipping prose the engine does not support.
const derived = fileURLToPath(new URL('../../../data/derived/', import.meta.url));
type Variant = { id: string; trace: { metrics: Record<string, number>; flags: Array<{ code: string }> } };
const variants = (id: string) => Object.fromEntries((JSON.parse(readFileSync(join(derived, 'cases', `${id}.json`), 'utf-8')) as { variants: Variant[] })
  .variants.map(v => [v.id, v.trace]));
const benchmark = JSON.parse(readFileSync(join(derived, 'benchmark.json'), 'utf-8')) as {
  cases: Array<{ case_id: string; family: string }>; uncertainty: Record<string, { dominant_input: Record<string, string> }>;
};
const flagged = (t: Variant['trace'], code: string) => t.flags.some(f => f.code === code);
const flotation = benchmark.cases.filter(c => c.family !== 'magnetic').map(c => c.case_id);

describe('the case contexts say what the engine computes', () => {
  it('covers every case, and every variant kind has a note', () => {
    expect(Object.keys(CASE_CONTEXT).sort()).toEqual(benchmark.cases.map(c => c.case_id).sort());
    for (const c of benchmark.cases) for (const id of Object.keys(variants(c.case_id))) expect(VARIANT_NOTES[id], `${c.case_id}:${id}`).toBeDefined();
  });

  it('harder ore and higher throughput run the mill at installed power', () => {
    for (const c of benchmark.cases) {
      const v = variants(c.case_id);
      expect(flagged(v.harder_ore, 'power_limited'), c.case_id).toBe(true);
      if (v.higher_throughput) expect(flagged(v.higher_throughput, 'power_limited'), c.case_id).toBe(true);
    }
  });

  it('the hard porphyry draws nearly all its power at the nominal state without being limited', () => {
    const n = variants('copper_porphyry_hard').nominal;
    expect(flagged(n, 'power_limited')).toBe(false);
    expect(n.metrics.mill_power_kw / n.metrics.installed_mill_power_kw).toBeGreaterThan(0.95);
  });

  it('more collector raises recovery at a lower grade in every flotation case', () => {
    for (const id of flotation) {
      const v = variants(id);
      expect(v.more_collector.metrics.recovery_pct, id).toBeGreaterThan(v.nominal.metrics.recovery_pct);
      expect(v.more_collector.metrics.concentrate_grade, id).toBeLessThan(v.nominal.metrics.concentrate_grade);
    }
  });

  it('more air raises both recovery and grade where the text says so', () => {
    for (const id of ['zinc_sulfide', 'mixed_ore_high_clay']) {
      const v = variants(id);
      expect(v.more_air.metrics.recovery_pct, id).toBeGreaterThan(v.nominal.metrics.recovery_pct);
      expect(v.more_air.metrics.concentrate_grade, id).toBeGreaterThan(v.nominal.metrics.concentrate_grade);
      expect(v.more_air.metrics.rougher_water_recovery_pct, id).toBeGreaterThan(v.nominal.metrics.rougher_water_recovery_pct);
    }
  });

  it('magnetite grade rises with a finer grind', () => {
    const v = variants('iron_magnetite_fine');
    expect(v.finer_grind.metrics.concentrate_grade).toBeGreaterThan(v.nominal.metrics.concentrate_grade);
    expect(v.nominal.metrics.concentrate_grade).toBeGreaterThan(v.coarser_grind.metrics.concentrate_grade);
  });

  it('molybdenite trails copper by 2 to 12 points in the bulk concentrate', () => {
    const m = variants('copper_molybdenum').nominal.metrics;
    const gap = m.recovery_Cu_pct - m.recovery_Mo_pct;
    expect(gap).toBeGreaterThan(2);
    expect(gap).toBeLessThan(12);
  });

  it('oxide copper recovery is capped and gains little from collector', () => {
    const v = variants('copper_oxide');
    expect(v.nominal.metrics.recovery_pct).toBeLessThan(80);
    expect(v.more_collector.metrics.recovery_pct - v.nominal.metrics.recovery_pct).toBeLessThan(3);
  });

  it('a larger gravity bleed raises gold recovery, and a coarser desliming cut loses phosphate', () => {
    const gold = variants('gold_free_milling');
    expect(gold.larger_bleed.metrics.recovery_pct).toBeGreaterThan(gold.nominal.metrics.recovery_pct);
    const phosphate = variants('phosphate_clay');
    expect(phosphate.coarser_deslime.metrics.recovery_pct).toBeLessThan(phosphate.nominal.metrics.recovery_pct);
  });

  it('floatability dominates the spread of recovery where the text says so, work index for the hard porphyry', () => {
    for (const id of ['copper_porphyry_soft', 'nickel_sulphide', 'refractory_gold']) {
      expect(benchmark.uncertainty[id].dominant_input.recovery_pct, id).toBe('floatability');
    }
    expect(benchmark.uncertainty.copper_porphyry_hard.dominant_input.recovery_pct).toBe('work_index');
  });
});
