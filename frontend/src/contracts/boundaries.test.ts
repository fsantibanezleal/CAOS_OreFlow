import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import fixture from '../../../tests/contracts/fixtures/learning-v2.json';
import { readLearningRecord, readOperatingContract } from './boundaries';
import { checkLearningEvidence } from './learning-evidence';
import type { LearningRecord } from '../lib/artifacts.types';
import type { OperatingContract, ContractInput } from '../engine/contract';
import type { LearningRecord as GeneratedLearning } from '../generated/oreflow-learning-v2';
import type { OperatingContract as GeneratedOperating, ContractInput as GeneratedInput } from '../generated/oreflow-contract-v1';

const load = (path: string): any => JSON.parse(readFileSync(new URL(`../../../data/derived/${path}`, import.meta.url), 'utf8'));
const contract = () => load('contract/operating_contract.json');
const learning = (): any => structuredClone(fixture);
const shippedLearning = () => load('learning.json');
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('exposes the generated types through the actual public consumers', () => {
  expectTypeOf<LearningRecord>().toEqualTypeOf<GeneratedLearning>();
  expectTypeOf<OperatingContract>().toEqualTypeOf<GeneratedOperating>();
  expectTypeOf<ContractInput>().toEqualTypeOf<GeneratedInput>();
  expectTypeOf<LearningRecord['interpolation']['models']['ridge']['recovery_pct']['rmse']>().toEqualTypeOf<number>();
});

it('accepts the operating document and explicit v2 fixture without mutation or defaults', () => {
  const c = contract(), l = learning();
  const before = JSON.stringify([c, l]);
  expect(readOperatingContract(c)).toBe(c);
  expect(readLearningRecord(l)).toBe(l);
  expect(JSON.stringify([c, l])).toBe(before);
});

it.skipIf(shippedLearning().schema !== 'oreflow.learning/v2')('accepts the freshly baked real learning-v2 document', () => {
  const record = shippedLearning();
  expect(readLearningRecord(record)).toBe(record);
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
  ['non-finite score', x => { x.interpolation.models.ridge.recovery_pct.r2 = NaN; }],
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
  l.summary.mlp.recovery_pct.loco_r2_median = -100;
  l.common_cohorts.leave_one_case_out.recovery_pct.models.mlp.r2_median = -100;
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
  const diagnostic = structuredClone(payload.interpolation.models.ridge.recovery_pct.observable);
  const score = payload.interpolation.models.ridge.recovery_pct;
  score.observable = structuredClone(diagnostic);
  score.observable_by_case = { future_case: structuredClone(diagnostic) };
  payload.mlp_seeds.scores['case-a'].recovery_pct[0].observable = structuredClone(diagnostic);
  expect(readLearningRecord(payload).interpolation.models.ridge.recovery_pct.observable?.status).toBe('passed');
  for (const summary of [score.observable, score.observable_by_case.future_case,
    payload.mlp_seeds.scores['case-a'].recovery_pct[0].observable]) {
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

function reindexSeeds(payload: ReturnType<typeof learning>, indices: number[], seedIDs: number[]): void {
  const seeds = payload.mlp_seeds;
  seeds.seeds = [...seedIDs];
  for (const split of Object.keys(seeds.scores)) for (const target of payload.targets) {
    const previous = seeds.scores[split][target];
    seeds.scores[split][target] = indices.map((i, index) => ({ ...structuredClone(previous[i]), evaluation: { ...previous[i].evaluation, seed: seedIDs[index] } }));
  }
  for (const target of payload.targets) {
    const summary = seeds.summary[target];
    for (const field of ['interpolation_rmse', 'loco_rmse_mean', 'loco_r2_median', 'loco_folds']) summary[field] = indices.map(i => structuredClone(summary[field][i]));
    for (const id of Object.keys(summary.loco_rmse_by_case)) summary.loco_rmse_by_case[id] = indices.map(i => summary.loco_rmse_by_case[id][i]);
    if (payload.summary.mlp[target].seeds) payload.summary.mlp[target].seeds = structuredClone(summary);
  }
}
function seedInventoryFixture(): ReturnType<typeof learning> {
  const payload = learning();
  payload.settings.mlp_seed_offsets = [0, 1, 2];
  reindexSeeds(payload, [0, 1, 1], [1, 2, 3]);
  for (const target of payload.targets) payload.summary.mlp[target].seeds = structuredClone(payload.mlp_seeds.summary[target]);
  return payload;
}

it('adversarial: configured seed inventory cannot be shortened', () => {
  for (const [indices, ids] of [
    [[0, 2], [1, 3]], [[0, 1, 2], [1, 99, 3]],
    [[0, 2, 1], [1, 3, 2]], [[0, 1, 2, 2], [1, 2, 3, 4]],
  ]) {
    const payload = seedInventoryFixture();
    expect(readLearningRecord(payload)).toBe(payload);
    reindexSeeds(payload, indices, ids);
    expect(() => readLearningRecord(payload)).toThrow(/configured seed inventory/);
  }
});

it.each([[0], [0, 11], [0, 11, 22]])('accepts the complete configured seed inventory %j', (...offsets) => {
  const payload = seedInventoryFixture();
  payload.settings.mlp_seed_offsets = offsets;
  reindexSeeds(payload, offsets.map((_, i) => i), offsets.map(offset => payload.design.seed + offset));
  expect(readLearningRecord(payload)).toBe(payload);
});

it('adversarial: malformed seed declarations fail without falling back to a smaller inventory', () => {
  const mutations: Array<(payload: ReturnType<typeof learning>) => void> = [
    p => { delete p.settings; }, p => { delete p.settings.mlp_seed_offsets; }, p => { p.settings.mlp_seed_offsets = []; },
    p => { p.settings.mlp_seed_offsets = [0, true]; }, p => { p.settings.mlp_seed_offsets = [0, {}]; },
    p => { p.settings.mlp_seed_offsets = [0, 0]; }, p => { p.settings.mlp_seed_offsets = [0, Number.MAX_SAFE_INTEGER]; },
    p => { p.settings.mlp_seed_offsets = [0, 1.5]; }, p => { p.settings.mlp_seed_offsets = [0, Infinity]; },
    p => { delete p.design.seed; }, p => { p.design.seed = true; }, p => { p.design.seed = NaN; },
    p => { p.mlp_seeds.seeds = null; }, p => { p.mlp_seeds.seeds = [1, {}]; },
  ];
  for (const mutate of mutations) {
    const payload = seedInventoryFixture(); mutate(payload);
    expect(() => readLearningRecord(payload)).toThrow(/Invalid/);
    expect(() => checkLearningEvidence(payload)).toThrow(/Invalid learning record.*seed/i);
  }
});
