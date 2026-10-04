import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ABLATIONS, UNCERTAINTY } from '../content/experiments-studies';

// PG-03 for the uncertainty and ablations tabs: every number and ordering their prose states is recomputed from
// studies.json (the committed record; OF_DERIVED points a development run at a sandbox bake).
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
type Rec = { status: string; delta?: Record<string, number>; on?: Record<string, number>; detail?: { on: Record<string, number>; off: Record<string, number> } };
const studies = JSON.parse(readFileSync(join(derived, 'studies.json'), 'utf-8')) as {
  cases: Record<string, { ablations: Record<string, Rec>; seed_study: { seeds: number[]; samples: number; spread: { recovery_pct: Record<string, number>; all_constraints: number } } }>;
};
const cases = Object.keys(studies.cases);
const fixed = (v: number, d: number) => Number(v.toFixed(d));
const computed = (sw: string) => cases.filter(c => studies.cases[c].ablations[sw].status === 'computed');
const delta = (c: string, sw: string, key: string) => studies.cases[c].ablations[sw].delta![key];
const argmin = (ids: string[], f: (id: string) => number) => ids.reduce((a, b) => (f(b) < f(a) ? b : a));
const argmax = (ids: string[], f: (id: string) => number) => ids.reduce((a, b) => (f(b) > f(a) ? b : a));

describe('the uncertainty and ablations tabs say what the studies record holds', () => {
  it('seed study: eight more seeds of 128 samples, and how far the record moves', () => {
    const s = (c: string) => studies.cases[c].seed_study;
    expect(cases.every(c => s(c).seeds.length === 8 && s(c).samples === 128)).toBe(true);
    const p05 = (c: string) => s(c).spread.recovery_pct.p05, p50 = (c: string) => s(c).spread.recovery_pct.p50, joint = (c: string) => s(c).spread.all_constraints;
    expect([argmin(cases, p05), fixed(p05(argmin(cases, p05)), 2), argmax(cases, p05), fixed(p05(argmax(cases, p05)), 2)]).toEqual(['gold_free_milling', 0.19, 'copper_porphyry_hard', 0.94]);
    expect([argmax(cases, p50), fixed(p50(argmax(cases, p50)), 2)]).toEqual(['zinc_sulfide', 0.65]);
    expect([fixed(100 * joint(argmin(cases, joint)), 1), argmax(cases, joint), fixed(100 * joint(argmax(cases, joint)), 1)]).toEqual([0.8, 'copper_oxide', 8.6]);
    const text = UNCERTAINTY.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/moves by 0\.19 points in the gold case to 0\.94 in the hard porphyry, the median by at most 0\.65 \(zinc\), and the probability of meeting every constraint by 0\.8 to 8\.6 percentage points, the most in oxide copper/);
  });

  it('ablations: the oxide copper entrainment detail is the record (M-18)', () => {
    const d = studies.cases.copper_oxide.ablations.entrainment.detail!;
    const one = (v: number) => fixed(v, 1);
    expect([one(d.off.rougher_mass_pull_pct), one(d.on.rougher_mass_pull_pct)]).toEqual([28.5, 34.3]);
    expect([Math.round(d.on.cleaner_recycle_tph), Math.round(d.off.cleaner_recycle_tph)]).toEqual([176, 142]);
    expect([one(d.off.cleaner_residence_min), one(d.on.cleaner_residence_min), one(d.off.cleaner_recovery_pct), one(d.on.cleaner_recovery_pct)]).toEqual([6.5, 5.6, 75.5, 72.2]);
    const text = ABLATIONS.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/the rougher pulls 28\.5% of the feed instead of 34\.3%, the recycle falls from 176 to 142 t\/h, and the cleaner, whose volume is fixed, holds its smaller feed 6\.5 minutes instead of 5\.6 and recovers 75\.5% instead of 72\.2%/);
  });

  it('ablations: what each mechanism carries, as the prose states it', () => {
    const cleaner = computed('cleaner_recirculation'), rec = (sw: string) => (c: string) => delta(c, sw, 'recovery_pct');
    expect(cleaner.every(c => rec('cleaner_recirculation')(c) < 0)).toBe(true);
    expect([argmax(cleaner, rec('cleaner_recirculation')), fixed(rec('cleaner_recirculation')(argmax(cleaner, rec('cleaner_recirculation'))), 1)]).toEqual(['gold_free_milling', -2.7]);
    expect([argmin(cleaner, rec('cleaner_recirculation')), fixed(rec('cleaner_recirculation')(argmin(cleaner, rec('cleaner_recirculation'))), 1)]).toEqual(['zinc_sulfide', -11.2]);
    const comp = computed('composite_classes');
    expect(comp).toHaveLength(12);
    expect(comp.every(c => delta(c, 'composite_classes', 'concentrate_grade') > 0)).toBe(true);
    expect(comp.filter(c => rec('composite_classes')(c) > 0)).toHaveLength(11);
    expect([argmax(comp, rec('composite_classes')), fixed(rec('composite_classes')(argmax(comp, rec('composite_classes'))), 1)]).toEqual(['copper_oxide', 8.9]);
    expect(fixed(rec('composite_classes')('iron_magnetite_fine'), 1)).toBe(-0.6);
    const regrind = computed('regrind');
    expect(regrind).toHaveLength(8);
    expect(regrind.every(c => delta(c, 'regrind', 'concentrate_grade') < 0)).toBe(true);
    expect(regrind.filter(c => rec('regrind')(c) < 0)).toHaveLength(7);
    expect(fixed(Math.min(...regrind.map(rec('regrind'))), 1)).toBe(-6.7);
    const energy = regrind.map(c => -delta(c, 'regrind', 'specific_energy_total_kwh_t'));
    expect([fixed(Math.min(...energy), 2), fixed(Math.max(...energy), 2)]).toEqual([0.40, 1.37]);
    expect(computed('gravity_bleed')).toEqual(['gold_free_milling']);
    expect(fixed(-rec('gravity_bleed')('gold_free_milling'), 1)).toBe(0.6);
    const ent = computed('entrainment').map(rec('entrainment'));
    expect([fixed(Math.min(...ent), 2), fixed(Math.max(...ent), 2)]).toEqual([-0.14, 0.67]);
    expect(ent.filter(v => v > 0).length).toBeGreaterThan(ent.length / 2);
    const text = ABLATIONS.paragraphs.map(p => p.en).join(' ');
    for (const quoted of ['from 2.7 points in the gravity gold to 11.2 in the zinc', 'by up to 8.9 points in oxide copper', 'recovery by 0.6', 'by up to 6.7 points, for 0.40 to 1.37 kWh/t less energy', 'worth 0.6 points', 'by -0.14 to +0.67 points']) {
      expect(text).toContain(quoted);
    }
  });
});
