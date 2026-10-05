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
    expect(text).toMatch(new RegExp(`and a little more metal in the other ${['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][screened.filter(r => !r.same_optimum_without_screen).length]}`));
  });

  // the gravity topic quotes the gold case's nominal recoveries and loads; until 0.09.000 no test read them
  it('separation: the gold case\'s nominal gravity recovery and gold circulating load, from its record', async () => {
    const { SEPARATION } = await import('../content/methodology/separation');
    const text = SEPARATION.flatMap(t => t.paragraphs).map(p => p.en).join(' ');
    const m = read<{ variants: Variant[] }>('cases/gold_free_milling.json').variants[0].trace.metrics;
    expect(text).toContain(`At the nominal state the gold case recovers ${m.grg_recovery_pct.toFixed(1)}% of its GRG by gravity, ${m.gravity_recovery_pct.toFixed(1)}% of all its gold`);
    expect(text).toContain(`the GRG circulates at ${Math.round(m.gold_circulating_load_pct)}% against the ore's ${Math.round(m.circulating_load_pct)}%`);
  });

  // L-01 (review of 2026-10-04): the learned lane has three protocols, and one case out is not the transfer bound
  it('learned lane: three protocols, with one ore group out as the transfer and one case out as near neighbours', () => {
    const learned = METHODS.find(t => t.id === 'learned')!;
    const text = [...learned.paragraphs, ...(learned.limits ?? [])].map(p => p.en).join(' ');
    const groups = read<{ leave_one_group_out: Array<{ cases: string[] }>; transfer_groups: Record<string, string> }>('learning.json');
    expect(groups.leave_one_group_out.map(g => g.cases.length).sort()).toEqual([2, 5]);
    expect(text).toMatch(/Three protocols score five models/);
    expect(text).toMatch(/leave one ore group out, which holds out together every plant sharing a payable and its dominant carrier mineral \(the five chalcopyrite plants, the two gold plants\)/);
    expect(text).toMatch(/one ore group out says how badly they transfer to a thirteenth on an ore none of them shares/);
    expect(text).not.toMatch(/Two protocols|leave-one-case-out says how badly/);
    const src = readFileSync(fileURLToPath(new URL('../content/methodology/methods.tsx', import.meta.url)), 'utf-8');
    expect(src).toMatch(/transfer: one ore group out/);
  });
});

// D-06, D-15, D-26 (review of 0.07.000): the figures are drawn from the equations they illustrate
describe('the Methodology figures follow their equations', () => {
  const src = (path: string) => readFileSync(fileURLToPath(new URL(`../content/methodology/${path}`, import.meta.url)), 'utf-8');

  it('the crusher classification curve is C(x) = 1 - ((K2 - x)/(K2 - K1))^2.3, steepest at K1 and level at K2', () => {
    const path = src('comminution.tsx').match(/className="dg-curve" d="M 0 80 L ([^"]+) L 300 2"/)![1];
    const points = path.split(' L ').map(s => s.split(' ').map(Number));
    for (const [x, y] of points) {
      const t = (x - 80) / 140;
      expect(y).toBeCloseTo(80 - 78 * (1 - (1 - t) ** 2.3), 1);
    }
  });

  it('the uncertainty figure marks the drawn histogram at its 5% and 95% points, with every S_T >= S_1', () => {
    const text = src('methods.tsx');
    const bars = JSON.parse(text.match(/const bars = (\[[\d, ]+\])/)![1]) as number[];
    const at = (q: number) => {
      const target = q * bars.reduce((a, b) => a + b, 0);
      let run = 0;
      for (let i = 0; i < bars.length; i += 1) {
        if (run + bars[i] >= target) return 12 * i + 10 * ((target - run) / bars[i]);
        run += bars[i];
      }
      return Number.NaN;
    };
    const marks = [...text.matchAll(/className="dg-marker" x1="([\d.]+)" y1="0"/g)].map(m => Number(m[1]));
    expect(marks[0]).toBeCloseTo(at(0.05), 0);
    expect(marks[1]).toBeCloseTo(at(0.95), 0);
    for (const m of text.matchAll(/\[(0\.\d+), (0\.\d+), '/g)) expect(Number(m[2])).toBeGreaterThanOrEqual(Number(m[1]));
  });

  it('the flotation figure draws the recleaner and both tails', () => {
    const text = src('separation.tsx');
    expect(text).toMatch(/'relimpieza' : 'recleaner'/);
    expect(text).toMatch(/'recleaner tail'/);
    expect(text).toMatch(/'cleaner tail to the rougher feed'/);
  });
});
