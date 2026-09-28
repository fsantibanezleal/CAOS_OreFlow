import { describe, expect, it } from 'vitest';
import { IMPLEMENTATION } from '../content/implementation';

// PG-01 and PG-02: the planned tab census of the two pages 0.07.000 extends (the plan of 2026-09-13, fixed in
// plan-0.07.md item 6). The browser gate counts the same tabs on the built site (TAB_CENSUS in gate.mjs).
describe('the planned page tabs', () => {
  it('Implementation has the nine planned tabs, with the model registry, the GPU lane and deployment', () => {
    expect(IMPLEMENTATION.map(t => t.id)).toEqual(['system', 'engine', 'bake', 'contracts', 'lanes', 'models', 'gpu', 'release', 'deploy']);
  });

  it('every tab carries a bilingual label and at least one topic with a figure or data', () => {
    for (const tab of IMPLEMENTATION) {
      expect(tab.label.en && tab.label.es, tab.id).toBeTruthy();
      expect(tab.topics.length, tab.id).toBeGreaterThan(0);
      for (const topic of tab.topics) expect(Boolean(topic.figure || topic.data), `${tab.id}/${topic.id}`).toBe(true);
    }
  });
});
