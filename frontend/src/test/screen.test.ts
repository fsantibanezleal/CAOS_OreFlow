import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { OperatingPoint, Ore, Plant } from '../engine';
import { features } from '../learning/features';
import { choleskyFrom, Screen, type ScreenDoc } from '../learning/screen';
import type { Scalers } from '../learning/surrogate';

// OP-05, OP-08: the browser's screen (float64 networks from the exported weights, and the Gaussian process from its
// training rows, alpha and Cholesky factor) reproduces the bake's view of every case's nominal state: the three
// predicted targets, the guard's reconstruction error and the 95% half-width on recovery, within 1e-9 relative.
// OF_MODELS points a development run at a sandbox bake.
const models = process.env.OF_MODELS ?? fileURLToPath(new URL('../../../models/', import.meta.url));
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
type Reference = { case_id: string; features: number[]; prediction: Record<string, number>; guard_error: number; half_width: number };
const doc = JSON.parse(readFileSync(join(models, 'process_screen.json'), 'utf-8')) as ScreenDoc & { reference: Reference[] };
const scalers = JSON.parse(readFileSync(join(models, 'process_surrogate.json'), 'utf-8')) as Scalers;
const bin = readFileSync(join(models, doc.gp.cholesky.file));
const screen = new Screen(doc, scalers, choleskyFrom(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)));
const RELATIVE = 1e-9;
const close = (a: number, b: number) => Math.abs(a - b) <= RELATIVE * Math.max(Math.abs(a), Math.abs(b), 1e-12);

describe('the browser screen reproduces the bake reference', () => {
  it('declares a lower-triangular factor of the declared size and covers every case', () => {
    expect(doc.gp.cholesky.values).toBe((doc.gp.rows * (doc.gp.rows + 1)) / 2);
    expect(doc.reference.length).toBe(12);
    expect(doc.networks.surrogate.map(l => l.activation)).toEqual(['silu', 'silu', null]);
    expect(doc.networks.guard.map(l => l.activation)).toEqual(['tanh', 'tanh', 'tanh', null]);
  });

  for (const row of doc.reference) {
    it(row.case_id, () => {
      const artifact = JSON.parse(readFileSync(join(derived, 'cases', `${row.case_id}.json`), 'utf-8')) as {
        definition: { ore: Ore; plant: Plant }; variants: Array<{ id: string; point: OperatingPoint }>;
      };
      const nominal = artifact.variants.find(v => v.id === 'nominal')!;
      const x = features(artifact.definition.ore, artifact.definition.plant, nominal.point);
      x.forEach((v, i) => expect(Math.abs(v - row.features[i])).toBeLessThanOrEqual(1e-12 * Math.max(1.0, Math.abs(v))));
      const judged = screen.judge(row.features);
      const problems: string[] = [];
      for (const [k, v] of Object.entries(row.prediction)) if (!close(judged.prediction[k], v)) problems.push(`${k}: ${judged.prediction[k]} vs ${v}`);
      if (!close(judged.guardError, row.guard_error)) problems.push(`guard: ${judged.guardError} vs ${row.guard_error}`);
      if (!close(judged.halfWidth, row.half_width)) problems.push(`half-width: ${judged.halfWidth} vs ${row.half_width}`);
      expect(problems).toEqual([]);
    });
  }
});
