import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { simulateLive } from '../live/engine';
import type { CaseArtifact } from '../lib/contract.types';
import { loadIndex } from '../api/artifacts';
import { APP_VERSION } from '../lib/version';
import { derivePartitionBins, groupPartitionBins, partitionTotals } from '../components/PartitionField';

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
  it('conserves solids in every rendered size bin for the local engine', () => {
    const trace = simulateLive(params, 'test');
    const bins = derivePartitionBins(trace);
    const grouped = groupPartitionBins(bins);
    expect(bins).toHaveLength(trace.size_um.length);
    expect(grouped.length).toBeLessThanOrEqual(24);
    for (const bin of bins) {
      expect(bin.ground).toBeGreaterThanOrEqual(-1e-10);
      expect(bin.overflow).toBeGreaterThanOrEqual(-1e-10);
      expect(bin.underflow).toBeGreaterThanOrEqual(-1e-10);
      expect(bin.ground).toBeCloseTo(bin.overflow + bin.underflow, 10);
    }
    const totals = partitionTotals(grouped);
    expect(totals.ground).toBeCloseTo(1, 5);
    expect(totals.overflow).toBeCloseTo(trace.metrics.overflow_fraction, 5);
    expect(totals.underflow).toBeCloseTo(1 - trace.metrics.overflow_fraction, 5);
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
        expect(variant.method_outputs).toHaveLength(21);
        const live = simulateLive(variant.params, data.case_id);
        for (const key of ['recovery_pct', 'concentrate_grade_pct', 'specific_energy_kwh_t', 'overflow_fraction', 'concentrate_tph', 'water_use_m3_h', 'flotation_recovery_pct']) {
          expect(Math.abs(live.metrics[key] - variant.metrics[key]), `${data.case_id}/${variant.id}/${key}`).toBeLessThan(1e-6);
        }
        if (data.process_family === 'gravity_rougher') {
          expect(live.metrics.gravity_recovery_pct).toBeGreaterThan(0);
          expect(live.metrics.gravity_recovery_pct).toBeCloseTo(variant.metrics.gravity_recovery_pct, 6);
          expect(live.metrics.gravity_product_tph).toBeCloseTo(variant.metrics.gravity_product_tph, 6);
          expect(live.metrics.rougher_product_tph).toBeCloseTo(variant.metrics.rougher_product_tph, 6);
        }
        if (data.process_family === 'magnetic') {
          expect(live.metrics.magnetic_recovery_pct).toBeCloseTo(variant.metrics.magnetic_recovery_pct, 6);
          expect(live.metrics.magnetic_product_tph).toBeCloseTo(variant.metrics.concentrate_tph, 6);
          expect(live.metrics.flotation_recovery_pct).toBe(0);
          expect(variant.method_outputs.find(method => method.id === 'first_order')?.status).toBe('not-applicable');
          expect(variant.method_outputs.find(method => method.id === 'lims_capture')?.status).toBe('precomputed');
        }
        if (data.process_family === 'deslime_rougher') {
          expect(variant.metrics.concentrate_tph).toBeLessThan(variant.params.feed_tph * (1 - variant.metrics.overflow_fraction));
          expect(variant.method_outputs.find(method => method.id === 'partition')?.status).toBe('precomputed');
        }
        for (const key of ['feed_psd', 'crushed_psd', 'ground_psd', 'overflow_psd', 'flotation_recovery'] as const) {
          expect(live[key]).toHaveLength(variant.trace[key].length);
          expect(Math.max(...live[key].map((v, i) => Math.abs(v - variant.trace[key][i]))), `${data.case_id}/${variant.id}/${key}`).toBeLessThan(1e-6);
        }
      }
    }
  });
});
