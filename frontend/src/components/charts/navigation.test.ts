import { describe, expect, it } from 'vitest';
import { colourBounds, gridRegion, gridSlice, panRange } from './navigation';

describe('bounded numeric navigation', () => {
  it('moves by a fraction of the visible span, clamping at either domain edge', () => {
    expect(panRange([2, 6], [0, 10], 0.25)).toEqual([3, 7]);
    expect(panRange([2, 6], [0, 10], -100)).toEqual([0, 4]);
    expect(panRange([2, 6], [0, 10], 100)).toEqual([6, 10]);
    expect(panRange([0, 10], [0, 10], 1)).toEqual([0, 10]);
  });
  it('pans log axes in log space without changing their ratio or crossing zero', () => {
    const [lo, hi] = panRange([10, 100], [1, 1000], 1, true);
    expect(lo).toBeCloseTo(100); expect(hi).toBeCloseTo(1000);
    const left = panRange([10, 100], [1, 1000], -100, true);
    expect(left[0]).toBeCloseTo(1); expect(left[1]).toBeCloseTo(10);
  });
  it('keeps constant domains valid and refuses invalid bounds', () => {
    expect(panRange([5, 5], [5, 5], 1)).toEqual([5, 5]);
    expect(panRange([10, 10], [10, 10], 1, true)).toEqual([10, 10]);
    expect(panRange([NaN, 4], [1, 10], 1)).toEqual([1, 10]);
    expect(panRange([-1, 4], [1, 10], 1, true)).toEqual([1, 10]);
  });
});
describe('grid inspection', () => {
  it('normalizes reverse drags, clamps out-of-grid cells and has no empty selection', () => {
    expect(gridRegion([3, 4], [-2, 9], 4, 5)).toEqual({ i0: 0, i1: 3, j0: 4, j1: 4 });
    expect(gridRegion([0, 0], [0, 0], 0, 5)).toBeNull();
  });
  const xs = [10, 20, 30], ys = [100, 200, 300];
  const z = [[11, 12, 13], [21, null, 23], [31, 32, 33]];
  it('takes the selected endpoint row within the region, retaining rejected cells', () => {
    expect(gridSlice(xs, ys, z, { i0: 0, i1: 1, j0: 0, j1: 2 }, [1, 1], 'x'))
      .toEqual({ coordinates: [10, 20], values: [21, null] });
  });
  it('takes a column, preserving null and missing cells rather than manufacturing zero', () => {
    expect(gridSlice(xs, ys, z, { i0: 1, i1: 2, j0: 0, j1: 2 }, [1, 2], 'y'))
      .toEqual({ coordinates: [100, 200, 300], values: [12, null, 32] });
    expect(gridSlice(xs, ys, [[null]], { i0: 0, i1: 2, j0: 0, j1: 2 }, [2, 2], 'x').values).toEqual([null, null, null]);
  });
});


describe('colour limits and missing data', () => {
  it('returns no colour limits for empty or all-rejected data', () => {
    expect(colourBounds([], true)).toBeNull();
    expect(colourBounds([[null, NaN, Infinity]], false)).toBeNull();
  });
  it('keeps constant and zero-valued grids valid', () => {
    expect(colourBounds([[0, null, 0]], true)).toEqual({ bounds: [0, 0], clipped: false });
    expect(gridSlice([1], [2], [[0]], { i0: 0, i1: 0, j0: 0, j1: 0 }, [0, 0], 'x').values).toEqual([0]);
  });
  it('restores the full range from the existing robust lower-tail rule', () => {
    const values = [[0, ...Array.from({ length: 20 }, (_, k) => 50 + k)]];
    expect(colourBounds(values, true)).toEqual({ bounds: [51, 69], clipped: true });
    expect(colourBounds(values, false)).toEqual({ bounds: [0, 69], clipped: false });
  });
  it('keeps repeated pans within the original positive log domain', () => {
    let view: [number, number] = [10, 100];
    for (const direction of [1, -1, 1, -1]) {
      for (let n = 0; n < 100; n++) {
        view = panRange(view, [1, 1000], direction * 0.2, true);
        expect(view[0]).toBeGreaterThanOrEqual(1); expect(view[1]).toBeLessThanOrEqual(1000);
        expect(view[1] / view[0]).toBeCloseTo(10, 8);
      }
    }
  });
});
