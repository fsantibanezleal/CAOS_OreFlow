import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { readLearningRecord, readOperatingContract } from './boundaries';
import type { LearningRecord } from '../lib/artifacts.types';
import type { OperatingContract, ContractInput } from '../engine/contract';
import type { LearningRecord as GeneratedLearning } from '../generated/oreflow-learning-v1';
import type { OperatingContract as GeneratedOperating, ContractInput as GeneratedInput } from '../generated/oreflow-contract-v1';

const load = (path: string): any => JSON.parse(readFileSync(new URL(`../../../data/derived/${path}`, import.meta.url), 'utf8'));
const contract = () => load('contract/operating_contract.json');
const learning = () => load('learning.json');
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('exposes the generated types through the actual public consumers', () => {
  expectTypeOf<LearningRecord>().toEqualTypeOf<GeneratedLearning>();
  expectTypeOf<OperatingContract>().toEqualTypeOf<GeneratedOperating>();
  expectTypeOf<ContractInput>().toEqualTypeOf<GeneratedInput>();
  expectTypeOf<LearningRecord['interpolation']['models']['ridge']['recovery_pct']['rmse']>().toEqualTypeOf<number>();
});

it('accepts the real exported documents without mutation or invented defaults', () => {
  const c = contract(), l = learning();
  const before = JSON.stringify([c, l]);
  expect(readOperatingContract(c)).toBe(c);
  expect(readLearningRecord(l)).toBe(l);
  expect(JSON.stringify([c, l])).toBe(before);
});

const badContracts: Array<[string, (x: any) => void]> = [
  ['null field', x => { x.fields[0] = null; }],
  ['empty cases', x => { x.cases = {}; }],
  ['missing bilingual label', x => { delete x.inputs[0].label.es; }],
  ['zero step', x => { x.inputs[0].step = 0; }],
  ['unknown rule operator', x => { x.rules[0].relation = '>='; }],
  ['malformed bounds', x => { x.cases.copper_porphyry_soft.inputs.throughput_tph.min = null; }],
  ['missing nominal input', x => { delete x.cases.copper_porphyry_soft.nominal.throughput_tph; }],
  ['non-numeric control', x => { x.controls.uncertainty_samples.default = '128'; }],
  ['non-finite quadrature', x => { x.laguerre.nodes[0] = Infinity; }],
];
it.each(badContracts)('rejects operating consumer payload: %s', (_name, corrupt) => {
  const payload = contract(); corrupt(payload);
  expect(() => readOperatingContract(payload)).toThrow(/Invalid/);
});
const badLearning: Array<[string, (x: any) => void]> = [
  ['empty interpolation', x => { x.interpolation = {}; }],
  ['absent method', x => { delete x.interpolation.models.mlp; }],
  ['absent target', x => { delete x.interpolation.models.ridge.recovery_pct; }],
  ['null target score', x => { x.interpolation.models.ridge.recovery_pct.rmse = null; }],
  ['negative score', x => { x.interpolation.models.ridge.recovery_pct.mae = -1; }],
  ['malformed fold', x => { x.leave_one_case_out[0].models.mlp.log_upgrade = []; }],
  ['fractional rows', x => { x.design.rows = 1.5; }],
  ['rate outside unit interval', x => { x.guard.false_accept_rate = 1.01; }],
  ['empty summary', x => { x.summary.mlp.recovery_pct = {}; }],
  ['missing ONNX opset', x => { delete x.final.exports.surrogate.opset; }],
  ['malformed Cholesky metadata', x => { x.final.exports.screen.cholesky.bytes = 0; }],
  ['non-finite score', x => { x.equal_rows.ridge.recovery_pct.r2 = NaN; }],
  ['non-finite extension', x => { x.interpolation.models.ridge.recovery_pct.unit_check = { span: Infinity }; }],
];
it.each(badLearning)('rejects learning consumer payload: %s', (_name, corrupt) => {
  const payload = learning(); corrupt(payload);
  expect(() => readLearningRecord(payload)).toThrow(/Invalid/);
});

it('preserves dynamic case identifiers, negative transfer results and optional score diagnostics', () => {
  const c = contract(), l = learning();
  c.cases.future_case = structuredClone(c.cases.copper_porphyry_soft);
  l.interpolation.models.ridge.recovery_pct.unit_check = { passed: true, observed_range: [0, 100] };
  l.interpolation.models.ridge.recovery_pct.future_metric = 0.5;
  l.leave_one_case_out[0].models.mlp.recovery_pct.r2 = -100;
  expect(readOperatingContract(c).cases.future_case).toBeDefined();
  expect(readLearningRecord(l).leave_one_case_out[0].models.mlp.recovery_pct.r2).toBe(-100);
});

// Fetch through the real cache and loader, including recovery after a malformed response.
describe('production artifact loaders', () => {
  it.each([
    ['loadContract', contract, (x: any) => { x.cases = {}; }],
    ['loadLearning', learning, (x: any) => { x.interpolation = {}; }],
  ] as const)('%s refuses malformed records and retries instead of caching their failure', async (name, valid, corrupt) => {
    const payload = valid(); corrupt(payload);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(valid()), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const loaders = await import('../lib/artifacts');
    await expect(loaders[name]()).rejects.toThrow(/Invalid/);
    await expect(loaders[name]()).resolves.toHaveProperty('schema');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

it('validates optional observable diagnostics, including case and seed containers', () => {
  const payload = learning();
  const diagnostic = {
    schema: 'oreflow.observable/v1', rows: 3, observed_range: [1, 3], prediction_range: [1.1, 2.9],
    reference_range: [1, 3], allowed_range: [-1, 5], constant_baseline: false, status: 'passed',
  };
  const score = payload.interpolation.models.ridge.recovery_pct;
  score.observable = structuredClone(diagnostic);
  score.observable_by_case = { future_case: structuredClone(diagnostic) };
  payload.mlp_seeds.observable_checks = { future_split: Object.fromEntries(payload.targets.map((target: string) => [target, [structuredClone(diagnostic)]])) };
  expect(readLearningRecord(payload).interpolation.models.ridge.recovery_pct.observable?.status).toBe('passed');
  for (const summary of [score.observable, score.observable_by_case.future_case,
    payload.mlp_seeds.observable_checks.future_split.recovery_pct[0]]) {
    summary.allowed_range = [0];
    expect(() => readLearningRecord(payload)).toThrow(/Invalid/);
    summary.allowed_range = [-1, 5];
    summary.status = 'unchecked';
    expect(() => readLearningRecord(payload)).toThrow(/Invalid/);
    summary.status = 'constant-prediction';
    expect(readLearningRecord(payload)).toBe(payload);
  }
  delete payload.interpolation.models.gaussian_process.recovery_pct.coverage_95;
  expect(() => readLearningRecord(payload)).toThrow(/coverage_95/);
});
