/**
 * Dense linear algebra for the engine's small square systems (the 63-class size grid): row-major
 * matrices, products and an LU solve with partial pivoting, standing in for NumPy and LAPACK.
 */
import type { Vec } from './grid';

export type Mat = { n: number; data: Float64Array };

export class SingularMatrixError extends Error {}

export function eye(n: number): Mat {
  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) data[i * n + i] = 1.0;
  return { n, data };
}

export function matmul(a: Mat, b: Mat): Mat {
  const n = a.n;
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let k = 0; k < n; k += 1) {
      const aik = a.data[i * n + k];
      if (aik === 0.0) continue;
      for (let j = 0; j < n; j += 1) out[i * n + j] += aik * b.data[k * n + j];
    }
  }
  return { n, data: out };
}

/** a[i][j] * scale[j]: every column j scaled by scale[j] (NumPy's `a * s[None, :]`). */
export function scaleColumns(a: Mat, scale: Vec): Mat {
  const n = a.n;
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) out[i * n + j] = a.data[i * n + j] * scale[j];
  return { n, data: out };
}

/** Solve a x = b by LU decomposition with partial pivoting (a is not modified). */
export function solve(a: Mat, b: Vec): Vec {
  const n = a.n;
  const m = Float64Array.from(a.data);
  const x = Float64Array.from(b);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    let best = Math.abs(m[col * n + col]);
    for (let r = col + 1; r < n; r += 1) {
      const v = Math.abs(m[r * n + col]);
      if (v > best) { best = v; pivot = r; }
    }
    if (best === 0.0) throw new SingularMatrixError('singular matrix');
    if (pivot !== col) {
      for (let c = 0; c < n; c += 1) { const t = m[col * n + c]; m[col * n + c] = m[pivot * n + c]; m[pivot * n + c] = t; }
      const t = x[col]; x[col] = x[pivot]; x[pivot] = t;
    }
    const diag = m[col * n + col];
    for (let r = col + 1; r < n; r += 1) {
      const factor = m[r * n + col] / diag;
      if (factor === 0.0) continue;
      m[r * n + col] = 0.0;
      for (let c = col + 1; c < n; c += 1) m[r * n + c] -= factor * m[col * n + c];
      x[r] -= factor * x[col];
    }
  }
  for (let r = n - 1; r >= 0; r -= 1) {
    let s = x[r];
    for (let c = r + 1; c < n; c += 1) s -= m[r * n + c] * x[c];
    x[r] = s / m[r * n + r];
  }
  return x;
}

/** a - diag(d). */
export function minusDiagonal(a: Mat, d: Vec): Mat {
  const n = a.n;
  const data = Float64Array.from(a.data);
  for (let i = 0; i < n; i += 1) data[i * n + i] -= d[i];
  return { n, data };
}
