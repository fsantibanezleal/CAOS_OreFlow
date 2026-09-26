/**
 * Bracketed scalar root finding for decreasing functions, Illinois variant of regula falsi (port of
 * engine/roots.py). The same arithmetic in the same order, so both engines repeat the same iterates.
 */
import { constant } from './constants';
import { SingularMatrixError } from './linalg';

export class RootError extends Error {}

function value(f: (x: number) => number, x: number): number {
  let v: number;
  try {
    v = f(x);
  } catch (error) {
    if (error instanceof RootError || error instanceof SingularMatrixError) return Infinity;
    throw error;
  }
  return Number.isFinite(v) ? v : Infinity;
}

/** Return a < b with finite f(a) > 0 >= f(b). */
export function bracketDecreasing(f: (x: number) => number, x0: number, stepIn: number, lo: number, hi: number): [number, number, number, number] {
  const cap = constant('numerics.root_max_iterations');
  let step = stepIn;
  const x = Math.min(Math.max(x0, lo), hi);
  const fx = value(f, x);
  let a: number; let b: number; let fa: number; let fb: number;
  if (fx > 0.0) {
    a = x; fa = fx; b = a; fb = fa;
    let found = false;
    for (let k = 0; k < cap; k += 1) {
      b = Math.min(hi, a + step);
      fb = value(f, b);
      if (fb <= 0.0) { found = true; break; }
      if (b >= hi) throw new RootError('no sign change below the upper limit');
      a = b; fa = fb;
      step *= 2.0;
    }
    if (!found) throw new RootError('upper bracket search did not converge');
  } else {
    b = x; fb = fx; a = b; fa = fb;
    let found = false;
    for (let k = 0; k < cap; k += 1) {
      a = Math.max(lo, b - step);
      fa = value(f, a);
      if (fa > 0.0) { found = true; break; }
      if (a <= lo) throw new RootError('no sign change above the lower limit');
      b = a; fb = fa;
      step *= 2.0;
    }
    if (!found) throw new RootError('lower bracket search did not converge');
  }
  for (let k = 0; k < cap; k += 1) {
    if (Number.isFinite(fa)) return [a, b, fa, fb];
    const m = 0.5 * (a + b);
    const fm = value(f, m);
    if (fm > 0.0) { a = m; fa = fm; } else { b = m; fb = fm; }
  }
  throw new RootError('could not find a finite positive bracket end');
}

/** Root of f in [a, b] given finite f(a) > 0 >= f(b). */
export function illinois(f: (x: number) => number, aIn: number, bIn: number, faIn: number, fbIn: number): number {
  let a = aIn; let b = bIn; let fa = faIn; let fb = fbIn;
  if (fb === 0.0) return b;
  const tol = constant('numerics.root_rel_tolerance');
  let side = 0;
  let c = a;
  const cap = constant('numerics.root_max_iterations');
  for (let k = 0; k < cap; k += 1) {
    const previous = c;
    c = (a * fb - b * fa) / (fb - fa);
    const fc = value(f, c);
    if (fc === 0.0 || Math.abs(c - previous) <= tol * Math.max(1.0, Math.abs(c))) return c;
    if (fc < 0.0) {
      b = c; fb = fc;
      if (side === -1) fa *= 0.5;
      side = -1;
    } else {
      a = c; fa = fc;
      if (side === 1) fb *= 0.5;
      side = 1;
    }
  }
  return c;
}

export function solveDecreasing(f: (x: number) => number, x0: number, step: number, lo: number, hi: number): number {
  const [a, b, fa, fb] = bracketDecreasing(f, x0, step, lo, hi);
  return illinois(f, a, b, fa, fb);
}

/** Python's round(): halves go to the even integer. */
export function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}
