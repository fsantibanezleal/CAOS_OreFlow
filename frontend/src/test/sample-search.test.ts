import { describe, expect, it, vi } from 'vitest';

// U-16 (review of 2026-10-02): the Spanish search failed with the word its own label uses ("sondaje 6" gave no match),
// and the English "hole 6" also matched holes 60 and up
vi.mock('uplot', () => ({ default: class {} }));
vi.mock('uplot/dist/uPlot.min.css', () => ({}));
const { matchSamples } = await import('../workbench/SourcePicker');

const samples = [
  { id: 'lct-5', hole: 6 }, { id: 'lct-6', hole: 60 }, { id: 'lct-7', hole: 61 }, { id: 'lct-12', hole: 12 }, { id: 'lct-13', hole: 'DDH-6' },
];

describe('the sample search', () => {
  it('names a hole exactly, in either language', () => {
    expect(matchSamples(samples, 'sondaje 6').map(s => s.id)).toEqual(['lct-5']);
    expect(matchSamples(samples, 'hole 6').map(s => s.id)).toEqual(['lct-5']);
    expect(matchSamples(samples, '  Sondaje 60 ').map(s => s.id)).toEqual(['lct-6']);
    expect(matchSamples(samples, 'sondaje ddh-6').map(s => s.id)).toEqual(['lct-13']);
  });

  it('reads a bare number as a hole and other text as part of an id', () => {
    expect(matchSamples(samples, '12').map(s => s.id)).toEqual(['lct-12']);
    expect(matchSamples(samples, 'lct-1').map(s => s.id)).toEqual(['lct-12', 'lct-13']);
    expect(matchSamples(samples, '')).toHaveLength(samples.length);
    expect(matchSamples(samples, 'sondaje 99')).toEqual([]);
  });
});
