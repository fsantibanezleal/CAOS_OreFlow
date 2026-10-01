import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { OperatingPoint, Ore, Plant } from '../engine';
import { uncertainty, UNCERTAIN_OUTPUTS } from '../engine/uncertainty';

// UQ-05: the browser re-runs each nominal state's uncertainty record from the baked seed and sample count. The
// design is the bake's bit for bit (the same SplitMix64 stream), and every quantile, moment and probability agrees
// within 1e-6 relative, because each sample is an engine run and the engines agree to that tolerance.
// OF_DERIVED points a development run at a sandbox bake; by default the committed records are compared
const root = process.env.OF_DERIVED ? join(process.env.OF_DERIVED, 'cases') : fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
const files = readdirSync(root).filter(f => f.endsWith('.json')).sort();
const RELATIVE = 1e-6;

type Baked = {
  case_id: string; definition: { ore: Ore; plant: Plant };
  variants: Array<{ id: string; point: OperatingPoint; methods: { uncertainty: {
    samples: number; seed: number; factors: number[][]; probabilities: Record<string, number>;
    outputs: Record<string, { p05: number; p50: number; p95: number; mean: number; std: number; base: number }>;
  } } }>;
};

const close = (a: number, b: number) => Math.abs(a - b) <= RELATIVE * Math.max(Math.abs(a), Math.abs(b), 1e-12);

describe('the browser reproduces the baked uncertainty records', () => {
  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(root, file), 'utf-8')) as Baked;
    const nominal = artifact.variants[0];
    it(artifact.case_id, () => {
      const baked = nominal.methods.uncertainty;
      const mine = uncertainty(artifact.definition.ore, artifact.definition.plant, nominal.point, baked.samples, baked.seed);
      expect(mine.factors).toEqual(baked.factors); // exact: the same generator and the same arithmetic
      const problems: string[] = [];
      for (const key of UNCERTAIN_OUTPUTS) {
        for (const stat of ['p05', 'p50', 'p95', 'mean', 'std', 'base'] as const) {
          if (!close(mine.outputs[key][stat], baked.outputs[key][stat])) problems.push(`${key}.${stat}: ${mine.outputs[key][stat]} vs ${baked.outputs[key][stat]}`);
        }
      }
      expect(problems).toEqual([]);
      expect(mine.probabilities).toEqual(baked.probabilities); // shares of 128 samples: exact unless a check sits on its limit
    }, 120_000);
  }
});
