/**
 * Lumped batch-flotation kinetics fitted to the engine's own batch curve and projected to the rougher
 * bank (port of engine/kinetics.py; docs/methodologies/11_kinetic-fits.md). One deterministic
 * Levenberg-Marquardt routine, bounds by reparameterization, analytic Jacobians and a fixed summation order.
 */
import { constant } from './constants';
import type { Vec } from './grid';
import type { ResolvedOre } from './ore';
import { speciesContentOf, type Species } from './species';
import type { FlotationResult } from './flotation';
import laguerre from '../../../data/derived/contract/operating_contract.json';

type V = number[];

const logistic = (x: number) => 1.0 / (1.0 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1.0 - p));
const betaBounds = () => constant<number[]>('kinetics.beta_bounds');
const unfloatedMixers = (k: number, cells: number, tau: number) => Math.pow(1.0 + k * tau, -cells);

export type Model = {
  id: string;
  names: string[];
  units: string[];
  natural: (th: V) => V;
  chain: (th: V) => V[];
  value: (t: number, q: V) => number;
  gradient: (t: number, q: V) => V;
  project: (q: V, cells: number, tau: number) => number;
  start: (a0: number, k0: number) => V;
};

/** E[f(t)] for t Erlang with N stages of mean tau: Gauss-Laguerre on t = tau v (the table exported with Contract 1). */
export function erlangMean(f: (t: number) => number, cells: number, tau: number): number {
  const nodes = laguerre.laguerre.nodes as number[];
  const weights = laguerre.laguerre.weights as number[];
  let total = 0.0;
  for (let i = 0; i < nodes.length; i += 1) {
    let term = weights[i];
    for (let m = 1; m < cells; m += 1) term *= nodes[i] / m;
    total += term * f(tau * nodes[i]);
  }
  return total;
}

const unitChain = (th: V): V[] => [[logistic(th[0]) * (1.0 - logistic(th[0])), 0.0], [0.0, Math.exp(th[1])]];

export const FIRST_ORDER: Model = {
  id: 'first_order', names: ['R_inf', 'k'], units: ['1', '1/min'],
  natural: th => [logistic(th[0]), Math.exp(th[1])],
  chain: unitChain,
  value: (t, q) => q[0] * -Math.expm1(-q[1] * t),
  gradient: (t, q) => [-Math.expm1(-q[1] * t), q[0] * t * Math.exp(-q[1] * t)],
  project: (q, n, tau) => q[0] * (1.0 - unfloatedMixers(q[1], n, tau)),
  start: (a0, k0) => [logit(a0), Math.log(k0)],
};

export const KELSALL: Model = {
  id: 'kelsall', names: ['R_inf', 'phi', 'k_fast', 'k_slow'], units: ['1', '1', '1/min', '1/min'],
  natural: th => [logistic(th[0]), logistic(th[1]), Math.exp(th[2]) + Math.exp(th[3]), Math.exp(th[2])],
  chain: th => {
    const la = logistic(th[0]); const lp = logistic(th[1]);
    const ks = Math.exp(th[2]); const gap = Math.exp(th[3]);
    return [[la * (1.0 - la), 0.0, 0.0, 0.0], [0.0, lp * (1.0 - lp), 0.0, 0.0], [0.0, 0.0, ks, gap], [0.0, 0.0, ks, 0.0]];
  },
  value: (t, [a, phi, kf, ks]) => a * ((1.0 - phi) * -Math.expm1(-kf * t) + phi * -Math.expm1(-ks * t)),
  gradient: (t, [a, phi, kf, ks]) => {
    const ef = Math.exp(-kf * t); const es = Math.exp(-ks * t);
    return [(1.0 - phi) * -Math.expm1(-kf * t) + phi * -Math.expm1(-ks * t), a * (ef - es), a * (1.0 - phi) * t * ef, a * phi * t * es];
  },
  project: (q, n, tau) => q[0] * ((1.0 - q[1]) * (1.0 - unfloatedMixers(q[2], n, tau)) + q[1] * (1.0 - unfloatedMixers(q[3], n, tau))),
  start: (a0, k0) => [logit(a0), 0.0, Math.log(k0), Math.log(k0)],
};

const klimpelH = (x: number) => (x === 0.0 ? 0.0 : 1.0 - -Math.expm1(-x) / x);
const klimpelDh = (x: number) => (x === 0.0 ? 0.0 : (-Math.expm1(-x) - x * Math.exp(-x)) / (x * x));

export const KLIMPEL: Model = {
  id: 'klimpel', names: ['R_inf', 'k'], units: ['1', '1/min'],
  natural: th => [logistic(th[0]), Math.exp(th[1])],
  chain: unitChain,
  value: (t, q) => q[0] * klimpelH(q[1] * t),
  gradient: (t, q) => [klimpelH(q[1] * t), q[0] * t * klimpelDh(q[1] * t)],
  project: ([a, k], cells, tau) => {
    const x = k * tau;
    const unfloated = cells === 1 ? Math.log1p(x) / x : -Math.expm1((1 - cells) * Math.log1p(x)) / ((cells - 1) * x);
    return a * (1.0 - unfloated);
  },
  start: (a0, k0) => [logit(a0), Math.log(k0)],
};

export const GAMMA: Model = {
  id: 'gamma', names: ['R_inf', 'a', 'p'], units: ['1', '1/min', '1'],
  natural: th => [logistic(th[0]), Math.exp(th[1]), Math.exp(th[2])],
  chain: th => [[logistic(th[0]) * (1.0 - logistic(th[0])), 0.0, 0.0], [0.0, Math.exp(th[1]), 0.0], [0.0, 0.0, Math.exp(th[2])]],
  value: (t, [a, rate, p]) => a * -Math.expm1(-p * Math.log1p(rate * t)),
  gradient: (t, [a, rate, p]) => {
    const base = Math.log1p(rate * t);
    const remaining = Math.exp(-p * base);
    return [-Math.expm1(-p * base), a * p * t * remaining / (1.0 + rate * t), a * remaining * base];
  },
  project: (q, n, tau) => q[0] * (1.0 - erlangMean(t => Math.exp(-q[2] * Math.log1p(q[1] * t)), n, tau)),
  start: (a0, k0) => [logit(a0), Math.log(k0), 0.0],
};

const stretchedBeta = (theta: number) => { const [low, high] = betaBounds(); return low + (high - low) * logistic(theta); };

export const STRETCHED: Model = {
  id: 'stretched_exponential', names: ['R_inf', 'k', 'beta'], units: ['1', '1/min', '1'],
  natural: th => [logistic(th[0]), Math.exp(th[1]), stretchedBeta(th[2])],
  chain: th => {
    const [low, high] = betaBounds();
    const la = logistic(th[0]); const lb = logistic(th[2]);
    return [[la * (1.0 - la), 0.0, 0.0], [0.0, Math.exp(th[1]), 0.0], [0.0, 0.0, (high - low) * lb * (1.0 - lb)]];
  },
  value: (t, [a, k, beta]) => (t === 0.0 ? 0.0 : a * -Math.expm1(-Math.exp(beta * Math.log(k * t)))),
  gradient: (t, [a, k, beta]) => {
    const logKt = Math.log(k * t);
    const z = Math.exp(beta * logKt);
    const ez = Math.exp(-z);
    return [-Math.expm1(-z), a * ez * z * beta / k, a * ez * z * logKt];
  },
  project: (q, n, tau) => q[0] * (1.0 - erlangMean(t => (t > 0.0 ? Math.exp(-Math.exp(q[2] * Math.log(q[1] * t))) : 1.0), n, tau)),
  start: (a0, k0) => { const [low, high] = betaBounds(); return [logit(a0), Math.log(k0), logit((1.0 - low) / (high - low))]; },
};

export const MODELS: Model[] = [FIRST_ORDER, KELSALL, KLIMPEL, GAMMA, STRETCHED];

class SingularNormalMatrix extends Error {}

/** Gaussian elimination with partial pivoting for the small normal systems (n <= 4). */
export function solveSmall(matrix: V[], rhs: V): V {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    if (a[col][col] === 0.0) throw new SingularNormalMatrix('singular normal matrix');
    for (let r = col + 1; r < n; r += 1) {
      const factor = a[r][col] / a[col][col];
      for (let c = col; c <= n; c += 1) a[r][c] -= factor * a[col][c];
    }
  }
  const x = new Array<number>(n).fill(0.0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let s = a[r][n];
    for (let c = r + 1; c < n; c += 1) s -= a[r][c] * x[c];
    x[r] = s / a[r][r];
  }
  return x;
}

export type Fit = { theta: V; sse: number; iterations: number; converged: boolean };

function residuals(model: Model, theta: V, times: V, observed: V): [V, V[]] {
  const q = model.natural(theta);
  const chain = model.chain(theta);
  const residual: V = [];
  const jacobian: V[] = [];
  for (let i = 0; i < times.length; i += 1) {
    residual.push(model.value(times[i], q) - observed[i]);
    const g = model.gradient(times[i], q);
    const row: V = [];
    for (let j = 0; j < theta.length; j += 1) {
      let s = 0.0;
      for (let m = 0; m < q.length; m += 1) s += g[m] * chain[m][j];
      row.push(s);
    }
    jacobian.push(row);
  }
  return [residual, jacobian];
}

export function levenbergMarquardt(model: Model, theta0: V, times: V, observed: V): Fit {
  let lam = constant('numerics.lm_initial_damping');
  const factor = constant('numerics.lm_damping_factor');
  const [lamMin, lamMax] = constant<number[]>('numerics.lm_damping_bounds');
  const floor = constant('numerics.lm_diagonal_floor');
  const tol = constant('numerics.lm_tolerance');
  const maxIterations = constant('numerics.lm_max_iterations');
  let theta = [...theta0];
  let [r, jac] = residuals(model, theta, times, observed);
  let sse = 0.0;
  for (const v of r) sse += v * v;
  const n = theta.length;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const normal: V[] = [];
    const grad: V = [];
    for (let a = 0; a < n; a += 1) {
      const row: V = [];
      for (let b = 0; b < n; b += 1) { let s = 0.0; for (const jr of jac) s += jr[a] * jr[b]; row.push(s); }
      normal.push(row);
      let g = 0.0;
      for (let i = 0; i < jac.length; i += 1) g += jac[i][a] * r[i];
      grad.push(g);
    }
    let trial: V = theta;
    let rT: V = r;
    let jacT: V[] = jac;
    let sseT = Infinity;
    let step: V = [];
    for (;;) {
      const damped = normal.map((row, a) => row.map((v, b) => v + (a === b ? lam * Math.max(normal[a][a], floor) : 0.0)));
      let ok = true;
      try { step = solveSmall(damped, grad.map(g => -g)); } catch (error) {
        if (!(error instanceof SingularNormalMatrix)) throw error;
        ok = false;
      }
      if (ok) {
        trial = theta.map((v, a) => v + step[a]);
        [rT, jacT] = residuals(model, trial, times, observed);
        sseT = 0.0;
        for (const v of rT) sseT += v * v;
        if (Number.isFinite(sseT) && sseT < sse) break;
      }
      lam *= factor;
      if (lam > lamMax) return { theta, sse, iterations: iteration, converged: true };
    }
    const decrease = sse - sseT;
    let maxStep = 0.0;
    let maxTheta = 0.0;
    for (let a = 0; a < n; a += 1) { maxStep = Math.max(maxStep, Math.abs(step[a])); maxTheta = Math.max(maxTheta, Math.abs(theta[a])); }
    const smallStep = maxStep <= tol * (1.0 + maxTheta);
    theta = trial; r = rT; jac = jacT; sse = sseT;
    lam = Math.max(lam / factor, lamMin);
    if (decrease <= tol * Math.max(sse, floor) || smallStep) return { theta, sse, iterations: iteration, converged: true };
  }
  return { theta, sse, iterations: maxIterations, converged: false };
}

const vsum = (v: Vec) => { let s = 0.0; for (let i = 0; i < v.length; i += 1) s += v[i]; return s; };

/** True-flotation batch recovery of a species at each time, summed over classes and sizes. */
export function batchCurve(rates: Species, feed: Species, content: Record<string, number>, times: V): V {
  let total = 0.0;
  for (const k of Object.keys(feed)) total += content[k] * vsum(feed[k]);
  return times.map(t => {
    let floated = 0.0;
    for (const k of Object.keys(feed)) {
      let s = 0.0;
      for (let i = 0; i < feed[k].length; i += 1) s += feed[k][i] * -Math.expm1(-rates[k][i] * t);
      floated += content[k] * s;
    }
    return floated / total;
  });
}

/** Exact true-flotation recovery of the same classes in N perfect mixers (no lumping). */
export function distributedBank(rates: Species, feed: Species, content: Record<string, number>, cells: number, tauC: number): number {
  let total = 0.0;
  let floated = 0.0;
  for (const k of Object.keys(feed)) {
    total += content[k] * vsum(feed[k]);
    let s = 0.0;
    for (let i = 0; i < feed[k].length; i += 1) s += feed[k][i] * (1.0 - Math.pow(1.0 + rates[k][i] * tauC, -cells));
    floated += content[k] * s;
  }
  return floated / total;
}

function halfTimeRate(times: V, observed: V, ultimate: number): number {
  const target = ultimate / 2.0;
  let prevT = 0.0;
  let prevY = 0.0;
  for (let i = 0; i < times.length; i += 1) {
    if (observed[i] >= target) {
      const tHalf = prevT + (target - prevY) * (times[i] - prevT) / (observed[i] - prevY);
      return Math.log(2.0) / tHalf;
    }
    prevT = times[i];
    prevY = observed[i];
  }
  return Math.log(2.0) / times[times.length - 1];
}

export function kineticRecord(flotation: FlotationResult, ore: ResolvedOre, cells: number, engineRougherPct: number): Record<string, unknown> {
  const defs = flotation.defs;
  const primary = ore.primary;
  const content: Record<string, number> = {};
  for (const d of defs) content[d.id] = speciesContentOf(d, ore, primary);
  const rates = flotation.rates_rougher;
  const feed = flotation.rougher_feed_species;
  const times = constant<number[]>('batch.times_min');
  const observed = batchCurve(rates, feed, content, times);
  const tauC = flotation.rougher.tau_cell_min;
  const exact = distributedBank(rates, feed, content, cells, tauC);
  const last = times[times.length - 1];
  const denseCount = constant('kinetics.dense_points');
  const dense = Array.from({ length: denseCount }, (_, i) => last * i / (denseCount - 1));
  const ultimate0 = (1.0 + Math.max(...observed)) / 2.0;
  const k0 = halfTimeRate(times, observed, ultimate0);
  const models = MODELS.map(model => {
    const fit = levenbergMarquardt(model, model.start(ultimate0, k0), times, observed);
    const q = model.natural(fit.theta);
    const fitted = times.map(t => model.value(t, q));
    const projection = model.project(q, cells, tauC);
    const parameters: Record<string, number> = {};
    const parameterUnits: Record<string, string> = {};
    model.names.forEach((name, i) => {
      const percent = name === 'R_inf' || name === 'phi';
      parameters[name] = percent ? 100.0 * q[i] : q[i];
      parameterUnits[name] = percent ? '%' : model.units[i];
    });
    return {
      id: model.id, parameters, parameter_units: parameterUnits, rmse_pct: 100.0 * Math.sqrt(fit.sse / times.length),
      iterations: fit.iterations, converged: fit.converged, fitted_pct: fitted.map(v => 100.0 * v),
      dense_pct: dense.map(t => 100.0 * model.value(t, q)), bank_projection_pct: 100.0 * projection,
      lumping_error_pct: 100.0 * (projection - exact), ultimate_gap_pct: 100.0 * (q[0] - fitted[fitted.length - 1]),
    };
  });
  return {
    status: 'computed', species: primary, times_min: times, batch_recovery_pct: observed.map(v => 100.0 * v), dense_times_min: dense,
    bank: { cells, cell_residence_min: tauC, residence_min: tauC * cells, exact_true_flotation_pct: 100.0 * exact,
      engine_rougher_pct: engineRougherPct },
    models,
  };
}
