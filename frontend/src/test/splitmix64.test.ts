import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SplitMix64 } from '../engine/sampling';

// UQ-01 and UQ-02: the generator and its uniforms are the bake's, bit for bit. The digest is the one
// tests/test_uncertainty.py holds for the same 10,000 draws.
const UNIFORMS_20260926_SHA256 = '60cde9c3edb0352c693c2b976f75903c708bf4d2f0343053507d688eeff516a0';

describe('SplitMix64', () => {
  it('returns the reference vector from seed 1234567', () => {
    const rng = new SplitMix64(1234567);
    expect(Array.from({ length: 5 }, () => rng.nextInt())).toEqual([
      6457827717110365317n, 3203168211198807973n, 9817491932198370423n, 4593380528125082431n, 16408922859458223821n,
    ]);
  });

  it("draws the bake's uniforms bit for bit", () => {
    const rng = new SplitMix64(20260926);
    const draws = new Float64Array(10_000).map(() => rng.nextFloat());
    const bytes = new Uint8Array(draws.buffer); // little-endian doubles, as struct.pack('<d') on the bake's side
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(UNIFORMS_20260926_SHA256);
    expect(draws.every(u => u >= 0 && u < 1 && Number.isInteger(u * 2 ** 53))).toBe(true);
  });

  it('refuses a seed outside 64 bits', () => {
    expect(() => new SplitMix64(-1)).toThrow(RangeError);
    expect(() => new SplitMix64(1n << 64n)).toThrow(RangeError);
  });
});
