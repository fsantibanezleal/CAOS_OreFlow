import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { CitationsProvider, validateExecutive } from '@fasl-work/caos-app-shell';
import { INTRODUCTION } from '../content/introduction';
import { TopicView } from '../content/doc';
import { CONTENT_CITATIONS, localizeCitations } from '../content/citations';
import Introduction from '../pages/Introduction';
import executive from '../../../content/executive.json';

// The Introduction quotes the soft porphyry's plausibility ranges. Until 0.07.000 it still quoted the 0.05 ranges
// (84 to 94% at 24 to 32% Cu) two releases after the case record changed, because no test read that line. This holds
// the quoted ranges to the record, in both languages. OF_DERIVED points a development run at a sandbox bake.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const record = JSON.parse(readFileSync(join(derived, 'cases', 'copper_porphyry_soft.json'), 'utf-8')) as { kpi_ranges: Record<string, [number, number]> };
const text = (lang: 'en' | 'es') => INTRODUCTION.flatMap(g => g.topics).flatMap(t => t.paragraphs).map(p => p[lang]).join(' ');
const es = (v: number) => String(v).replace('.', ',');

// WB-017/018/019: source completeness and actual shared SSR are separate from browser readability.
describe('Introduction shared reader ownership and depth', () => {
  it('adversarial: executive evidence cannot disappear from the shared reader', () => {
    expect(validateExecutive(executive)).toEqual([]);
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Introduction)));
    expect(html.match(/data-doc-page=""/g)).toHaveLength(1);
    expect(html.match(/data-executive-view=""/g)).toHaveLength(1);
    expect(html).toContain('data-executive-valid="true"');
    expect(html).toContain('data-panel="executive"');
    expect(html).not.toContain('data-doc-section=""');
    for (const source of executive.sources) expect(html).toContain(`href="${source.url.replaceAll('&', '&amp;')}"`);
    for (const field of ['pain.bearers', 'pain.figures', 'pain.causes', 'context.evidence',
      'situation.state_of_the_art', 'proposal.actions', 'proposal.risks', 'proposal.unknowns']) {
      const [section, key] = field.split('.');
      expect((executive as unknown as Record<string, Record<string, unknown[]>>)[section][key].length).toBeGreaterThan(0);
    }
  });

  it('adversarial: both introduction views retain Focus and onward navigation', () => {
    const source = readFileSync(fileURLToPath(new URL('../pages/Introduction.tsx', import.meta.url)), 'utf-8');
    expect(source).toMatch(/<SurfacePage\s+document\b/);
    const executiveTab = source.slice(source.indexOf("{ id: 'executive'"), source.indexOf("{ id: 'technical'"));
    const technicalTab = source.slice(source.indexOf("{ id: 'technical'"));
    expect(executiveTab).toMatch(/focus:\s*true/);
    expect(technicalTab).toMatch(/focus:\s*true/);
    expect(executiveTab).toMatch(/onOpenTechnical=/);
    expect(source).toMatch(/useUrlView\(\['executive', 'technical'\], 'view'\)/);
    expect(source).toMatch(/value=\{view\}\s+onChange=\{selectView\}/);
    expect(source).not.toContain('page-body');
    expect(source).not.toContain('<DocPage');
    expect(source).not.toContain('<DocSection');
  });

  it('adversarial: technical areas retain their content floors in both languages', () => {
    for (const lang of ['en', 'es'] as const) {
      const topics = INTRODUCTION.flatMap(group => group.topics);
      expect(INTRODUCTION.map(group => group.id)).toEqual(['what', 'approach', 'mathematics', 'cases', 'scope', 'use']);
      for (const area of ['problem', 'principles']) {
        const topic = topics.find(topic => topic.area === area)!;
        expect(topic.paragraphs.filter(p => p[lang].split(/\s+/).length >= 40).length).toBeGreaterThanOrEqual(2);
      }
      const render = (area: string) => renderToStaticMarkup(createElement(MemoryRouter, null,
        createElement(CitationsProvider, { items: localizeCitations(CONTENT_CITATIONS, lang),
          children: createElement(TopicView, { topic: topics.find(topic => topic.area === area)!, lang }) })));
      const math = render('math');
      expect(math).toContain('class="equation');
      expect(math.match(/<dt>/g)).toHaveLength(10);
      expect(math).toContain('data-glossary=""');
      expect(render('honesty').match(/data-callout="honest"/g)).toHaveLength(1);
      const pipeline = topics.find(topic => topic.area === 'pipeline')!;
      expect(pipeline.steps?.length).toBeGreaterThanOrEqual(4);
      expect(render('pipeline')).toContain('<ol>');
      expect(topics.reduce((n, topic) => n + (topic.equations?.length ?? 0), 0)).toBeGreaterThanOrEqual(3);
      expect(topics.some(topic => topic.figure)).toBe(true);
    }
  });
});

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

  // E-01, K-05 (review of 2026-10-04): the cut mode refuses states with no steady state, so 'every accepted state
  // solves' holds for the target mode only, and the page says so
  it('says which accepted states are solved and which the cut mode refuses', () => {
    expect(text('en')).toMatch(/The target-mode states the contract accepts are tested to solve with closed balances/);
    expect(text('en')).toMatch(/In the cut mode a state with no steady state, where the mill cannot draw its power at that cut or the load runs past its bound, is refused with its reason/);
    expect(text('es')).toMatch(/los estados en modo objetivo que acepta el contrato se resuelven con balances cerrados/);
    expect(text('en')).not.toMatch(/The states the contract accepts are tested to solve/);
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
