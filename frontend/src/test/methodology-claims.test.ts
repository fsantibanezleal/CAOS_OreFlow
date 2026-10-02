import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT_CITATIONS } from '../content/citations';
import { COMMINUTION } from '../content/methodology/comminution';
import { METHODS } from '../content/methodology/methods';

// The Methodology page states the engine's formulations and a few measured results in its prose; each is held
// here to the records, so a bake that changes one fails instead of shipping stale text (CM-08, OP-11).
// OF_DERIVED points a development run at a sandbox bake; by default the committed records are read
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const read = <T>(path: string): T => JSON.parse(readFileSync(join(derived, path), 'utf-8')) as T;
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));
const tex = (value: string | { en: string }) => (typeof value === 'string' ? value : value.en);

type Variant = { id: string; trace: { metrics: Record<string, number> } };
type Artifact = { definition: { plant: { mill: { installed_power_kw: number } } }; variants: Variant[] };

describe('the Methodology page says what the engine and the records hold', () => {
  it('comminution: both formulations of the grinding circuit, with their equations and sources (CM-08)', () => {
    const grinding = COMMINUTION.find(t => t.id === 'grinding')!;
    const text = grinding.paragraphs.map(p => p.en).join(' ');
    // the target mode: the cut found for the design load, the energy for the target P80, the power-limited fallback
    expect(text).toMatch(/the circulating load equals its design value/);
    expect(text).toMatch(/the overflow P80 equals the target/);
    expect(text).toMatch(/runs at installed power, the cut is solved again/);
    // the cut mode: the cut an input, the energy solved for the installed power, the water a fixed point on the load
    expect(text).toMatch(/the host's corrected cut is an input/);
    expect(text).toMatch(/so that the mill draws its installed power/);
    expect(text).toMatch(/a fixed point at every energy/);
    const equations = (grinding.equations ?? []).map(e => tex(e.tex)).join(' ');
    for (const symbol of ['P_{inst}', 'd_{50c}', 'R_f', 'S_i^E']) expect(equations).toContain(symbol);
    for (const ref of ['herbst1980', 'molycop', 'plitt1976', 'irannajad2006']) {
      expect(grinding.refs).toContain(ref);
      expect(CONTENT_CITATIONS.some(c => c.id === ref), ref).toBe(true);
    }
    // "at installed power the same cut grinds finer, because no nominal state draws all of its power"
    expect(text).toMatch(/at installed power the same cut grinds finer, because no nominal state draws all of its power/);
    const index = read<{ cases: Array<{ case_id: string }> }>('manifests/index.json');
    for (const c of index.cases) {
      const a = read<Artifact>(`cases/${c.case_id}.json`);
      const nominal = a.variants.find(v => v.id === 'nominal')!.trace.metrics, cut = a.variants.find(v => v.id === 'cut_nominal')!.trace.metrics;
      expect(nominal.mill_power_kw, c.case_id).toBeLessThan(a.definition.plant.mill.installed_power_kw);
      expect([nominal.cut_mode, cut.cut_mode], c.case_id).toEqual([0, 1]);
      expect(cut.p80_um, c.case_id).toBeLessThan(nominal.p80_um);
    }
    // the modes' agreement at the same state is tests/test_grinding.py::test_modes_agree_at_the_same_state (CM-04,
    // 1e-9 asserted, about 1e-13 measured); the page quotes the order of the measurement
    expect(text).toMatch(/to about 1e-13/);
  });

  it('optimizer: what the screen costs and how far the surrogate is from the engine, from the benchmark (OP-11)', () => {
    type Row = { screened: boolean; evaluations: number; evaluations_without_screen?: number; surrogate_abs_error_pp?: number | null; same_optimum_without_screen?: boolean };
    const bench = read<{ optimization: Record<string, Record<string, Row>> }>('benchmark.json');
    const screened = Object.values(bench.optimization).flatMap(v => Object.values(v)).filter(r => r.screened);
    const withScreen = screened.reduce((a, r) => a + r.evaluations, 0), without = screened.reduce((a, r) => a + r.evaluations_without_screen!, 0);
    const errors = screened.map(r => r.surrogate_abs_error_pp).filter((e): e is number => typeof e === 'number');
    const optimizer = METHODS.find(t => t.id === 'optimization')!;
    const text = optimizer.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(new RegExp(`Over the precompute's ${screened.length} screened variants it cost ${round(100 * (withScreen / without - 1), 1)}% more engine evaluations`));
    expect(text).toMatch(new RegExp(`the surrogate's recovery was ${round(errors.reduce((a, e) => a + e, 0) / errors.length, 2)} points from the engine's on average`));
    expect(text).toMatch(new RegExp(`the same optima in ${screened.filter(r => r.same_optimum_without_screen).length} of the ${screened.length} variants`));
  });
});
