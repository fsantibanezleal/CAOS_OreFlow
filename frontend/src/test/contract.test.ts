import { describe, expect, it } from 'vitest';
import { simulateLive } from '../live/engine';

const params = { feed_tph: 640, feed_grade_pct: .74, feed_p80_um: 14000, hardness_kwh_t: 11, density_t_m3: 2.65, grind_p80_um: 165, classifier_cut_um: 125, flotation_time_min: 18, air_rate_m3_min: 2.4, reagent_gpt: 145, water_m3_t: 2.2 };
describe('OreFlow live contract', () => {
  it('returns aligned curves and a closed balance', () => {
    const trace = simulateLive(params, 'test');
    expect(trace.schema).toBe('oreflow.trace/v1');
    expect(trace.size_um).toHaveLength(96);
    expect(trace.feed_psd).toHaveLength(trace.size_um.length);
    expect(trace.metrics.metal_balance_pct).toBe(100);
  });
  it('responds to grind and residence changes', () => {
    const coarse = simulateLive({ ...params, grind_p80_um: 300 }, 'test');
    const fine = simulateLive({ ...params, grind_p80_um: 100, flotation_time_min: 35 }, 'test');
    expect(fine.metrics.recovery_pct).toBeGreaterThan(coarse.metrics.recovery_pct);
    expect(fine.metrics.specific_energy_kwh_t).toBeGreaterThan(coarse.metrics.specific_energy_kwh_t);
  });
});
