import { describe, expect, it } from 'vitest';
import { analyzeEnvelope, defaultEnvelopeLimits, dominates, envelopeReport, type EnvelopePoint } from '../live/operatingEnvelope';

const params = { feed_tph: 640, feed_grade_pct: .74, feed_p80_um: 14000, hardness_kwh_t: 11, density_t_m3: 2.65, grind_p80_um: 165, classifier_cut_um: 125, flotation_time_min: 18, air_rate_m3_min: 2.4, reagent_gpt: 145, water_m3_t: 2.2 };

describe('finite operating-envelope study', () => {
  it('is deterministic, case-scoped and physically bounded', () => {
    const limits = defaultEnvelopeLimits(params, 'copper_porphyry_soft');
    const one = analyzeEnvelope(params, 'copper_porphyry_soft', limits);
    const two = analyzeEnvelope(params, 'copper_porphyry_soft', limits);
    expect(one).toEqual(two);
    expect(one.family).toBe('rougher');
    expect(one.candidates.length).toBe(49);
    expect(one.baseline.recoveryPct).toBeGreaterThan(0);
    expect(one.candidates.every(point => point.grindUm >= 35 && point.grindUm <= 500 && point.secondValue >= 20 && point.secondValue <= 600)).toBe(true);
    expect(one.candidates.every(point => point.stressMinRecoveryPct <= point.recoveryPct + 1e-9)).toBe(true);
    expect(one.feasibleCount).toBeGreaterThan(0);
    expect(one.frontierCount).toBeGreaterThan(0);
    expect(one.candidates.find(point => point.id === one.recommendedId)?.feasible).toBe(true);
  });

  it('uses feed instead of flotation reagent for the magnetic family', () => {
    const p = { ...params, feed_tph: 920, feed_grade_pct: 28, density_t_m3: 3.9, feed_p80_um: 9000, grind_p80_um: 95 };
    const result = analyzeEnvelope(p, 'iron_magnetite_fine', defaultEnvelopeLimits(p, 'iron_magnetite_fine'));
    expect(result.family).toBe('magnetic');
    expect(new Set(result.candidates.map(point => point.params.feed_tph)).size).toBeGreaterThan(1);
    expect(new Set(result.candidates.map(point => point.params.reagent_gpt)).size).toBe(1);
    expect(result.candidates.every(point => point.stressMinRecoveryPct <= point.recoveryPct + 1e-9)).toBe(true);
  });

  it('recognizes gravity and deslime circuits without replacing their physics', () => {
    for (const [id, family] of [['gold_free_milling', 'gravity_rougher'], ['phosphate_clay', 'deslime_rougher']] as const) {
      const result = analyzeEnvelope(params, id, defaultEnvelopeLimits(params, id));
      expect(result.family).toBe(family);
      expect(result.candidates).toHaveLength(49);
      expect(result.candidates.some(point => point.recoveryPct !== result.baseline.recoveryPct)).toBe(true);
    }
  });

  it('reports impossible limits with no recommendation', () => {
    const limits = { ...defaultEnvelopeLimits(params, 'copper_porphyry_soft'), minRecoveryPct: 100 };
    const result = analyzeEnvelope(params, 'copper_porphyry_soft', limits);
    expect(result.feasibleCount).toBe(0);
    expect(result.frontierCount).toBe(0);
    expect(result.recommendedId).toBeNull();
    expect(result.candidates.every(point => point.failures.includes('minRecoveryPct'))).toBe(true);
  });

  it('keeps only non-dominated feasible samples', () => {
    const result = analyzeEnvelope(params, 'copper_porphyry_soft', defaultEnvelopeLimits(params, 'copper_porphyry_soft'));
    const feasible = result.candidates.filter(point => point.feasible);
    for (const point of feasible) {
      expect(point.pareto).toBe(!feasible.some(other => other !== point && dominates(other, point, result.family)));
    }
    const a = { recoveredValuableTph: 2, powerMw: 4, collectorKgH: 40, waterM3H: 100 } as EnvelopePoint;
    const b = { recoveredValuableTph: 1, powerMw: 5, collectorKgH: 50, waterM3H: 100 } as EnvelopePoint;
    expect(dominates(a, b, 'rougher')).toBe(true);
    expect(dominates(b, a, 'rougher')).toBe(false);
  });

  it('exports every tested row and the scientific boundary', () => {
    const result = analyzeEnvelope(params, 'copper_porphyry_soft', defaultEnvelopeLimits(params, 'copper_porphyry_soft'));
    const record = JSON.parse(JSON.stringify(envelopeReport(result, result.recommendedId)));
    expect(record.schema).toBe('oreflow.operating-envelope/v1');
    expect(record.case_id).toBe('copper_porphyry_soft');
    expect(record.selected_id).toBe(result.recommendedId);
    expect(record.candidates).toHaveLength(result.candidates.length);
    expect(record.basis).toContain('not calibrated plant prediction');
    expect(record.stress).toContain('not a confidence bound');
  });
});
