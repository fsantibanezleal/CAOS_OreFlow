import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import type { OperatingContract } from '../engine/contract';
import type { Trace } from '../engine/trace';

// U-36 (review of 2026-10-02): a separation chart spans the sizes its feed carries (the flotation, LIMS and desliming
// axes ran to 137 mm, 60% of their width empty), and curves a reader cannot tell apart are drawn once
vi.mock('uplot', () => ({ default: class {} }));
vi.mock('uplot/dist/uPlot.min.css', () => ({}));
const { separationCharts, mergeCoincident, feedTop } = await import('../workbench/views/SeparationView');

const contract = contractDoc as unknown as OperatingContract;
const root = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
const files = readdirSync(root).filter(f => f.endsWith('.json')).sort();

describe('separation charts span their feed', () => {
  it('merges curves within 0.01 of one another and keeps the rest', () => {
    const merged = mergeCoincident(['a', 'b', 'c'], [[0, 0.5, 1], [0.005, 0.505, 0.995], [0, 0.4, 1]], 'en');
    expect(merged.labels).toEqual(['a and b (coincide)', 'c']);
    expect(merged.ys).toHaveLength(2);
    expect(mergeCoincident(['a', 'b'], [[0, 0.5], [0, 0.52]], 'es').labels).toEqual(['a', 'b']);
  });

  it('starts one class above the top of the cyclone overflow', () => {
    expect(feedTop({ cyclone_overflow: [1, 1, 1, 0.98, 0.5] })).toBe(2);
    expect(feedTop({ cyclone_overflow: [0.9, 0.5] })).toBe(0);
    expect(feedTop(undefined)).toBe(0);
  });

  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(root, file), 'utf-8')) as { case_id: string; variants: Array<{ id: string; trace: Trace }> };
    it(artifact.case_id, () => {
      for (const variant of artifact.variants) {
        const trace = variant.trace;
        const curves = trace.curves as Record<string, unknown>;
        const size = curves.size_um as number[];
        const overflow = (curves.psd as Record<string, number[]>).cyclone_overflow;
        // the overflow's top: the coarsest class it carries mass in, and the class above it
        const top = size[Math.max(0, overflow.findIndex(p => p < 0.99999) - 1)];
        const charts = separationCharts(trace, contract.cases[artifact.case_id].primary, 'en', () => undefined);
        for (const id of ['recovery_by_size', 'capture', 'deslime'] as const) {
          const element = charts[id] as ReactElement<{ data: number[][]; series: Array<{ label: string }> }> | undefined;
          if (!element) continue;
          const xs = element.props.data[0];
          expect(Math.max(...xs), `${artifact.case_id}:${variant.id}:${id}`).toBeLessThanOrEqual(top * 1.0001);
          expect(Math.max(...xs)).toBeLessThan(2000);
          // no two drawn curves stay within 0.01 of one another everywhere
          const ys = element.props.data.slice(1);
          for (let i = 0; i < ys.length; i += 1) {
            for (let j = i + 1; j < ys.length; j += 1) {
              const apart = ys[i].some((v, k) => v !== null && ys[j][k] !== null && Math.abs(v - ys[j][k]) > 0.01);
              expect(apart, `${artifact.case_id}:${variant.id}:${id} series ${i} and ${j}`).toBe(true);
            }
          }
        }
      }
    });
  }
});
