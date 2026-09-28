/**
 * One seeded generator and one Latin hypercube (port of methods/sampling.py, UQ-01 to UQ-03). SplitMix64
 * (Steele, Lea and Flood 2014) as in Vigna's reference splitmix64.c, in BigInt modulo 2^64; a uniform is the
 * top 53 bits times 2^-53, exact in IEEE doubles. The same steps in the same order as the bake, so a design
 * drawn from one seed is the same, bit for bit, in both languages.
 */

const MASK = (1n << 64n) - 1n;
const GAMMA = 0x9e3779b97f4a7c15n;
const MIX_1 = 0xbf58476d1ce4e5b9n;
const MIX_2 = 0x94d049bb133111ebn;
const UNIT = 2 ** -53;

export class SplitMix64 {
  private state: bigint;

  constructor(seed: number | bigint) {
    const s = BigInt(seed);
    if (s < 0n || s > MASK) throw new RangeError(`seed must be an unsigned 64-bit integer, got ${seed}`);
    this.state = s;
  }

  nextInt(): bigint {
    this.state = (this.state + GAMMA) & MASK;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * MIX_1) & MASK;
    z = ((z ^ (z >> 27n)) * MIX_2) & MASK;
    return z ^ (z >> 31n);
  }

  /** A uniform on [0, 1): the top 53 bits of the next integer, times 2^-53. */
  nextFloat(): number {
    return Number(this.nextInt() >> 11n) * UNIT;
  }
}

/** Fisher-Yates from the last index down, choosing j = floor(u (i + 1)) from the next uniform. */
export function permutation(rng: SplitMix64, n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng.nextFloat() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** n samples in d inputs on the unit cube, one per stratum of every input, as rows. */
export function latinHypercube(n: number, d: number, seed: number | bigint): number[][] {
  if (n < 1 || d < 1) throw new RangeError(`a design needs at least one sample and one input, got n=${n}, d=${d}`);
  const rng = new SplitMix64(seed);
  const columns: number[][] = [];
  for (let k = 0; k < d; k++) {
    const strata = permutation(rng, n);
    columns.push(strata.map(s => (s + rng.nextFloat()) / n));
  }
  return Array.from({ length: n }, (_, i) => columns.map(column => column[i]));
}
