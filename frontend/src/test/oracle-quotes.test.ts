import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INTRODUCTION } from '../content/introduction';
import { COMMINUTION } from '../content/methodology/comminution';

// T-16, T-32 (review of 2026-10-02): the Introduction and the Methodology quote the Moly-Cop oracle; until 0.08.000 they
// still read "within 7%" and "within 20% of the reported 8.56 kWh/t" after the oracle had changed. The quotes are held
// here to the benchmark record. OF_DERIVED points a development run at a sandbox bake.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const bench = JSON.parse(readFileSync(join(derived, 'benchmark.json'), 'utf-8')) as {
  oracles: { molycop: { comparison: { net_specific_energy_kwh_t: { published: number; engine: number; relative_error: number } } } };
};
const net = bench.oracles.molycop.comparison.net_specific_energy_kwh_t;
const pct = Math.abs(100 * net.relative_error).toFixed(1);
const below = net.relative_error < 0 ? 'below' : 'above';

describe('the pages quote the Moly-Cop oracle as the record holds it', () => {
  it('the Introduction', () => {
    const text = INTRODUCTION.flatMap(g => g.topics).flatMap(t => t.paragraphs).map(p => p.en).join(' ');
    expect(text).toContain(`its net specific energy is ${pct}% ${below} the published one`);
    expect(text).not.toMatch(/within 7%/);
  });

  it('the Methodology grinding limit', () => {
    const text = COMMINUTION.flatMap(t => t.limits ?? []).map(l => l.en).join(' ');
    expect(text).toContain(`the engine's net specific energy, ${net.engine.toFixed(2)} kWh/t, is ${pct}% ${below} the published ${net.published.toFixed(2)}`);
    expect(text).not.toMatch(/8\.56 kWh\/t/);
  });
});
