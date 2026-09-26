/**
 * Breakage matrices, the Whiten crusher and the energy-specific ball-mill operator (port of
 * engine/comminution.py; theory in docs/methodologies/02_crushing.md and 03_grinding-circuit.md).
 */
import { constant } from './constants';
import { grid, type Vec } from './grid';
import { eye, matmul, scaleColumns, solve, type Mat } from './linalg';
import type { Crusher, Mill } from './model';

/** Strictly lower-triangular b[i][j]: fraction of broken class-j mass reporting to class i. */
export function breakageMatrix(beta0: number, beta1: number, beta2: number): Mat {
  const g = grid();
  const n = g.n;
  const data = new Float64Array(n * n);
  for (let j = 0; j < n - 1; j += 1) {
    const cumulative: number[] = [];
    for (let i = j + 1; i < n; i += 1) {
      const ratio = g.upper[i] / g.upper[j + 1];
      cumulative.push(beta0 * Math.pow(ratio, beta1) + (1.0 - beta0) * Math.pow(ratio, beta2));
    }
    for (let k = 0; k < cumulative.length; k += 1) {
      const value = k < cumulative.length - 1 ? cumulative[k] - cumulative[k + 1] : cumulative[k];
      data[(j + 1 + k) * n + j] = value;
    }
  }
  return { n, data };
}

/** Probability that a particle of each class enters the breakage zone. */
export function whitenClassification(cssUm: number, crusher: Crusher): Vec {
  const g = grid();
  const k1 = crusher.k1_css * cssUm;
  const k2 = crusher.k2_css * cssUm;
  const c = new Float64Array(g.n);
  for (let i = 0; i < g.n; i += 1) {
    const size = g.size[i];
    if (size < k1) c[i] = 0.0;
    else if (size > k2) c[i] = 1.0;
    else c[i] = 1.0 - Math.pow(Math.min(1.0, Math.max(0.0, (k2 - size) / (k2 - k1))), crusher.k3);
  }
  c[g.n - 1] = 0.0;
  return c;
}

/** Whiten crusher product p = (I - C)(I - B C)^-1 f for one mineral's feed vector. */
export function crush(feed: Vec, cssUm: number, crusher: Crusher): Vec {
  const b = breakageMatrix(crusher.beta0, crusher.beta1, crusher.beta2);
  const c = whitenClassification(cssUm, crusher);
  const n = grid().n;
  const bc = scaleColumns(b, c);
  const system = eye(n);
  for (let k = 0; k < n * n; k += 1) system.data[k] -= bc.data[k];
  const internal = solve(system, feed);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (1.0 - c[i]) * internal[i];
  return out;
}

/** Energy-specific selection function S^E (t/kWh) by class; the pan does not break. */
export function selectionEnergy(mill: Mill, workIndex: number): Vec {
  const g = grid();
  const s = new Float64Array(g.n);
  for (let i = 0; i < g.n; i += 1) {
    const raw = mill.alpha0 * (mill.reference_work_index_kwh_t / workIndex) * Math.pow(g.size[i], mill.alpha1);
    s[i] = raw / (1.0 + Math.pow(g.size[i] / mill.critical_size_um, mill.alpha2));
  }
  s[g.n - 1] = 0.0;
  return s;
}

/** T^-1(e) = prod_k (I + e f_k D) for one mineral, expanded once in powers of D. */
export class MillOperator {
  readonly d: Mat;
  readonly d2: Mat;
  readonly d3: Mat;
  readonly c1: number;
  readonly c2: number;
  readonly c3: number;

  constructor(selection: Vec, b: Mat) {
    const n = grid().n;
    const iMinusB = eye(n);
    for (let k = 0; k < n * n; k += 1) iMinusB.data[k] -= b.data[k];
    this.d = scaleColumns(iMinusB, selection);
    this.d2 = matmul(this.d, this.d);
    this.d3 = matmul(this.d2, this.d);
    const [f1, f2, f3] = constant<number[]>('mill.mixer_fractions');
    this.c1 = f1 + f2 + f3;
    this.c2 = f1 * f2 + f1 * f3 + f2 * f3;
    this.c3 = f1 * f2 * f3;
  }

  inverse(energyPerPass: number): Mat {
    const e = energyPerPass;
    const n = this.d.n;
    const a1 = this.c1 * e;
    const a2 = this.c2 * e * e;
    const a3 = this.c3 * e * e * e;
    // the same order of additions as the Python engine: ((I + a1 D) + a2 D^2) + a3 D^3
    const data = eye(n).data;
    for (let k = 0; k < n * n; k += 1) data[k] = ((data[k] + a1 * this.d.data[k]) + a2 * this.d2.data[k]) + a3 * this.d3.data[k];
    return { n, data };
  }
}

/** Bond specific energy (kWh/t) for a reduction from F80 to P80 (GMG01-MP-2021). */
export function bondEnergy(workIndex: number, f80Um: number, p80Um: number): number {
  const k = constant('bond.coefficient');
  return workIndex * (k / Math.sqrt(p80Um) - k / Math.sqrt(f80Um));
}

export function operatingWorkIndex(energy: number, f80Um: number, p80Um: number): number {
  const k = constant('bond.coefficient');
  return energy / (k / Math.sqrt(p80Um) - k / Math.sqrt(f80Um));
}
