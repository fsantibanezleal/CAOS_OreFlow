import type { Params } from '../lib/contract.types';
import { simulateLive } from './engine';

export type ProcessFamily = 'rougher' | 'gravity_rougher' | 'magnetic' | 'deslime_rougher';
export type EnvelopeLimits = {
  minRecoveryPct: number;
  minStressRecoveryPct: number;
  minGradePct: number;
  maxEnergyKwhT: number;
  maxWaterM3H: number;
  maxCollectorGpt: number;
};
export type EnvelopePoint = {
  id: string;
  params: Params;
  grindUm: number;
  secondValue: number;
  recoveryPct: number;
  gradePct: number;
  energyKwhT: number;
  powerMw: number;
  waterM3H: number;
  collectorKgH: number;
  recoveredValuableTph: number;
  stressMinRecoveryPct: number;
  failures: Array<keyof EnvelopeLimits>;
  feasible: boolean;
  pareto: boolean;
};
export type EnvelopeResult = {
  family: ProcessFamily;
  caseId: string;
  baseline: EnvelopePoint;
  limits: EnvelopeLimits;
  candidates: EnvelopePoint[];
  feasibleCount: number;
  frontierCount: number;
  recommendedId: string | null;
  bounds: { grindUm: [number, number]; second: [number, number] };
};

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

export function processFamily(caseId: string): ProcessFamily {
  if (caseId === 'iron_magnetite_fine') return 'magnetic';
  if (caseId === 'gold_free_milling') return 'gravity_rougher';
  if (caseId === 'phosphate_clay') return 'deslime_rougher';
  return 'rougher';
}

export function defaultEnvelopeLimits(p: Params, caseId: string): EnvelopeLimits {
  const m = simulateLive(p, caseId).metrics;
  return {
    minRecoveryPct: Number((m.recovery_pct * 0.92).toFixed(2)),
    minStressRecoveryPct: Number((stressMinimum(p, caseId, m.recovery_pct) * 0.92).toFixed(2)),
    minGradePct: Number((m.concentrate_grade_pct * 0.85).toFixed(3)),
    maxEnergyKwhT: Number((m.specific_energy_kwh_t * 1.2).toFixed(2)),
    maxWaterM3H: Number((m.water_use_m3_h * 1.2).toFixed(1)),
    maxCollectorGpt: Number((p.reagent_gpt * 1.3).toFixed(1)),
  };
}

function stressMinimum(p: Params, caseId: string, nominalRecovery: number): number {
  const stressed = [nominalRecovery, simulateLive({ ...p, hardness_kwh_t: p.hardness_kwh_t * 1.1 }, caseId).metrics.recovery_pct];
  if (processFamily(caseId) !== 'magnetic') {
    stressed.push(simulateLive({ ...p, classifier_cut_um: p.classifier_cut_um * 0.9 }, caseId).metrics.recovery_pct);
    stressed.push(simulateLive({ ...p, classifier_cut_um: p.classifier_cut_um * 1.1 }, caseId).metrics.recovery_pct);
  }
  return Math.min(...stressed);
}

function axis(center: number, lo: number, hi: number, factors: number[]): number[] {
  return [...new Set(factors.map(factor => Number(clamp(center * factor, lo, hi).toFixed(3))))].sort((a, b) => a - b);
}

function measure(p: Params, caseId: string, id: string, secondValue: number, limits: EnvelopeLimits): EnvelopePoint {
  const m = simulateLive(p, caseId).metrics;
  const family = processFamily(caseId);
  const stressMinRecoveryPct = stressMinimum(p, caseId, m.recovery_pct);
  const failures: Array<keyof EnvelopeLimits> = [];
  if (m.recovery_pct < limits.minRecoveryPct - 1e-9) failures.push('minRecoveryPct');
  if (stressMinRecoveryPct < limits.minStressRecoveryPct - 1e-9) failures.push('minStressRecoveryPct');
  if (m.concentrate_grade_pct < limits.minGradePct - 1e-9) failures.push('minGradePct');
  if (m.specific_energy_kwh_t > limits.maxEnergyKwhT + 1e-9) failures.push('maxEnergyKwhT');
  if (m.water_use_m3_h > limits.maxWaterM3H + 1e-9) failures.push('maxWaterM3H');
  if (family !== 'magnetic' && p.reagent_gpt > limits.maxCollectorGpt + 1e-9) failures.push('maxCollectorGpt');
  return {
    id, params: { ...p }, grindUm: p.grind_p80_um, secondValue,
    recoveryPct: m.recovery_pct, gradePct: m.concentrate_grade_pct,
    energyKwhT: m.specific_energy_kwh_t, powerMw: p.feed_tph * m.specific_energy_kwh_t / 1000,
    waterM3H: m.water_use_m3_h, collectorKgH: p.feed_tph * p.reagent_gpt / 1000,
    recoveredValuableTph: p.feed_tph * p.feed_grade_pct / 100 * m.recovery_pct / 100,
    stressMinRecoveryPct, failures, feasible: failures.length === 0, pareto: false,
  };
}

// Exact non-dominance for the finite, feasible sample; no convergence or continuous optimality claim.
export function dominates(a: EnvelopePoint, b: EnvelopePoint, family: ProcessFamily): boolean {
  const costA = family === 'magnetic' ? a.waterM3H : a.collectorKgH;
  const costB = family === 'magnetic' ? b.waterM3H : b.collectorKgH;
  const noWorse = a.recoveredValuableTph >= b.recoveredValuableTph - 1e-9 && a.powerMw <= b.powerMw + 1e-9 && costA <= costB + 1e-9;
  const better = a.recoveredValuableTph > b.recoveredValuableTph + 1e-9 || a.powerMw < b.powerMw - 1e-9 || costA < costB - 1e-9;
  return noWorse && better;
}

export function analyzeEnvelope(p: Params, caseId: string, limits: EnvelopeLimits): EnvelopeResult {
  const family = processFamily(caseId);
  const grind = axis(p.grind_p80_um, 35, Math.min(500, p.feed_p80_um * 0.85), [0.65, 0.78, 0.9, 1, 1.1, 1.23, 1.35]);
  const second = family === 'magnetic'
    ? axis(p.feed_tph, 100, 1800, [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3])
    : axis(p.reagent_gpt, 20, 600, [0.65, 0.78, 0.9, 1, 1.1, 1.23, 1.35]);
  const baseline = measure(p, caseId, 'baseline', family === 'magnetic' ? p.feed_tph : p.reagent_gpt, limits);
  const candidates = grind.flatMap((grindUm, yi) => second.map((value, xi) => {
    const candidate = family === 'magnetic'
      ? { ...p, grind_p80_um: grindUm, feed_tph: value }
      : { ...p, grind_p80_um: grindUm, reagent_gpt: value };
    return measure(candidate, caseId, `${yi}-${xi}`, value, limits);
  }));
  const feasible = candidates.filter(point => point.feasible);
  for (const point of feasible) point.pareto = !feasible.some(other => other !== point && dominates(other, point, family));
  const frontier = feasible.filter(point => point.pareto);
  const recommended = [...frontier].sort((a, b) => b.recoveredValuableTph - a.recoveredValuableTph || a.powerMw - b.powerMw || a.id.localeCompare(b.id))[0];
  return {
    family, caseId, baseline, limits, candidates, feasibleCount: feasible.length,
    frontierCount: frontier.length, recommendedId: recommended?.id ?? null,
    bounds: { grindUm: [grind[0], grind.at(-1)!], second: [second[0], second.at(-1)!] },
  };
}

export function envelopeReport(result: EnvelopeResult, selectedId: string | null) {
  return {
    schema: 'oreflow.operating-envelope/v1', generated_at: new Date().toISOString(),
    case_id: result.caseId, process_family: result.family,
    basis: 'authored one-pass simulator; finite conditional sample; not calibrated plant prediction',
    ranking: 'maximum recovered valuable t/h among feasible non-dominated sampled points; lower MW breaks ties',
    stress: '+10% hardness and, where classification applies, classifier cut ±10%; minimum recovery, not a confidence bound',
    axes: result.family === 'magnetic' ? ['grind_p80_um', 'feed_tph'] : ['grind_p80_um', 'reagent_gpt'],
    bounds: result.bounds, limits: result.limits, baseline: result.baseline,
    selected_id: selectedId, recommended_id: result.recommendedId,
    candidates: result.candidates,
  };
}
