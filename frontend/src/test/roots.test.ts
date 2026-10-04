import { describe, expect, it } from 'vitest';
import { bracketDecreasing, RootError, solveDecreasing } from '../engine/roots';

// K-11, C-10 (implementation review of 2026-10-04): the same failure paths as tests/test_roots.py.
describe('root search failure paths', () => {
  it('a missing sign change says where the root lies', () => {
    const side = (f: (x: number) => number) => {
      try { bracketDecreasing(f, 0.0, 0.5, -1.0, 1.0); } catch (error) { return (error as RootError).side; }
      return 'none';
    };
    expect(side(() => 1.0)).toBe('above');
    expect(side(() => -1.0)).toBe('below');
  });

  it('a non-finite value inside the bracket does not break the secant', () => {
    const f = (x: number) => (x >= 0.4 && x <= 0.6 ? Infinity : 0.5 - x ** 3);
    expect(Math.abs(solveDecreasing(f, 0.0, 1.0, 0.0, 1.0) - 0.5 ** (1.0 / 3.0))).toBeLessThan(1e-9);
  });
});
