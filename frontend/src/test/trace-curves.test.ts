import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import type { OperatingContract } from '../engine/contract';
import type { Ore } from '../engine/model';
import type { Trace } from '../engine/trace';

// PE-36: every value the grinding and separation charts plot is a number of the trace, copied, reversed
// or shown in a display unit (a fraction as a percentage, a mass fraction in ppm); no chart computes a
// quantity of its own. The chart elements are inspected as built, without rendering them.
vi.mock('uplot', () => ({ default: class {} }));
vi.mock('uplot/dist/uPlot.min.css', () => ({}));
const { grindingCharts } = await import('../workbench/views/GrindingView');
const { separationCharts } = await import('../workbench/views/SeparationView');

const contract = contractDoc as unknown as OperatingContract;
const root = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
const files = readdirSync(root).filter(f => f.endsWith('.json')).sort();
/** Display units: 1 (as stored), 100 (fraction to %), 1e6 (mass fraction to ppm, g/t). */
const SCALES = [1, 100, 1e6];

function numbers(value: unknown, out: number[]): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach(v => numbers(v, out));
  else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(v => numbers(v, out));
  return out;
}

function member(sorted: number[], value: number): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  const tolerance = 1e-12 * Math.max(1, Math.abs(value));
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (Math.abs(sorted[mid] - value) <= tolerance) return true;
    if (sorted[mid] < value) lo = mid + 1; else hi = mid - 1;
  }
  return false;
}

describe('the charts plot the trace', () => {
  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(root, file), 'utf-8')) as {
      case_id: string; definition: { ore: Ore }; variants: Array<{ id: string; trace: Trace }>;
    };
    it(artifact.case_id, () => {
      for (const variant of artifact.variants) {
        const trace = variant.trace;
        const primary = contract.cases[artifact.case_id].primary;
        const known = numbers([trace.curves, trace.methods, trace.metrics, (trace as Record<string, unknown>).point], []).sort((a, b) => a - b);
        const charts = { ...grindingCharts(trace, artifact.definition.ore, 'en', () => undefined), ...separationCharts(trace, primary, 'en', () => undefined) };
        expect(Object.keys(charts).length).toBeGreaterThanOrEqual(4);
        for (const [id, element] of Object.entries(charts)) {
          const data = (element as ReactElement<{ data: (number | null)[][] }>).props.data;
          const invented = data.flatMap((series, k) => series.flatMap((v, i) => (
            v === null || SCALES.some(s => member(known, v / s)) ? [] : [`${id} series ${k} point ${i}: ${v}`])));
          expect(invented, `${artifact.case_id}:${variant.id}`).toEqual([]);
        }
      }
    });
  }
});
