import { describe, expect, it } from 'vitest';
import { EXPERIMENTS } from '../content/experiments';
import { IMPLEMENTATION } from '../content/implementation';

// PG-01 and PG-02: the planned tab census of the two pages 0.07.000 extends (the plan of 2026-09-13, fixed in
// plan-0.07.md item 6). The browser gate counts the same tabs on the built site (TAB_CENSUS in gate.mjs).
describe('the planned page tabs', () => {
  it('Implementation has the nine planned tabs, with the model registry, the GPU lane and deployment', () => {
    expect(IMPLEMENTATION.map(t => t.id)).toEqual(['system', 'engine', 'bake', 'contracts', 'lanes', 'models', 'gpu', 'release', 'deploy']);
  });

  it('Experiments has the seven planned tabs', () => {
    expect(EXPERIMENTS.map(t => t.id)).toEqual(['design', 'data', 'splits', 'metrics', 'responses', 'uncertainty', 'ablations']);
  });

  it('every tab carries a bilingual label and at least one topic with a figure or data', () => {
    for (const tab of [...IMPLEMENTATION, ...EXPERIMENTS]) {
      expect(tab.label.en && tab.label.es, tab.id).toBeTruthy();
      expect(tab.topics.length, tab.id).toBeGreaterThan(0);
      for (const topic of tab.topics) expect(Boolean(topic.figure || topic.data), `${tab.id}/${topic.id}`).toBe(true);
    }
  });
});

// W-18 (review of 0.07.000): architecture 04's page-tab table listed four Experiments tabs, six Implementation tabs
// and four Benchmark tabs after 0.07.000 gave them seven, nine and five. It is held to the pages' tab arrays here.
describe('architecture 04 lists every page tab', () => {
  it('the table matches the code', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf-8');
    const { INTRODUCTION } = await import('../content/introduction');
    const doc = read('../../../docs/architecture/04_web-app.md');
    const row = (page: string) => doc.split(/\r?\n/).find(line => line.startsWith(`| ${page} | `))?.slice(page.length + 5, -2).split(', ');
    // the two pages that declare their groups inside the page component: their labels in the groups' order
    const groupLabels = (source: string, block: RegExp) => {
      const text = read(source).match(block)![0];
      return [...text.matchAll(/label: \{ en: '([^']+)'/g)].map(m => m[1]);
    };
    const methodologyText = read('../pages/Methodology.tsx');
    const order = [...methodologyText.matchAll(/\{ id: '(\w+)', label: T\.(\w+), topics/g)].map(m => m[2]);
    const methodology = order.map(key => methodologyText.match(new RegExp(`  ${key}: \{ en: '([^']+)'`))![1]);
    expect(row('Introduction')).toEqual(INTRODUCTION.map(t => t.label.en));
    expect(row('Methodology')).toEqual(methodology);
    expect(row('Implementation')).toEqual(IMPLEMENTATION.map(t => t.label.en));
    expect(row('Experiments')).toEqual(EXPERIMENTS.map(t => t.label.en));
    expect(row('Benchmark')).toEqual(groupLabels('../pages/Benchmark.tsx', /const GROUPS = \[[\s\S]*?\n\];/));
  });
});
