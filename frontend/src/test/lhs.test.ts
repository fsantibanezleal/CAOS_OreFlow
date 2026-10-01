import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { latinHypercube } from '../engine/sampling';

// UQ-03: one sample in every stratum of every input, and the bake's default design bit for bit (the digest
// tests/test_uncertainty.py holds).
const LHS_128_4_20260926_SHA256 = 'fc43b40e144ebde250e1be65b12888654983d177955802b8231ae631a88a39d5';

describe('Latin hypercube', () => {
  it('puts one sample in every stratum of every input', () => {
    for (const [n, d, seed] of [[1, 1, 0], [7, 3, 1], [128, 4, 20260926], [512, 4, 2 ** 53 - 1]]) {
      const design = latinHypercube(n, d, seed);
      expect(design).toHaveLength(n);
      for (let k = 0; k < d; k++) {
        const strata = design.map(row => Math.floor(row[k] * n)).sort((a, b) => a - b);
        expect(strata).toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it("is the bake's design, bit for bit", () => {
    const flat = new Float64Array(latinHypercube(128, 4, 20260926).flat());
    expect(createHash('sha256').update(new Uint8Array(flat.buffer)).digest('hex')).toBe(LHS_128_4_20260926_SHA256);
    expect(latinHypercube(3, 2, 7)).toEqual([[0.9669202268689611, 0.44269224638416765], [0.19431009767602603, 0.7114194329361495], [0.48414729833715614, 0.13771379913925977]]);
  });
});
