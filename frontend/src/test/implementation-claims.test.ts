import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IMPLEMENTATION } from '../content/implementation';
import { DEPLOY, GPU, MODELS } from '../content/implementation-models';

// PG-03: the numbers the Implementation page's registry, GPU and deployment tabs write in their prose are held
// to the records, the settings and the environments they describe. The tables themselves read the records.
const read = <T,>(path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf-8')) as T;
const learning = read<{ features: string[]; design: { rows: number }; settings: Record<string, unknown>; leave_one_case_out: unknown[]; final: { exports: Record<string, { max_abs_difference: number }> } }>('data/derived/learning.json');
const text = (topic: { paragraphs: Array<{ en: string }> }) => topic.paragraphs.map(p => p.en).join(' ');
// the bake's own records: OF_DERIVED points a development run at a sandbox bake
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const readDerived = <T,>(path: string) => JSON.parse(readFileSync(`${derived}/${path}`, 'utf-8')) as T;

describe('the Implementation page says what the records and environments hold', () => {
  it('model registry: four models, 22 features, the export tolerance', () => {
    const t = text(MODELS);
    expect(t).toMatch(/Four trained models/);
    expect(t).toMatch(new RegExp(`the ${learning.features.length} standardized physical features`));
    expect(learning.settings.onnx_tolerance).toBe(1e-5);
    expect(t).toMatch(/declared tolerance of 1e-5/);
    for (const e of Object.values(learning.final.exports)) expect(e.max_abs_difference).toBeLessThanOrEqual(1e-5);
  });

  it('GPU lane: the design size, the thirteen fits, CUDA 12.6', () => {
    const t = text(GPU);
    expect(t).toMatch(new RegExp(`at most ${learning.design.rows} rows`));
    expect(learning.leave_one_case_out).toHaveLength(12);
    expect(t).toMatch(/fitted 13 times, on the interpolation split and on each of the twelve held-out cases/);
    const gpu = readFileSync(fileURLToPath(new URL('../../../requirements-gpu.txt', import.meta.url)), 'utf-8');
    expect(gpu).toMatch(/torch==[\d.]+\+cu126/);
    expect(t).toMatch(/pins the CUDA build of PyTorch/);
  });

  it('the bake: the optimizer run twice, and what the screen cost in this bake (OP-11)', () => {
    type Row = { screened: boolean; evaluations: number; evaluations_without_screen?: number; surrogate_abs_error_pp?: number | null };
    const bench = readDerived<{ optimization: Record<string, Record<string, Row>> }>('benchmark.json');
    const screened = Object.values(bench.optimization).flatMap(v => Object.values(v)).filter(r => r.screened);
    const withScreen = screened.reduce((a, r) => a + r.evaluations, 0), without = screened.reduce((a, r) => a + r.evaluations_without_screen!, 0);
    const errors = screened.map(r => r.surrogate_abs_error_pp).filter((e): e is number => typeof e === 'number');
    const bake = IMPLEMENTATION.find(g => g.id === 'bake')!.topics[0];
    const t = text(bake);
    const n = (v: number) => v.toLocaleString('en-US');
    expect(t).toMatch(new RegExp(`the screened searches spent ${n(withScreen)} engine evaluations against ${n(without)} without the screen, ${Number((100 * (withScreen / without - 1)).toFixed(1))}% more`));
    expect(t).toMatch(new RegExp(`the surrogate's recovery was ${Number((errors.reduce((a, e) => a + e, 0) / errors.length).toFixed(2))} points from the engine's on average`));
  });

  it('deployment: the routes the service answers', () => {
    const rows = (DEPLOY.table?.rows ?? []).map(r => r.map(c => (typeof c === 'string' ? c : c.en)).join(' ')).join(' ');
    const routes = readFileSync(fileURLToPath(new URL('../../../app/routers/content.py', import.meta.url)), 'utf-8');
    for (const route of ['/healthz', '/api/cases', '/api/benchmark', '/api/simulate']) {
      expect(rows).toContain(route);
      const tail = route.split('/').at(-1)!;
      expect(routes + readFileSync(fileURLToPath(new URL('../../../app/main.py', import.meta.url)), 'utf-8')).toContain(tail);
    }
  });
});
