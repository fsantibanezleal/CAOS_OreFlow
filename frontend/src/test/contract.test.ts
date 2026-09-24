import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { simulateLive } from '../live/engine';
import type { CaseArtifact } from '../lib/contract.types';
import { loadIndex } from '../api/artifacts';
import { APP_VERSION } from '../lib/version';

const params = { feed_tph: 640, feed_grade_pct: .74, feed_p80_um: 14000, hardness_kwh_t: 11, density_t_m3: 2.65, grind_p80_um: 165, classifier_cut_um: 125, flotation_time_min: 18, air_rate_m3_min: 2.4, reagent_gpt: 145, water_m3_t: 2.2 };
describe('OreFlow live contract', () => {
  it('requests the current artifact version without a browser cache', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = mockFetch;
    try {
      await loadIndex();
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`manifests/index.json?v=${APP_VERSION}`), { cache: 'no-store' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  it('returns aligned curves and a closed balance', () => {
    const trace = simulateLive(params, 'test');
    expect(trace.schema).toBe('oreflow.trace/v1');
    expect(trace.size_um).toHaveLength(96);
    expect(trace.feed_psd).toHaveLength(trace.size_um.length);
    expect(trace.overflow_psd.every((v, i) => i === 0 || v >= trace.overflow_psd[i - 1] - 1e-12)).toBe(true);
    expect(trace.overflow_psd.at(-1)).toBeCloseTo(1);
    expect(trace.metrics.metal_balance_pct).toBe(100);
  });
  it('changes the mass split and circuit recovery when the classifier moves', () => {
    const fine = simulateLive({ ...params, classifier_cut_um: 60 }, 'test');
    const coarse = simulateLive({ ...params, classifier_cut_um: 200 }, 'test');
    expect(fine.metrics.overflow_fraction).toBeLessThan(coarse.metrics.overflow_fraction);
    expect(fine.metrics.recovery_pct).toBeLessThan(coarse.metrics.recovery_pct);
  });
  it('responds to grind and residence changes', () => {
    const coarse = simulateLive({ ...params, grind_p80_um: 300 }, 'test');
    const fine = simulateLive({ ...params, grind_p80_um: 100, flotation_time_min: 35 }, 'test');
    expect(fine.metrics.recovery_pct).toBeGreaterThan(coarse.metrics.recovery_pct);
    expect(fine.metrics.specific_energy_kwh_t).toBeGreaterThan(coarse.metrics.specific_energy_kwh_t);
  });
});

describe('browser/Python artifact parity', () => {
  it('reproduces the circuit metrics and distributions in all 72 baked variants', () => {
    const casesDir = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
    const names = readdirSync(casesDir).filter(name => name.endsWith('.json'));
    expect(names).toHaveLength(12);
    for (const name of names) {
      const data = JSON.parse(readFileSync(fileURLToPath(new URL(`../../../data/derived/cases/${name}`, import.meta.url)), 'utf8')) as CaseArtifact;
      expect(data.variants).toHaveLength(6);
      for (const variant of data.variants) {
        const live = simulateLive(variant.params, data.case_id);
        for (const key of ['recovery_pct', 'concentrate_grade_pct', 'specific_energy_kwh_t', 'overflow_fraction', 'concentrate_tph', 'water_use_m3_h']) {
          expect(Math.abs(live.metrics[key] - variant.metrics[key]), `${data.case_id}/${variant.id}/${key}`).toBeLessThan(1e-6);
        }
        for (const key of ['feed_psd', 'crushed_psd', 'ground_psd', 'overflow_psd', 'flotation_recovery'] as const) {
          expect(live[key]).toHaveLength(variant.trace[key].length);
          expect(Math.max(...live[key].map((v, i) => Math.abs(v - variant.trace[key][i]))), `${data.case_id}/${variant.id}/${key}`).toBeLessThan(1e-6);
        }
      }
    }
  });
});
