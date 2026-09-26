import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-web';
import { beforeAll, describe, expect, it } from 'vitest';
import type { OperatingPoint, Ore, Plant } from '../engine';
import { features, FEATURES } from '../learning/features';
import { standardize, type Scalers } from '../learning/surrogate';

// PE-39: the browser recomputes the learned lane's features exactly as the bake does, and the exported
// surrogate and guard, run by onnxruntime-web, reproduce the reference ONNX Runtime outputs the bake wrote
// at every case's nominal state. Features are float64 on both sides; the networks run in float32, so their
// outputs are compared at float32 precision.
const models = fileURLToPath(new URL('../../../models/', import.meta.url));
const cases = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
const scalers = JSON.parse(readFileSync(join(models, 'process_surrogate.json'), 'utf-8')) as Scalers;
const reference = scalers.reference ?? [];

type Artifact = { case_id: string; definition: { ore: Ore; plant: Plant }; variants: Array<{ id: string; point: OperatingPoint }> };
const nominal = (caseId: string) => {
  const artifact = JSON.parse(readFileSync(join(cases, `${caseId}.json`), 'utf-8')) as Artifact;
  const variant = artifact.variants.find(v => v.id === 'nominal');
  if (!variant) throw new Error(`${caseId} has no nominal variant`);
  return { ore: artifact.definition.ore, plant: artifact.definition.plant, point: variant.point };
};

let surrogate: ort.InferenceSession;
let guard: ort.InferenceSession;
beforeAll(async () => {
  ort.env.wasm.numThreads = 1;
  surrogate = await ort.InferenceSession.create(readFileSync(join(models, 'process_surrogate.onnx')), { executionProviders: ['wasm'] });
  guard = await ort.InferenceSession.create(readFileSync(join(models, 'process_guard.onnx')), { executionProviders: ['wasm'] });
});

describe('the browser learned lane reproduces the bake reference', () => {
  it('covers every case and declares the same feature order', () => {
    expect(reference.length).toBe(12);
    expect(scalers.features).toEqual([...FEATURES]);
  });

  for (const row of reference) {
    it(row.case_id, async () => {
      const { ore, plant, point } = nominal(row.case_id);
      const x = features(ore, plant, point);
      x.forEach((v, i) => expect(Math.abs(v - row.features[i])).toBeLessThanOrEqual(1e-12 * Math.max(1.0, Math.abs(v))));

      const input = standardize(x, scalers.feature_mean, scalers.feature_scale);
      const out = (await surrogate.run({ features: new ort.Tensor('float32', input, [1, x.length]) })).targets.data as Float32Array;
      scalers.targets.forEach((name, i) => {
        const mine = out[i] * scalers.target_scale[i] + scalers.target_mean[i];
        const theirs = row.prediction[name];
        expect(Math.abs(mine - theirs)).toBeLessThanOrEqual(1e-4 * Math.max(1.0, Math.abs(theirs)));
      });

      const guardInput = standardize(x, scalers.guard_feature_mean, scalers.guard_feature_scale);
      const rec = (await guard.run({ features: new ort.Tensor('float32', guardInput, [1, x.length]) })).reconstruction.data as Float32Array;
      let error = 0.0;
      for (let i = 0; i < x.length; i += 1) error += (rec[i] - guardInput[i]) ** 2;
      error /= x.length;
      expect(Math.abs(error - row.guard_error)).toBeLessThanOrEqual(1e-4 * Math.max(1e-3, row.guard_error));
      expect(error > scalers.guard_threshold).toBe(row.guard_flag);
    });
  }
});
