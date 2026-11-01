import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fixture from '../../../tests/contracts/fixtures/learning-v2.json';
import { readLearningRecord } from './boundaries';
import { formatLearningMetric, formatScore, learningSeries } from '../learning/evidence';
import { LearningEvidence } from '../content/implementation/learned';
import { LearningComparison } from '../learning/comparison';

const plot = vi.hoisted(() => ({ data: [] as Array<Array<number | null>>, summary: '' }));
vi.mock('../components/charts/Chart', () => ({ Chart: (props: { data: Array<Array<number | null>>; summary: string }) => {
  plot.data = props.data; plot.summary = props.summary;
  return <p>{props.summary}</p>;
} }));

const fresh = () => JSON.parse(JSON.stringify(fixture));

function allRejected() {
  const payload = fresh();
  for (const fold of payload.leave_one_case_out) for (const model of payload.models) for (const target of payload.targets) {
    const score = fold.models[model][target];
    score.status = 'rejected-transfer'; score.valid_for_scoring = false;
    score.rmse = score.mae = score.r2 = null;
    if (model === 'gaussian_process') score.coverage_95 = null;
    score.observable.status = 'rejected-outside-range'; score.observable.prediction_range = [-30, -20];
    score.rejection = { code: 'observable-range', reason: 'outside forecast envelope', affected_rows: 2 };
  }
  for (const model of payload.models) for (const target of payload.targets) {
    const summary = payload.summary[model][target];
    summary.loco_rmse_mean = summary.loco_rmse_max = summary.loco_r2_median = null;
    summary.loco_folds = { attempted: 2, scored: 0, rejected: 2 };
  }
  for (const target of payload.targets) {
    const cohort = payload.common_cohorts.leave_one_case_out[target];
    cohort.folds = []; cohort.excluded = ['case-a', 'case-b'];
    for (const model of payload.models) cohort.models[model] = { rmse_mean: null, r2_median: null };
    const summary = payload.mlp_seeds.summary[target];
    summary.loco_rmse_mean = summary.loco_r2_median = [null, null];
    summary.loco_folds = payload.mlp_seeds.seeds.map(() => ({ attempted: 2, scored: 0, rejected: 2 }));
    for (const fold of payload.leave_one_case_out) {
      summary.loco_rmse_by_case[fold.held_out] = [null, null];
      payload.mlp_seeds.scores[fold.held_out][target] = payload.mlp_seeds.seeds.map((seed: number) => {
        const score = structuredClone(fold.models.mlp[target]); score.evaluation.seed = seed; return score;
      });
    }
  }
  return payload;
}

it('reads v2 scored and rejected branches without mutation', () => {
  const payload = fresh();
  const before = JSON.stringify(payload);
  expect(readLearningRecord(payload)).toBe(payload);
  expect(JSON.stringify(payload)).toBe(before);
});

it.each([
  ['scored null', (p: any) => { p.interpolation.models.ridge.recovery_pct.rmse = null; }],
  ['rejected zero', (p: any) => { p.leave_one_case_out[1].models.mlp.recovery_pct.rmse = 0; }],
  ['missing reason', (p: any) => { delete p.leave_one_case_out[1].models.mlp.recovery_pct.rejection.reason; }],
  ['missing evaluation', (p: any) => { delete p.leave_one_case_out[1].models.mlp.recovery_pct.evaluation; }],
  ['wrong denominator', (p: any) => { p.summary.mlp.recovery_pct.loco_folds.attempted = 1; }],
  ['dropped rejected fold', (p: any) => { p.summary.mlp.recovery_pct.loco_folds = { attempted: 1, scored: 1, rejected: 0 }; }],
  ['wrong matched fold IDs', (p: any) => { p.common_cohorts.leave_one_case_out.recovery_pct.folds = ['case-b']; p.common_cohorts.leave_one_case_out.recovery_pct.excluded = ['case-a']; }],
  ['nonfinite extension', (p: any) => { p.interpolation.models.mlp.recovery_pct.future_metric = Infinity; }],
  ['v1 tag', (p: any) => { p.schema = 'oreflow.learning/v1'; }],
  ['missing common cohort', (p: any) => { delete p.common_cohorts; }],
  ['seed order', (p: any) => { p.mlp_seeds.scores['case-a'].recovery_pct.reverse(); }],
  ['seed partial null', (p: any) => { p.mlp_seeds.summary.recovery_pct.loco_rmse_mean[0] = null; }],
  ['negative attempted count', (p: any) => { p.summary.mlp.recovery_pct.loco_folds.attempted = -1; }],
  ['rejected fold averaged as zero', (p: any) => { p.summary.mlp.recovery_pct.loco_rmse_mean = 0.5; }],
  ['common metrics from different folds', (p: any) => { p.common_cohorts.leave_one_case_out.recovery_pct.models.mlp.r2_median = 0.9; }],
  ['entire planned fold removed', (p: any) => { p.leave_one_case_out.pop(); }],
  ['different evaluation fold', (p: any) => { p.leave_one_case_out[0].models.mlp.recovery_pct.evaluation.fold = 'case-b'; }],
])('rejects %s at the actual reader', (_name, corrupt) => {
  const payload = fresh(); corrupt(payload);
  expect(() => readLearningRecord(payload)).toThrow(/Invalid/);
});

describe.each(['en', 'es'] as const)('consumer evidence in %s', lang => {
  it('shows rejection and forecast envelope, keeping null gaps in actual plot data', () => {
    const record = readLearningRecord(fresh());
    const rejected = record.leave_one_case_out[1].models.mlp.recovery_pct;
    const text = formatScore(rejected, 'rmse', lang);
    expect(text).toContain(lang === 'en' ? 'Rejected' : 'Rechazado');
    expect(text).toContain(lang === 'en' ? 'prediction' : 'predicción');
    expect(text).toContain('-30');
    expect(text).not.toContain('NaN');
    expect(learningSeries(record, 'recovery_pct', 'transfer', 'common')).toEqual([null, null, null, null, null]);
    expect(formatLearningMetric(null, lang)).toBe(lang === 'en' ? 'Unavailable' : 'No disponible');
  });
  it('renders conditional counts and matched cohort without unqualified ranking', () => {
    const html = renderToStaticMarkup(<LearningEvidence record={readLearningRecord(fresh())} lang={lang} target="recovery_pct" />);
    for (const label of (lang === 'en' ? ['conditional', 'planned', 'scored', 'rejected', 'matched', 'excluded'] : ['condicional', 'previstas', 'evaluadas', 'rechazadas', 'comunes', 'excluidas'])) expect(html.toLowerCase()).toContain(label);
    expect(html).toContain('case-b');
    expect(html).not.toMatch(/NaN|Infinity|best|wins/);
    if (lang === 'es') expect(html).not.toMatch(/Unavailable|Rejected|planned|scored|prediction range/);
  });
  it('renders all-rejected evidence as unavailable and preserves null plot inputs', () => {
    const record = readLearningRecord(allRejected());
    const html = renderToStaticMarkup(<LearningEvidence record={record} target="recovery_pct" lang={lang} />);
    expect(html).toContain(lang === 'en' ? '2 planned / 0 scored / 2 rejected' : '2 previstas / 0 evaluadas / 2 rechazadas');
    expect(html).toContain(lang === 'en' ? 'No common admissible folds' : 'No hay particiones admisibles comunes');
    expect(learningSeries(record, 'recovery_pct', 'leave_one_case_out', 'conditional')).toEqual([null, null, null, null, null]);
    renderToStaticMarkup(<LearningComparison record={record} lang={lang} />);
    expect(plot.data[2]).toEqual([null, null, null, null, null]);
    expect(plot.data[1]).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(plot.summary).toContain(lang === 'en' ? 'gaps' : 'huecos');
  });
});

it('retains a pooled-pass/per-case-rejected diagnostic without masking its reason', () => {
  const payload = fresh();
  const score = payload.leave_one_case_out[1].models.mlp.recovery_pct;
  score.observable_by_case = { 'case-b': structuredClone(score.observable) };
  score.observable = structuredClone(payload.interpolation.models.mlp.recovery_pct.observable);
  expect(readLearningRecord(payload).leave_one_case_out[1].models.mlp.recovery_pct.status).toBe('rejected-transfer');
  expect(formatScore(score, 'rmse', 'es')).toContain('[-30; -20]');
});

it('uses exactly the producer singleton-group folds in transfer cohorts', () => {
  const payload = fresh();
  payload.transfer_groups = { 'case-a': 'group-a', 'case-b': 'group-b' };
  for (const target of payload.targets) {
    const cohort = payload.common_cohorts.transfer[target];
    cohort.attempted = 2; cohort.folds = ['group-a']; cohort.excluded = ['group-b'];
    for (const model of payload.models) {
      const summary = payload.summary[model][target];
      summary.transfer_folds = structuredClone(summary.loco_folds);
      summary.transfer_rmse_mean = summary.loco_rmse_mean;
      summary.transfer_rmse_max = summary.loco_rmse_max;
      summary.transfer_r2_median = summary.loco_r2_median;
      cohort.models[model] = { rmse_mean: 1, r2_median: 0.5 };
    }
  }
  expect(readLearningRecord(payload)).toBe(payload);
  payload.common_cohorts.transfer.recovery_pct.folds = ['case-a'];
  expect(() => readLearningRecord(payload)).toThrow(/matched\/excluded IDs/);
});
