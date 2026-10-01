import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { patternSearch, type Evaluator, type PatternSearchResult, type Search } from '../engine/pattern_search';

// OP-02 to OP-04 and the method's part of OP-08: the browser's pattern search takes the bake's path. The
// digests are the ones tests/test_optimization.py holds for the same problems (every evaluation's x, f, h and
// source, then every iteration's mesh size and barrier, as little-endian doubles).
const DIGESTS: Record<string, string> = {
  bowl: '4dcf0b3dba2272faf975bcd9425c47a00b0c1da6e7f203e78ba70597e6b38edc',
  disc: '8650a09291e2acd651a8c119b6a44a8788236e1e231a20905872a7816b25074c',
  impossible: '5a17ba72ae89daa5ff441725fa54168c92c67e0f0214bfb2c2a4341d21e8897e',
  search: 'deb8b4e114ba302f274781866a14de491774cbf92924ffab5f33c722f483d9df',
};
const OPTIONS = { meshInitial: 0.25, meshMinimum: 2 ** -12, maxEvaluations: 2000 };

const problems: Record<string, [Evaluator, number[], Search | undefined]> = {
  bowl: [x => { const a = x[0] - 0.3, b = x[1] - 0.7; return [a * a + b * b, 0]; }, [0.9, 0.1], undefined],
  disc: [x => { const v = Math.max(0, x[0] * x[0] + x[1] * x[1] - 0.5); return [-(x[0] + x[1]), v * v]; }, [1, 1], undefined],
  impossible: [x => { const v = Math.max(0, 2 - x[0]); return [x[0], v * v]; }, [0.5], undefined],
  search: [x => { const a = x[0] - 0.8, b = x[1] - 0.15; return [a * a + b * b + 0.1 * x[2], 0]; }, [0.2, 0.85, 0.5],
    s => (s.feasible === null ? [] : [s.feasible.map(v => 1 - v)])],
};

function digest(result: PatternSearchResult): string {
  const source = { start: 0, search: 1, poll: 2 };
  const values: number[] = [];
  for (const e of result.evaluations) values.push(...e.x, e.f, e.h, source[e.source]);
  for (const it of result.iterations) values.push(it.delta, it.h_max);
  return createHash('sha256').update(new Uint8Array(new Float64Array(values).buffer)).digest('hex');
}

describe('pattern search with a progressive barrier', () => {
  it("takes the bake's path on every analytic problem", () => {
    for (const [name, [evaluate, start, search]] of Object.entries(problems)) {
      expect(digest(patternSearch(evaluate, start, { ...OPTIONS, search })), name).toBe(DIGESTS[name]);
    }
  });

  it('reaches the disc optimum through the barrier and reports the least-violating face when nothing is feasible', () => {
    const disc = patternSearch(problems.disc[0], [1, 1], OPTIONS);
    expect(disc.feasible).toEqual([0.5, 0.5]);
    expect(new Set(disc.iterations.map(it => it.outcome))).toEqual(new Set(['dominating', 'improving', 'unsuccessful']));
    const barrier = disc.iterations.map(it => it.h_max);
    expect(barrier.every((b, i) => i === 0 || b <= barrier[i - 1])).toBe(true);
    const impossible = patternSearch(problems.impossible[0], [0.5], OPTIONS);
    expect([impossible.feasible, impossible.infeasible, impossible.infeasibleH]).toEqual([null, [1], 1]);
  });
});
