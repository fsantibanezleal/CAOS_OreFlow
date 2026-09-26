import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { halfSpacing, histogram } from '../lib/histogram';

// The Uncertainty histogram bins every recorded distribution (72 variants, four outputs each). Its x
// range is the bar positions widened by half a spacing each side, and that range must be the sampled
// range itself: ranged on the positions alone, the first and last bars were drawn cut in half.
const derived = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
type Variant = { id: string; methods: { uncertainty?: { outputs: Record<string, { values: number[] }> } } };
const distributions = readdirSync(derived).filter(f => f.endsWith('.json')).flatMap(f =>
  (JSON.parse(readFileSync(join(derived, f), 'utf-8')) as { variants: Variant[] }).variants.flatMap(v =>
    Object.entries(v.methods.uncertainty?.outputs ?? {}).map(([k, o]) => ({ id: `${f}:${v.id}:${k}`, values: o.values }))));

describe('the Uncertainty histogram', () => {
  it('bins all 288 recorded distributions', () => {
    expect(distributions.length).toBe(288);
  });

  it('counts every value once, the largest in the last bin', () => {
    for (const d of distributions) {
      const h = histogram(d.values, 16);
      expect(h.counts.reduce((a, b) => a + b, 0), d.id).toBe(d.values.length);
      expect(h.counts[h.counts.length - 1], d.id).toBeGreaterThan(0);
    }
  });

  it('reaches from the smallest to the largest value, so no end bar is cut', () => {
    for (const d of distributions) {
      const h = histogram(d.values, 16);
      const half = halfSpacing(h.centres);
      const lo = Math.min(...d.values);
      const hi = Math.max(...d.values);
      const tolerance = 1e-9 * Math.max(Math.abs(lo), Math.abs(hi));
      expect(half, d.id).toBeCloseTo(h.width / 2, 12);
      expect(Math.abs(h.centres[0] - half - lo), d.id).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(h.centres[h.centres.length - 1] + half - hi), d.id).toBeLessThanOrEqual(tolerance);
    }
  });

  it('keeps one bin for equal values, and no spacing for a single bar', () => {
    const h = histogram([2, 2, 2], 16);
    expect(h.counts).toEqual([3]);
    expect(halfSpacing(h.centres)).toBe(0);
  });
});
