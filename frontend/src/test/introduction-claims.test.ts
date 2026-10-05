import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INTRODUCTION } from '../content/introduction';

// The Introduction quotes the soft porphyry's plausibility ranges. Until 0.07.000 it still quoted the 0.05 ranges
// (84 to 94% at 24 to 32% Cu) two releases after the case record changed, because no test read that line. This holds
// the quoted ranges to the record, in both languages. OF_DERIVED points a development run at a sandbox bake.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const record = JSON.parse(readFileSync(join(derived, 'cases', 'copper_porphyry_soft.json'), 'utf-8')) as { kpi_ranges: Record<string, [number, number]> };
const text = (lang: 'en' | 'es') => INTRODUCTION.flatMap(g => g.topics).flatMap(t => t.paragraphs).map(p => p[lang]).join(' ');
const es = (v: number) => String(v).replace('.', ',');

describe('the Introduction says what the case records hold', () => {
  it('the soft porphyry\'s plausibility ranges, in both languages', () => {
    const [r0, r1] = record.kpi_ranges.recovery_pct, [g0, g1] = record.kpi_ranges.concentrate_grade;
    expect(text('en')).toContain(`${r0} to ${r1}% recovery`);
    expect(text('en')).toContain(`at ${g0} to ${g1}% Cu`);
    expect(text('es')).toContain(`${es(r0)} a ${es(r1)}% de recuperación`);
    expect(text('es')).toContain(`con ${es(g0)} a ${es(g1)}% Cu`);
    // a range a case was authored to fall inside is a plausibility check, never a validation
    expect(text('en')).toMatch(/plausible, not validated/);
    expect(text('en')).not.toMatch(/published ranges/);
  });

  // T-02, T-04, T-05, T-46 (review of 2026-10-02): every range is a checked range, cited or labelled authored; three
  // lanes use measured data and none calibrates the engine (the GeoMet samples pass through it as inputs); the
  // precompute is named in words a reader can decode, in both languages
  it('frames the ranges, the measured lanes and the precompute as the records hold them', () => {
    const all = (lang: 'en' | 'es') => INTRODUCTION.flatMap(g => g.topics)
      .flatMap(t => [...t.paragraphs, ...(t.limits ?? []), ...(t.equations ?? []).map(e => e.caption), ...(t.figure ? [t.figure.caption] : [])])
      .map(p => p[lang]).join(' ');
    expect(all('en')).not.toMatch(/published range|kept apart|separate from the engine|baked/i);
    expect(all('es')).not.toMatch(/rango publicado|separadas del motor|hornead/i);
    expect(all('en')).toMatch(/Three lanes use measured data, and none calibrates the engine/);
    expect(all('es')).toMatch(/Tres vías usan datos medidos, y ninguna calibra el motor/);
    expect(all('en')).toMatch(/pass through the engine as inputs/);
  });

  // L-01 (review of 2026-10-04): one case out is a near-neighbour test for the five chalcopyrite plants, so the page
  // names the ore-group protocol as the bound on a new plant, and the learning record carries it
  it('names a whole ore group held out, not one case out, as the bound on a new plant', () => {
    const learning = JSON.parse(readFileSync(join(derived, 'learning.json'), 'utf-8')) as { leave_one_group_out: unknown[]; transfer_groups: Record<string, string> };
    expect(learning.leave_one_group_out.length).toBeGreaterThan(0);
    expect(new Set(Object.values(learning.transfer_groups)).size).toBe(7);
    expect(text('en')).toMatch(/Its errors with a whole ore group held out, not its interpolation scores and not one case out \(a near-neighbour test where other plants share the ore\), bound how far it can be trusted for a new plant/);
    expect(text('es')).toMatch(/Sus errores dejando fuera un grupo de mineral completo, no sus puntajes de interpolación ni dejar un caso fuera/);
    expect(text('en')).not.toMatch(/Its leave-one-case-out errors/);
  });

  // D-07, D-13, D-18, D-19 (review of 0.07.000): the figures draw what the engine runs
  it('the figures draw the regrind, the recleaner, the cut-mode variants, the source switch and water as one number', () => {
    const source = readFileSync(fileURLToPath(new URL('../content/introduction.tsx', import.meta.url)), 'utf-8');
    const figure = (name: string, next: string) => source.slice(source.indexOf(`function ${name}`), source.indexOf(`function ${next}`));
    const overview = figure('OverviewFigure', 'StreamFigure');
    for (const unit of ['Regrind', 'Recleaner', 'recleaner tails']) expect(overview).toContain(unit);
    expect(overview).not.toMatch(/precomputed for every variant/);
    expect(overview).toMatch(/Sobol: the nominal only/);
    expect(figure('VariantFigure', 'EvidenceFigure')).toMatch(/Cut mode, every case/);
    expect(figure('WorkbenchFigure', 'CaseCatalog')).toMatch(/p\('source', 'fuente'\)/);
    expect(figure('StreamFigure', 'VariantFigure')).toMatch(/water: one number per stream/);
    expect(source).not.toMatch(/rendimiento en maco/);
  });
});
