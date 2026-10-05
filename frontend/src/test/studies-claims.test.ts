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
    expect([argmin(cases, p05), fixed(p05(argmin(cases, p05)), 2), argmax(cases, p05), fixed(p05(argmax(cases, p05)), 2)]).toEqual(['iron_magnetite_fine', 0.2, 'copper_porphyry_hard', 1.03]);
    expect([argmax(cases, p50), fixed(p50(argmax(cases, p50)), 2)]).toEqual(['zinc_sulfide', 0.64]);
    expect([fixed(100 * joint(argmin(cases, joint)), 1), argmax(cases, joint), fixed(100 * joint(argmax(cases, joint)), 1)]).toEqual([0.8, 'iron_magnetite_fine', 6.3]);
    const text = UNCERTAINTY.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/moves by 0\.20 points in the magnetite case to 1\.03 in the hard porphyry, the median by at most 0\.64 \(zinc\), and the probability of meeting every constraint by 0\.8 to 6\.3 percentage points, the most in the magnetite case/);
  });

  it('ablations: the oxide copper entrainment detail is the record (M-18)', () => {
    const d = studies.cases.copper_oxide.ablations.entrainment.detail!;
    const one = (v: number) => fixed(v, 1);
    expect([one(d.off.rougher_mass_pull_pct), one(d.on.rougher_mass_pull_pct)]).toEqual([24.3, 27.8]);
    expect([Math.round(d.on.cleaner_recycle_tph), Math.round(d.off.cleaner_recycle_tph)]).toEqual([192, 156]);
    expect([one(d.off.cleaner_residence_min), one(d.on.cleaner_residence_min), one(d.off.cleaner_recovery_pct), one(d.on.cleaner_recovery_pct)]).toEqual([6.3, 5.4, 73.4, 70]);
    const text = ABLATIONS.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/the rougher pulls 24\.3% of the feed instead of 27\.8%, the recycle falls from 192 to 156 t\/h, and the cleaner, whose volume is fixed, holds its smaller feed 6\.3 minutes instead of 5\.4 and recovers 73\.4% instead of 70\.0%/);
  });

  it('ablations: what each mechanism carries, as the prose states it', () => {
    const cleaner = computed('cleaner_recirculation'), rec = (sw: string) => (c: string) => delta(c, sw, 'recovery_pct');
    expect(cleaner.every(c => rec('cleaner_recirculation')(c) < 0)).toBe(true);
    expect([argmax(cleaner, rec('cleaner_recirculation')), fixed(rec('cleaner_recirculation')(argmax(cleaner, rec('cleaner_recirculation'))), 1)]).toEqual(['gold_free_milling', -3.1]);
    expect([argmin(cleaner, rec('cleaner_recirculation')), fixed(rec('cleaner_recirculation')(argmin(cleaner, rec('cleaner_recirculation'))), 1)]).toEqual(['copper_oxide', -11.4]);
    expect(fixed(rec('cleaner_recirculation')('zinc_sulfide'), 1)).toBe(-11.4);
    const comp = computed('composite_classes');
    expect(comp).toHaveLength(12);
    expect(comp.every(c => delta(c, 'composite_classes', 'concentrate_grade') > 0)).toBe(true);
    expect(comp.filter(c => rec('composite_classes')(c) > 0)).toHaveLength(11);
    expect([argmax(comp, rec('composite_classes')), fixed(rec('composite_classes')(argmax(comp, rec('composite_classes'))), 1)]).toEqual(['copper_oxide', 10.5]);
    expect(fixed(rec('composite_classes')('iron_magnetite_fine'), 1)).toBe(-0.6);
    const regrind = computed('regrind');
    expect(regrind).toHaveLength(8);
    expect(regrind.every(c => delta(c, 'regrind', 'concentrate_grade') < 0)).toBe(true);
    expect(regrind.filter(c => rec('regrind')(c) < 0)).toHaveLength(8);
    expect(fixed(Math.min(...regrind.map(rec('regrind'))), 1)).toBe(-7.5);
    const energy = regrind.map(c => -delta(c, 'regrind', 'specific_energy_total_kwh_t'));
    expect([fixed(Math.min(...energy), 2), fixed(Math.max(...energy), 2)]).toEqual([0.44, 1.48]);
    expect(computed('gravity_bleed')).toEqual(['gold_free_milling']);
    expect(fixed(-rec('gravity_bleed')('gold_free_milling'), 1)).toBe(0.5);
    const ent = computed('entrainment').map(rec('entrainment'));
    expect([fixed(Math.min(...ent), 2), fixed(Math.max(...ent), 2)]).toEqual([-0.15, 0.73]);
    expect(ent.filter(v => v > 0).length).toBeGreaterThan(ent.length / 2);
    const text = ABLATIONS.paragraphs.map(p => p.en).join(' ');
    for (const quoted of ['from 3.1 points in the gravity gold to 11.4 in oxide copper and the zinc', 'by up to 10.5 points in oxide copper', 'recovery by 0.6', 'the grade and the recovery fall in all eight cases that regrind, the recovery by up to 7.5 points, for 0.44 to 1.48 kWh/t less energy', 'worth 0.5 points', 'by -0.15 to +0.73 points']) {
      expect(text).toContain(quoted);
    }
  });
});
