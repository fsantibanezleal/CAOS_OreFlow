import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { OperatingPoint, Ore, Plant } from '../engine';
import { simulate } from '../engine/circuit';

// RS-06: the browser runs every GeoMet sample's ore through the soft porphyry's circuit at the recorded point and
// reproduces the bake's metrics within 1e-6 relative, and its flags exactly. The audit residuals are round-off
// magnitudes and are bounded absolutely instead, as in parity.test.ts. OF_DERIVED points a development run at a
// sandbox bake.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const record = JSON.parse(readFileSync(join(derived, 'real_samples.json'), 'utf-8')) as {
  plant: Plant;
  samples: Array<{ id: string; ore: Ore; point: OperatingPoint; metrics: Record<string, number>; flags: string[] }>;
};
const RELATIVE = 1e-6;
const RESIDUALS = new Set(['balance_max_relative_error', 'species_consistency_error']);
const close = (a: number, b: number) => Math.abs(a - b) <= RELATIVE * Math.max(Math.abs(a), Math.abs(b), 1e-12);

describe('the browser reproduces the real-sample runs', () => {
  it('covers the 52 usable locked-cycle samples', () => { expect(record.samples.length).toBe(52); });

  for (const sample of record.samples) {
    it(sample.id, () => {
      const result = simulate(sample.ore, record.plant, sample.point);
      const problems: string[] = [];
      for (const [key, baked] of Object.entries(sample.metrics)) {
        const mine = result.metrics[key];
        if (RESIDUALS.has(key)) { if (!(mine <= 1e-9)) problems.push(`${key}: ${mine}`); continue; }
        if (mine === undefined || !close(mine, baked)) problems.push(`${key}: ${mine} vs ${baked}`);
      }
      expect(problems).toEqual([]);
      expect(result.flags.map(f => f.code).sort()).toEqual([...sample.flags].sort());
    });
  }
});
