/** Cross-field boundary checks complement JSON Schema without defining a second DTO. */
import type { FoldCounts, LearningRecord, TargetScores } from '../generated/oreflow-learning-v2';

const invalid = (path: string, reason: string): never => { throw new Error(`Invalid learning record at ${path}: ${reason}`); };
const sameIDs = (a: string[], b: string[]) => a.length === b.length && new Set(a).size === a.length && a.every(id => b.includes(id));

function checkCounts(counts: FoldCounts, scores: TargetScores[], path: string): void {
  const scored = scores.filter(score => score.status === 'scored').length;
  if (counts.attempted !== scores.length || counts.scored !== scored || counts.rejected !== scores.length - scored) {
    invalid(path, 'planned/scored/rejected counts must match every attempted fold');
  }
}

function checkScore(score: TargetScores, target: string, path: string, method?: string, fold?: string, protocol?: string): void {
  if (score.evaluation.target !== target) invalid(path, 'evaluation target does not match its score');
  if ((method !== undefined && score.evaluation.method !== method) || (fold !== undefined && score.evaluation.fold !== fold) || (protocol !== undefined && score.evaluation.protocol !== protocol)) {
    invalid(path, 'evaluation method/fold/protocol does not match its planned position');
  }
  if (score.rows !== score.observable.rows) invalid(path, 'observable rows do not match score rows');
  if (score.status === 'rejected-transfer' && score.rejection.affected_rows > score.rows) invalid(path, 'affected rows exceed evaluated rows');
  const diagnostics = [score.observable, ...Object.values(score.observable_by_case ?? {})];
  for (const diagnostic of diagnostics) {
    for (const name of ['observed_range', 'prediction_range', 'reference_range', 'allowed_range'] as const) {
      if (diagnostic[name][0] > diagnostic[name][1]) invalid(path, `${name} must be ordered`);
    }
  }
  const rejected = diagnostics.some(diagnostic => diagnostic.status === 'rejected-outside-range');
  if (rejected !== (score.status === 'rejected-transfer')) invalid(path, 'score status disagrees with its pooled/case diagnostic rejection');
}

function checkMetrics(scores: TargetScores[], mean: number | null, maximum: number | null | undefined, median: number | null, path: string): void {
  const scored = scores.filter(score => score.status === 'scored');
  const rmses = scored.map(score => score.rmse), r2s = scored.map(score => score.r2).sort((a, b) => a - b);
  const n = scored.length;
  const expectedMean = n ? rmses.reduce((sum, value) => sum + value, 0) / n : null;
  const expectedMax = n ? Math.max(...rmses) : null;
  const expectedMedian = n ? (r2s[Math.floor((n - 1) / 2)] + r2s[Math.floor(n / 2)]) / 2 : null;
  const matches = (actual: number | null, expected: number | null) => actual === null || expected === null
    ? actual === expected : Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected));
  if (!matches(mean, expectedMean) || !matches(median, expectedMedian) || (maximum !== undefined && !matches(maximum, expectedMax))) {
    invalid(path, 'conditional metrics must use exactly the admissible scored folds');
  }
}

/** Singleton ore groups reuse their one-case-out evaluation, exactly as the producer does. */
export function transferFoldEvidence(record: LearningRecord) {
  const groups = Object.values(record.transfer_groups);
  return [...record.leave_one_group_out.map(f => ({ id: f.held_out_group, models: f.models, flagRate: f.held_out_flag_rate, evaluationFold: f.held_out_group, protocol: 'transfer' })),
    ...record.leave_one_case_out.filter(f => groups.filter(group => group === record.transfer_groups[f.held_out]).length === 1)
      .map(f => ({ id: record.transfer_groups[f.held_out], models: f.models, flagRate: f.held_out_flag_rate, evaluationFold: f.held_out, protocol: 'leave_one_case_out' }))];
}

export function checkLearningEvidence(record: LearningRecord): void {
  const base = record.design?.seed, offsets = record.settings?.mlp_seed_offsets, declared = record.mlp_seeds?.seeds;
  const safeSeed = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (!safeSeed(base) || !Array.isArray(offsets) || !offsets.length || !offsets.every(safeSeed)
    || new Set(offsets).size !== offsets.length || !Array.isArray(declared) || !declared.length || !declared.every(safeSeed)) {
    invalid('mlp_seeds.seeds', 'configured seed inventory requires a nonnegative safe-integer base, unique offsets and seed IDs');
  }
  const expectedSeeds = offsets.map(offset => base + offset);
  if (!expectedSeeds.every(safeSeed) || declared.length !== expectedSeeds.length || declared.some((seed, index) => seed !== expectedSeeds[index])) {
    invalid('mlp_seeds.seeds', `configured seed inventory must equal ordered design.seed + settings.mlp_seed_offsets: ${expectedSeeds.join(', ')}`);
  }
  const protocols = [
    { id: 'leave_one_case_out' as const, prefix: 'loco' as const, folds: record.leave_one_case_out.map(f => ({ id: f.held_out, models: f.models, evaluationFold: f.held_out, protocol: 'leave_one_case_out' })) },
    { id: 'transfer' as const, prefix: 'transfer' as const, folds: transferFoldEvidence(record) },
  ];
  if (!sameIDs(record.leave_one_case_out.map(f => f.held_out), record.design.cases) || !sameIDs(Object.keys(record.transfer_groups), record.design.cases)) {
    invalid('leave_one_case_out', 'all cases in the planned design must retain a fold and transfer group');
  }
  const groups = [...new Set(Object.values(record.transfer_groups))];
  if (groups.length > 1 && !sameIDs(protocols[1].folds.map(f => f.id), groups)) invalid('transfer', 'every planned ore group must retain its transfer fold');
  for (const target of record.targets) {
    for (const model of record.models) {
      const score = record.interpolation.models[model]?.[target];
      if (!score || !record.summary[model]?.[target]) invalid(`interpolation.${model}.${target}`, 'missing declared model/target evidence');
      checkScore(score, target, `interpolation.${model}.${target}`, model, 'interpolation', 'interpolation');
    }
    const baseline = record.interpolation.case_mean_baseline[target];
    if (!baseline) invalid(`interpolation.case_mean_baseline.${target}`, 'missing declared target evidence');
    checkScore(baseline, target, `interpolation.case_mean_baseline.${target}`, 'case_mean_baseline', 'interpolation', 'interpolation');
    for (const protocol of protocols) {
      if (new Set(protocol.folds.map(f => f.id)).size !== protocol.folds.length) invalid(protocol.id, 'duplicate attempted fold identifiers');
      for (const model of record.models) {
        const scores = protocol.folds.map(f => {
          const score = f.models[model]?.[target];
          if (!score) invalid(`${protocol.id}.${f.id}.${model}.${target}`, 'missing planned score');
          checkScore(score, target, `${protocol.id}.${f.id}.${model}.${target}`, model, f.evaluationFold, f.protocol);
          return score;
        });
        checkCounts(record.summary[model][target][`${protocol.prefix}_folds`], scores, `summary.${model}.${target}.${protocol.prefix}_folds`);
        const summary = record.summary[model][target];
        checkMetrics(scores, summary[`${protocol.prefix}_rmse_mean`], summary[`${protocol.prefix}_rmse_max`], summary[`${protocol.prefix}_r2_median`], `summary.${model}.${target}.${protocol.prefix}`);
      }
      const cohort = record.common_cohorts[protocol.id][target];
      if (!cohort) invalid(`common_cohorts.${protocol.id}.${target}`, 'missing declared target evidence');
      const matched = protocol.folds.filter(f => record.models.every(model => f.models[model][target].status === 'scored')).map(f => f.id);
      const excluded = protocol.folds.filter(f => !matched.includes(f.id)).map(f => f.id);
      if (cohort.attempted !== protocol.folds.length || !sameIDs(cohort.folds, matched) || !sameIDs(cohort.excluded, excluded)) {
        invalid(`common_cohorts.${protocol.id}.${target}`, 'matched/excluded IDs must partition all planned folds and be admissible for every model');
      }
      if (!sameIDs(Object.keys(cohort.models), record.models)) invalid(`common_cohorts.${protocol.id}.${target}`, 'all models must use the same matched fold IDs');
      for (const model of record.models) {
        const metrics = cohort.models[model];
        checkMetrics(protocol.folds.filter(f => matched.includes(f.id)).map(f => f.models[model][target]), metrics.rmse_mean, undefined, metrics.r2_median, `common_cohorts.${protocol.id}.${target}.${model}`);
      }
    }
  }
  const expectedSplits = ['interpolation', ...record.leave_one_case_out.map(f => f.held_out)];
  if (!sameIDs(Object.keys(record.mlp_seeds.scores), expectedSplits)) invalid('mlp_seeds.scores', 'every planned split must retain its seed scores');
  for (const [split, targets] of Object.entries(record.mlp_seeds.scores)) {
    for (const target of record.targets) {
      const scores = targets[target];
      if (!scores || scores.length !== record.mlp_seeds.seeds.length) invalid(`mlp_seeds.scores.${split}.${target}`, 'missing planned seed score');
      scores.forEach((score, index) => {
        checkScore(score, target, `mlp_seeds.scores.${split}.${target}[${index}]`, 'mlp', split, split === 'interpolation' ? 'interpolation' : 'leave_one_case_out');
        if (score.evaluation.seed !== record.mlp_seeds.seeds[index]) invalid(`mlp_seeds.scores.${split}.${target}`, 'scores must follow declared seed order');
        if (split === 'interpolation' && score.status !== 'scored') invalid(`mlp_seeds.scores.${split}.${target}`, 'interpolation must remain scoreable');
      });
    }
  }
  for (const target of record.targets) {
    const summary = record.mlp_seeds.summary[target];
    if (!summary) invalid(`mlp_seeds.summary.${target}`, 'missing declared target evidence');
    const size = record.mlp_seeds.seeds.length;
    if ([summary.interpolation_rmse, summary.loco_rmse_mean, summary.loco_r2_median, summary.loco_folds, ...Object.values(summary.loco_rmse_by_case)].some(values => values.length !== size)) {
      invalid(`mlp_seeds.summary.${target}`, 'summary arrays must follow declared seed order');
    }
    record.mlp_seeds.seeds.forEach((_, index) => {
      const scores = record.leave_one_case_out.map(f => record.mlp_seeds.scores[f.held_out][target][index]);
      checkCounts(summary.loco_folds[index], scores, `mlp_seeds.summary.${target}.loco_folds[${index}]`);
      checkMetrics(scores, summary.loco_rmse_mean[index], undefined, summary.loco_r2_median[index], `mlp_seeds.summary.${target}[${index}]`);
      if ([summary.loco_rmse_mean[index], summary.loco_r2_median[index]].some(value => (summary.loco_folds[index].scored === 0) !== (value === null))) {
        invalid(`mlp_seeds.summary.${target}`, 'unavailable seed aggregates must be null');
      }
      record.leave_one_case_out.forEach(f => {
        const values = summary.loco_rmse_by_case[f.held_out];
        if (!values || values[index] !== record.mlp_seeds.scores[f.held_out][target][index].rmse) invalid(`mlp_seeds.summary.${target}.loco_rmse_by_case`, 'rejected seed folds must keep null metrics');
      });
    });
  }
}
