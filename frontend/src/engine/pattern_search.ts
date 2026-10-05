/**
 * A generalized pattern search with a progressive barrier (port of methods/pattern_search.py, OP-02 to OP-04).
 * The same trial order, the same comparisons and the same power-of-two mesh as the bake, so both languages
 * take the same path for the same evaluator. See the Python module for the method and its references.
 */

export type Point = number[];
export type Evaluator = (x: Point) => [number, number];
export type SearchState = { feasible: Point | null; infeasible: Point | null; delta: number; hMax: number };
export type Search = (state: SearchState) => Point[];
export type Evaluation = { x: Point; f: number; h: number; source: 'start' | 'search' | 'poll' };
export type Iteration = {
  outcome: 'dominating' | 'improving' | 'unsuccessful'; delta: number; h_max: number; evaluations: number;
  feasible: Point | null; feasible_f: number | null; infeasible: Point | null; infeasible_h: number | null;
};
export type PatternSearchResult = {
  feasible: Point | null; feasibleF: number | null; infeasible: Point | null; infeasibleH: number | null; infeasibleF: number | null;
  stop: 'mesh' | 'budget'; evaluations: Evaluation[]; iterations: Iteration[];
};
/** `decrease` > 0 asks every comparison for more than round-off (see the Python module); the analytic tests use 0. */
export type PatternSearchOptions = { meshInitial: number; meshMinimum: number; maxEvaluations: number; search?: Search; decrease?: number };

const inside = (x: Point) => x.every(v => v >= 0 && v <= 1);
const key = (x: Point) => x.map(v => v.toString()).join(',');

export function patternSearch(evaluate: Evaluator, start: Point, options: PatternSearchOptions): PatternSearchResult {
  const { meshInitial, meshMinimum, maxEvaluations, search } = options;
  const decrease = options.decrease ?? 0;
  const below = (a: number, b: number) => a < b - decrease * Math.max(1.0, Math.abs(b));
  const noWorse = (a: number, b: number) => a <= b + decrease * Math.max(1.0, Math.abs(b));
  const hBelow = (a: number, b: number) => a < b * (1.0 - decrease);
  const hWithin = (a: number, b: number) => a <= b * (1.0 + decrease);
  if (!inside(start)) throw new RangeError(`the start must lie in the unit cube, got ${start}`);
  if (!(meshMinimum > 0 && meshMinimum <= meshInitial)) throw new RangeError(`need 0 < mesh_minimum <= mesh_initial, got ${meshMinimum} and ${meshInitial}`);
  const cache = new Map<string, [number, number]>();
  const evaluations: Evaluation[] = [];
  const value = (x: Point, source: Evaluation['source']): [number, number] => {
    const k = key(x);
    let v = cache.get(k);
    if (v === undefined) {
      const [f, h] = evaluate(x);
      // a non-finite violation is the extreme barrier in both languages (M-10)
      v = [f, Number.isNaN(h) ? Infinity : Math.max(0, h)];
      cache.set(k, v);
      evaluations.push({ x: [...x], f: v[0], h: v[1], source });
    }
    return v;
  };

  const [f0, h0] = value(start, 'start');
  let xf: Point | null = h0 === 0 ? start : null;
  let ff: number | null = h0 === 0 ? f0 : null;
  let xi: Point | null = h0 === 0 ? null : start;
  let hi: number | null = h0 === 0 ? null : h0;
  let fi: number | null = h0 === 0 ? null : f0;
  let hMax = xi === null ? Infinity : (hi as number);
  let delta = meshInitial;
  const iterations: Iteration[] = [];

  const dominates = (f: number, h: number): boolean => {
    if (h === 0) return ff === null || below(f, ff);
    if (!hWithin(h, hMax)) return false;
    return xi !== null && hWithin(h, hi as number) && noWorse(f, fi as number) && (hBelow(h, hi as number) || below(f, fi as number));
  };

  let stop: PatternSearchResult['stop'];
  for (;;) {
    if (delta < meshMinimum) { stop = 'mesh'; break; }
    if (cache.size >= maxEvaluations) { stop = 'budget'; break; }
    let outcome: Iteration['outcome'] = 'unsuccessful';
    let bestImproving: [Point, number, number] | null = null;
    let firstInfeasible: [Point, number, number] | null = null;
    const trials: Array<[Point, Evaluation['source']]> = [];
    if (search) for (const x of search({ feasible: xf, infeasible: xi, delta, hMax })) trials.push([x.map(Number), 'search']);
    for (const center of [xf, xi]) {
      if (center === null) continue;
      for (let i = 0; i < center.length; i++) {
        for (const sign of [1, -1]) {
          const x = [...center];
          x[i] = center[i] + sign * delta;
          trials.push([x, 'poll']);
        }
      }
    }
    for (const [x, source] of trials) {
      if (!inside(x) || cache.size >= maxEvaluations) continue;
      const [f, h] = value(x, source);
      // a state the evaluator cannot score (a contract rejection) is an extreme-barrier point: never an incumbent
      if (!(Number.isFinite(f) && Number.isFinite(h))) continue;
      if (dominates(f, h)) {
        outcome = 'dominating';
        if (h === 0) { xf = x; ff = f; } else { xi = x; hi = h; fi = f; }
        break;
      }
      if (h > 0 && hWithin(h, hMax)) {
        if (xi === null) {
          if (firstInfeasible === null || below(f, firstInfeasible[2])) firstInfeasible = [x, h, f];
        } else if (hBelow(h, hi as number) && (bestImproving === null || hBelow(h, bestImproving[1])
          || (hWithin(h, bestImproving[1]) && below(f, bestImproving[2])))) {
          bestImproving = [x, h, f];
        }
      }
    }
    if (outcome !== 'dominating' && bestImproving !== null) {
      outcome = 'improving';
      [xi, hi, fi] = bestImproving;
    }
    if (xi === null && firstInfeasible !== null) [xi, hi, fi] = firstInfeasible;
    if (outcome === 'dominating') delta = Math.min(2 * delta, meshInitial);
    else if (outcome === 'unsuccessful') delta = delta / 2;
    if (xi !== null) hMax = hi as number;
    iterations.push({ outcome, delta, h_max: hMax, evaluations: cache.size, feasible: xf ? [...xf] : null, feasible_f: ff, infeasible: xi ? [...xi] : null, infeasible_h: hi });
  }
  return { feasible: xf, feasibleF: ff, infeasible: xi, infeasibleH: hi, infeasibleF: fi, stop, evaluations, iterations };
}
