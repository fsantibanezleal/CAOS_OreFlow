import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import fixture from '../../../../tests/contracts/fixtures/learning-v2.json';
import { readLearningRecord, readOperatingContract } from '../../contracts/boundaries';
import type { LearningRecord, RejectedScore, ScoredScore, TargetScores } from '../../generated/oreflow-learning-v2';
import type { CaseArtifact } from '../../lib/artifacts.types';
import type { SurrogateAnswer } from '../../learning/surrogate';
import { loadIndex, loadLearning } from '../../lib/artifacts';
import { askSurrogate } from '../../learning/surrogate';
import { LearningView } from './LearningView';

// SSR does not run effects. Supply the selected quantity and completed inference
// at the React state boundary while rendering the actual wrapper and instrument.
const setup = vi.hoisted(() => ({
  record: null as LearningRecord | null,
  target: 'recovery_pct',
  current: null as SurrogateAnswer | null,
  nullStates: 0,
  effects: [] as EffectCallback[],
  artifactHook: vi.fn(),
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual,
    useState: (initial?: unknown) => {
      const result = actual.useState(initial);
      if (initial === 'recovery_pct') return [setup.target, result[1]];
      if (initial === null && setup.nullStates++ === 0) return [setup.current, result[1]];
      if (initial === 'loading' && setup.current) return ['ready', result[1]];
      return result;
    },
    useEffect: (effect: EffectCallback, dependencies?: ReadonlyArray<unknown>) => {
      setup.effects.push(effect); actual.useEffect(effect, dependencies);
    },
  };
});
vi.mock('../../content/data', async importOriginal => {
  const actual = await importOriginal<typeof import('../../content/data')>();
  return { ...actual, useArtifact: (loader: unknown) => {
    setup.artifactHook(loader);
    return { value: loader === loadIndex ? read('manifests/index.json') : setup.record, error: null };
  } };
});
vi.mock('../../lib/artifacts', () => ({
  loadLearning: vi.fn(async () => setup.record),
  loadIndex: vi.fn(async () => read('manifests/index.json')),
}));
vi.mock('../../learning/surrogate', () => ({ askSurrogate: vi.fn(async () => [setup.current]) }));

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(`../../../../data/derived/${path}`, import.meta.url), 'utf8'));
const contract = readOperatingContract(read('contract/operating_contract.json'));
const artifact = read('cases/copper_porphyry_soft.json') as CaseArtifact;
const props = { contract, artifact, point: artifact.nominal, trace: artifact.variants[0].trace, onCursor: vi.fn() };
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");

function rejected(score: TargetScores): RejectedScore {
  return { ...score, status: 'rejected-transfer', valid_for_scoring: false, rmse: null, mae: null, r2: null,
    r2_within_case: null, coverage_95: null,
    observable: { ...score.observable, status: 'rejected-outside-range', prediction_range: [-30, -20] },
    rejection: { code: 'observable-range', reason: 'authored range-rejection fixture', affected_rows: score.rows } };
}
function scored(score: TargetScores): ScoredScore {
  const { rejection: _rejection, ...rest } = score;
  return { ...rest, status: 'scored', valid_for_scoring: true, rmse: 2, mae: 1, r2: 0.25, coverage_95: 0.9,
    observable: { ...score.observable, status: 'passed', prediction_range: [1.1, 2.9] } };
}
function metrics(scores: TargetScores[]) {
  const accepted = scores.filter(score => score.status === 'scored');
  const r2s = accepted.map(score => score.r2).sort((a, b) => a - b);
  return { counts: { attempted: scores.length, scored: accepted.length, rejected: scores.length - accepted.length },
    rmse: accepted.length ? accepted.reduce((sum, score) => sum + score.rmse, 0) / accepted.length : null,
    max: accepted.length ? Math.max(...accepted.map(score => score.rmse)) : null,
    r2: r2s.length ? (r2s[Math.floor((r2s.length - 1) / 2)] + r2s[Math.floor(r2s.length / 2)]) / 2 : null };
}
function evidence(allRejected = false): LearningRecord {
  const record = structuredClone(readLearningRecord(fixture));
  // Different active targets deliberately have different admissible denominators.
  for (const [i, fold] of record.leave_one_case_out.entries()) for (const target of record.targets) for (const model of record.models) {
    const fail = allRejected || model === 'mlp' && (target === 'log_upgrade' || target === 'recovery_pct' && i === 1);
    fold.models[model][target] = fail ? rejected(fold.models[model][target]) : scored(fold.models[model][target]);
  }
  record.transfer_groups = { 'case-a': 'group-a', 'case-b': 'group-b' };
  for (const target of record.targets) {
    for (const model of record.models) {
      const result = metrics(record.leave_one_case_out.map(fold => fold.models[model][target]));
      Object.assign(record.summary[model][target], { loco_folds: result.counts, loco_rmse_mean: result.rmse, loco_rmse_max: result.max, loco_r2_median: result.r2,
        transfer_folds: { ...result.counts }, transfer_rmse_mean: result.rmse, transfer_rmse_max: result.max, transfer_r2_median: result.r2 });
    }
    const common = record.common_cohorts.leave_one_case_out[target];
    common.folds = record.leave_one_case_out.filter(fold => record.models.every(model => fold.models[model][target].status === 'scored')).map(fold => fold.held_out);
    common.excluded = record.design.cases.filter(id => !common.folds.includes(id));
    for (const model of record.models) {
      const result = metrics(record.leave_one_case_out.filter(fold => common.folds.includes(fold.held_out)).map(fold => fold.models[model][target]));
      common.models[model] = { rmse_mean: result.rmse, r2_median: result.r2 };
    }
    record.common_cohorts.transfer[target] = { ...structuredClone(common), folds: common.folds.map(id => record.transfer_groups[id]), excluded: common.excluded.map(id => record.transfer_groups[id]) };
    for (const fold of record.leave_one_case_out) {
      record.mlp_seeds.scores[fold.held_out][target] = record.mlp_seeds.seeds.map(seed => ({ ...structuredClone(fold.models.mlp[target]), evaluation: { ...fold.models.mlp[target].evaluation, seed } }));
      record.mlp_seeds.summary[target].loco_rmse_by_case[fold.held_out] = record.mlp_seeds.scores[fold.held_out][target].map(score => score.rmse);
    }
    const seedSummary = record.mlp_seeds.summary[target];
    const results = record.mlp_seeds.seeds.map((_, i) => metrics(record.design.cases.map(id => record.mlp_seeds.scores[id][target][i])));
    seedSummary.loco_folds = results.map(result => result.counts);
    seedSummary.loco_rmse_mean = results.map(result => result.rmse);
    seedSummary.loco_r2_median = results.map(result => result.r2);
  }
  return readLearningRecord(record);
}

function divRange(html: string, className: string): [number, number] {
  const tags = [...html.matchAll(/<div\b[^>]*>|<\/div>/g)];
  const start = tags.findIndex(match => match[0].match(/class="([^"]+)"/)?.[1].split(' ').includes(className));
  expect(start, `missing ${className}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (const tag of tags.slice(start)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (!depth) return [tags[start].index!, tag.index! + tag[0].length];
  }
  throw new Error(`unclosed ${className}`);
}
function render(lang: 'en' | 'es'): string {
  setup.nullStates = 0; setup.effects = [];
  return renderToStaticMarkup(<LearningView {...props} lang={lang} />);
}
function activeFacts(html: string): string {
  const found = html.match(/<dl[^>]*aria-label="[^"]+"[^>]*>([\s\S]*?)<\/dl>/)?.[1];
  expect(found, 'active-target protocol facts').toBeDefined();
  return found!;
}

beforeEach(() => {
  vi.clearAllMocks(); setup.record = evidence(); setup.target = 'recovery_pct'; setup.current = null;
});

describe.each(['en', 'es'] as const)('LO-008/009 live instrument in %s', lang => {
  it('adversarial: threshold decisions cannot prove support or accuracy', async () => {
    for (const flagged of [false, true]) {
      const { describeGuard, GUARD_LABELS } = await import('../../learning/guard-description');
      const message = describeGuard(flagged, lang);
      expect(message).toMatch(lang === 'en' ? /reconstruction error.*threshold/i : /error de reconstrucción.*umbral/i);
      expect(message).toContain(lang === 'en' ? 'false alarms and missed shifts' : 'falsas alarmas y cambios no detectados');
      expect(message).toContain(lang === 'en' ? 'does not establish training support or predictive accuracy' : 'no demuestra pertenencia al dominio de entrenamiento ni precisión predictiva');
      expect(message).toContain(flagged ? lang === 'en' ? 'exceeds' : 'supera' : lang === 'en' ? 'at or below' : 'en el umbral o por debajo');
      expect(message).not.toMatch(/lies inside|lies outside|is extrapolating|está dentro del diseño|está fuera del diseño|sustituto extrapola/);
      expect(GUARD_LABELS.alert[lang]).toMatch(lang === 'en' ? /reconstruction threshold exceeded/ : /umbral de reconstrucción superado/);
      expect(GUARD_LABELS.alert[lang]).not.toMatch(/outside|fuera|training design|diseño de entrenamiento/);
      setup.current = { prediction: { recovery_pct: 10, log_upgrade: 0, specific_energy_total_kwh_t: 4 }, guardError: flagged ? 2 : 0.5, guardThreshold: 1, outside: flagged };
      expect(text(render(lang))).toContain(message);
    }
  });

  it.each([
    ['recovery_pct', '1 evaluated', '2 planned / 1 scored / 1 rejected', '2 previstas / 1 evaluadas / 1 rechazadas'],
    ['concentrate_grade', 'all rejected', '2 planned / 0 scored / 2 rejected', '2 previstas / 0 evaluadas / 2 rechazadas'],
    ['specific_energy_total_kwh_t', 'all scored', '2 planned / 2 scored / 0 rejected', '2 previstas / 2 evaluadas / 0 rechazadas'],
  ])('keeps %s active-target counts beside conditional metrics (%s)', (target, _kind, en, es) => {
    setup.target = target;
    const html = render(lang), facts = activeFacts(html);
    const rows = [...facts.matchAll(/<div>([\s\S]*?)<\/div>/g)].map(match => match[1]);
    const conditional = rows.filter(row => text(row).includes(lang === 'en' ? 'conditional' : 'condicional'));
    expect(conditional).toHaveLength(3); // group R², case R², case RMSE
    for (const row of conditional) expect(text(row)).toContain(lang === 'en' ? en : es);
    if (target === 'concentrate_grade') for (const row of conditional) expect(text(row)).toContain(lang === 'en' ? 'Unavailable' : 'No disponible');
    expect(text(html)).toContain(lang === 'en' ? 'MLP models fitted separately for each fold' : 'modelos MLP ajustados por separado para cada partición');
    expect(text(html)).toContain(lang === 'en' ? 'final frozen MLP fitted on the complete learning design' : 'MLP final congelado, ajustado con el diseño completo de aprendizaje');
    expect(text(html)).not.toMatch(/precompute protocols, exported MLP|protocolos del precálculo, MLP exportado/);
  });

  it('adversarial: complete evidence stays inside the existing aside', () => {
    const html = render(lang), root = divRange(html, 'of-split'), aside = divRange(html, 'of-aside');
    expect(root).toEqual([0, html.length]);
    expect(aside[0]).toBeGreaterThan(root[0]); expect(aside[1]).toBeLessThan(root[1]);
    const inside = html.slice(...aside), outside = html.slice(0, aside[0]) + html.slice(aside[1]);
    const definition = lang === 'en' ? 'Conditional metrics use admissible scored folds only.' : 'Las métricas condicionales usan solo particiones admisibles evaluadas.';
    expect(text(inside)).toContain(definition); expect(text(outside)).not.toContain(definition);
    expect(outside).not.toMatch(/<dl|<details|<table/);
    const disclosure = inside.match(/<details\b[^>]*>([\s\S]*)<\/details>/)?.[1];
    expect(disclosure).toBeDefined();
    for (const label of lang === 'en' ? ['Recovery (percentage points)', 'Log upgrade ratio', 'Specific energy (kWh/t)'] : ['Recuperación (puntos porcentuales)', 'Log de la razón de enriquecimiento', 'Energía específica (kWh/t)']) expect(text(disclosure!)).toContain(label);
    expect(text(disclosure!)).toContain(lang === 'en' ? 'Rejected: prediction range' : 'Rechazado: rango de predicción');
    expect(text(disclosure!)).toContain('[-30; -20]');
    expect(text(disclosure!)).toContain(lang === 'en' ? 'Matched common folds' : 'Particiones comunes entre modelos');
    expect(text(disclosure!)).toContain(lang === 'en' ? 'Excluded folds' : 'Particiones excluidas');
    if (lang === 'es') expect(text(inside)).not.toMatch(/Unavailable|Rejected|planned|scored|The guard|Guard: outside/);
  });

  it('adversarial: all-null conditional results retain planned attempts', () => {
    setup.record = evidence(true);
    const html = render(lang), facts = activeFacts(html), contents = text(facts);
    expect(contents).toContain(lang === 'en' ? '2 planned / 0 scored / 2 rejected' : '2 previstas / 0 evaluadas / 2 rechazadas');
    expect(contents.match(new RegExp(lang === 'en' ? 'Unavailable' : 'No disponible', 'g'))).toHaveLength(3);
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(contents).not.toMatch(/>0<|0 pts|0 pp|0 kWh/);
    expect(text(html)).toContain(lang === 'en' ? 'No common admissible folds.' : 'No hay particiones admisibles comunes.');
  });

  it('retains cut-mode abstention without converting it to a detector verdict or a NaN display', () => {
    setup.current = { prediction: {}, guardError: Number.NaN, guardThreshold: 1, outside: true, notApplicable: 'cut_mode' };
    const html = render(lang), message = text(html);
    expect(message).toContain(lang === 'en' ? 'so it does not answer here' : 'así que aquí no responde');
    expect(message).not.toMatch(/Detector alert: reconstruction error|Alerta del detector: el error de reconstrucción|NaN|Infinity/);
  });

  it('uses one learning loader owner while retaining the live inference effect', async () => {
    render(lang);
    expect(setup.artifactHook).toHaveBeenCalledTimes(2);
    expect(setup.artifactHook).toHaveBeenCalledWith(loadLearning);
    expect(setup.artifactHook).toHaveBeenCalledWith(loadIndex);
    for (const effect of setup.effects) effect();
    await Promise.resolve();
    expect(loadLearning).not.toHaveBeenCalled(); // records are supplied at the artifact-hook boundary
    expect(loadIndex).not.toHaveBeenCalled();
    expect(askSurrogate).toHaveBeenCalledExactlyOnceWith(artifact.definition.ore, artifact.definition.plant, [artifact.nominal]);
  });
});
