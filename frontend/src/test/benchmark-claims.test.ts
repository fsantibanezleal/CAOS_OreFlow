import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readLearningRecord } from '../contracts/boundaries';
import type { LearningRecord, TargetScores } from '../generated/oreflow-learning-v2';
import { transferFoldEvidence } from '../contracts/learning-evidence';
import { LearningEvidence } from '../content/implementation/learned';
import { LearningComparison } from '../learning/comparison';
import * as ChartModule from '../components/charts/Chart';
import { formatFixed, formatFraction, formatSignificant, type Lang } from '../lib/format';
import { learningSeries, LEARNING_MODELS } from '../learning/evidence';
import authoredLearningFixture from '../../../tests/contracts/fixtures/learning-v2.json';
import { ENGINE_BENCHMARK } from '../content/benchmark';

// The Benchmark page states the published-example checks, the method records' findings, the learned
// lane's scores and the measured lanes' results in its prose; every number and direction it states is
// held here to the committed records, so a bake that changes one fails instead of shipping stale text.
// OF_DERIVED points a development run at a sandbox bake; by default the committed records are read
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const read = <T>(path: string): T => JSON.parse(readFileSync(join(derived, path), 'utf-8')) as T;
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

type Opt = {
  status: string; base_feasible: boolean; gain_pct: number | null; active: string[]; evaluations: number; screened: boolean;
  evaluations_without_screen?: number; screened_candidates?: number; proposed?: number; improved?: number;
  surrogate_abs_error_pp?: number | null; same_optimum_without_screen?: boolean;
  path: Array<{ weight: number; status: string; recovered_tph: number; energy_kwh_t: number | null }>;
};
type OptimizationRecord = {
  decisions: string[]; bounds: Record<string, [number, number]>;
  optimum: { decisions: Record<string, number>; recovered_tph: number; values: Record<string, number> } | null;
  without_screen?: { decisions: Record<string, number> | null; recovered_tph: number | null };
};
const benchmark = read<{
  oracles: {
    molycop: {
      inputs: Record<'p80_um' | 'circulating_load', { published: number; engine: number; relative_error: number }>;
      comparison: Record<'net_specific_energy_kwh_t' | 'gross_specific_energy_kwh_t' | 'cut_um' | 'water_bypass', { published: number; engine: number; relative_error: number }> & { overflow_passing_max_abs_difference_pct: number };
      tolerance: { net_specific_energy_kwh_t: number };
      sizing: { examples: Record<string, { published: { cyclones: number; pressure_kpa: number }; sized_for_published_cut: { cyclones: number; pressure_kpa: number }; calibration: { cut: number; pressure: number } }> };
    };
    gmg: { examples: Array<Record<string, number>>; tolerance_abs_kwh_t: number };
    laplante: {
      published: Record<string, number[]>; engine: Record<string, number[]> & { max_recovery: number; fit_at_bound: boolean; within_tolerance: boolean };
      without_grg_below_25um: Record<string, number[]> & { max_recovery: number; fit_at_bound: boolean; within_tolerance: boolean };
      audit: Record<string, number>; rising: boolean; diminishing: boolean; grg_above_ore_without_gravity: boolean;
    };
    zandrivierspoort: { published: Record<string, number[]>; engine: Record<string, number[]>; grade_difference_pct_points: { engine: number; published: number } };
  };
  kinetics: Record<string, { fits: number; mean_abs_lumping_error_pct: number; worst_abs_lumping_error_pct: number; converged_share: number }>;
  optimization: Record<string, Record<string, Opt>>;
  uncertainty: Record<string, { recovery_pct: Record<string, number>; probabilities: Record<string, number>; dominant_input: Record<string, string> }>;
}>('benchmark.json');
// Keep real-data adoption as one failing boundary, rather than crashing test collection
// or reporting obsolete numeric/ranking failures for every learning assertion.
const readRealLearning = (): LearningRecord => readLearningRecord(read<unknown>('learning.json'));

it('adversarial: adopted case captions cannot leak IDs or drop a target', () => {
  const record = readRealLearning();
  const index = read<{ cases: Array<{ case_id: string; title: Record<Lang, string> }> }>('manifests/index.json');
  for (const lang of ['en', 'es'] as const) {
    const foldNames = Object.fromEntries(index.cases.map(entry => [entry.case_id, entry.title[lang]]));
    for (const target of record.targets) {
      const html = renderToStaticMarkup(createElement(LearningEvidence, { record, target, lang, foldNames }));
      for (const fold of record.leave_one_case_out) {
        expect(html).toContain(foldNames[fold.held_out]);
        expect(html).not.toContain(fold.held_out);
      }
      expect(html).toContain(lang === 'en' ? 'rejected' : 'rechazadas');
    }
  }
});

const cellText = (html: string): string => html.replace(/<[^>]+>/g, '')
  .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function tableRows(html: string, caption: string): string[][] {
  const table = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)]
    .find(match => cellText(match[1].match(/<caption[^>]*>([\s\S]*?)<\/caption>/)?.[1] ?? '') === caption);
  expect(table, `missing rendered table: ${caption}`).toBeDefined();
  const body = table![1].match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  expect(body, `missing body: ${caption}`).toBeDefined();
  return [...body!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(row => [...row[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/g)].map(cell => cellText(cell[1])));
}

const unavailable = (lang: Lang) => lang === 'en' ? 'Unavailable' : 'No disponible';
const metricText = (value: number | null | undefined, lang: Lang) => value == null ? unavailable(lang) : formatSignificant(value, lang, 3, true);
const coverageText = (value: number | null | undefined, lang: Lang) => value == null ? unavailable(lang) : formatFraction(value, lang, 1);
const countsText = (attempted: number, scored: number, rejected: number, lang: Lang) => lang === 'en'
  ? `${formatFixed(attempted, lang, 0)} planned / ${formatFixed(scored, lang, 0)} scored / ${formatFixed(rejected, lang, 0)} rejected`
  : `${formatFixed(attempted, lang, 0)} previstas / ${formatFixed(scored, lang, 0)} evaluadas / ${formatFixed(rejected, lang, 0)} rechazadas`;

function expectMetric(actual: number | null, expected: number | null): void {
  if (expected === null) expect(actual).toBeNull();
  else { expect(actual).not.toBeNull(); expect(actual!).toBeCloseTo(expected, 9); }
}

function conditionalMetrics(scores: TargetScores[]) {
  const scored = scores.filter(score => score.status === 'scored');
  const r2s = scored.map(score => score.r2).sort((a, b) => a - b);
  return {
    attempted: scores.length, scored: scored.length, rejected: scores.length - scored.length,
    mean: scored.length ? scored.reduce((sum, score) => sum + score.rmse, 0) / scored.length : null,
    max: scored.length ? Math.max(...scored.map(score => score.rmse)) : null,
    median: r2s.length ? (r2s[Math.floor((r2s.length - 1) / 2)] + r2s[Math.floor(r2s.length / 2)]) / 2 : null,
  };
}

function expectScoreCell(cell: string, score: TargetScores, lang: Lang): void {
  if (score.status === 'scored') {
    expect(cell).toBe(metricText(score.r2, lang));
    expect(score.valid_for_scoring).toBe(true);
    expect([score.rmse, score.mae, score.r2].every(Number.isFinite)).toBe(true);
    return;
  }
  expect(score.valid_for_scoring).toBe(false);
  expect([score.rmse, score.mae, score.r2]).toEqual([null, null, null]);
  expect(score.rejection.code).toBe('observable-range');
  expect(score.rejection.reason.trim()).not.toBe('');
  expect(score.rejection.affected_rows).toBeGreaterThan(0);
  const diagnostic = [score.observable, ...Object.values(score.observable_by_case ?? {})].find(item => item.status === 'rejected-outside-range');
  expect(diagnostic).toBeDefined();
  expect(cell).toContain(lang === 'en' ? 'Rejected: prediction range' : 'Rechazado: rango de predicción');
  expect(cell).toContain(lang === 'en' ? 'outside allowed envelope' : 'fuera de la envolvente admisible');
  for (const range of [diagnostic!.prediction_range, diagnostic!.allowed_range]) {
    expect(cell).toContain(`[${range.map(value => formatSignificant(value, lang, 4)).join('; ')}]`);
  }
  expect(cell).toContain(formatFixed(score.rejection.affected_rows, lang, 0));
  expect(cell).not.toMatch(/NaN|Infinity/);
}

function expectRenderedLearning(record: LearningRecord): void {
  for (const lang of ['en', 'es'] as const) {
    const names = record.models.map(model => LEARNING_MODELS[model][lang]);
    for (const target of record.targets) {
      const html = renderToStaticMarkup(createElement(LearningEvidence, { record, target, lang }));
      const protocols = [
        { id: 'leave_one_case_out' as const, prefix: 'loco' as const, title: lang === 'en' ? 'One case out' : 'Un caso fuera', folds: record.leave_one_case_out.map(fold => ({ id: fold.held_out, models: fold.models, flagRate: fold.held_out_flag_rate })) },
        { id: 'transfer' as const, prefix: 'transfer' as const, title: lang === 'en' ? 'One ore group out' : 'Un grupo de mineral fuera', folds: transferFoldEvidence(record) },
      ];
      for (const protocol of protocols) {
        const conditionalCaption = `${protocol.title}: ${lang === 'en' ? 'Conditional performance' : 'Rendimiento condicional'}`;
        const expectedRows = record.models.map((model, i) => {
          const summary = record.summary[model][target], counts = summary[`${protocol.prefix}_folds`];
          return [names[i], metricText(summary[`${protocol.prefix}_r2_median`], lang), metricText(summary[`${protocol.prefix}_rmse_mean`], lang), countsText(counts.attempted, counts.scored, counts.rejected, lang)];
        });
        expect(tableRows(html, conditionalCaption)).toEqual(expectedRows);

        const cohort = record.common_cohorts[protocol.id][target];
        const commonTitle = lang === 'en' ? 'Matched common folds' : 'Particiones comunes entre modelos';
        const commonCaption = `${commonTitle}: ${formatFixed(cohort.folds.length, lang, 0)} / ${formatFixed(cohort.attempted, lang, 0)}`;
        // Scope each common table to its protocol: equal coverage counts can give
        // both protocol tables the same caption while their metrics differ.
        const section = [...html.matchAll(/<section aria-label="([^"]+)">([\s\S]*?)<\/section>/g)].find(match => match[1] === protocol.title)?.[2];
        expect(section).toBeDefined();
        expect(tableRows(section!, commonCaption)).toEqual(record.models.map((model, i) => [names[i], metricText(cohort.models[model].r2_median, lang), metricText(cohort.models[model].rmse_mean, lang)]));
        const excluded = cohort.excluded.length ? cohort.excluded.join(', ') : lang === 'en' ? 'None' : 'Ninguna';
        expect(cellText(section!)).toContain(`${lang === 'en' ? 'Excluded folds' : 'Particiones excluidas'}: ${excluded}.`);
        if (!cohort.folds.length) expect(cellText(section!)).toContain(lang === 'en' ? 'No common admissible folds. Model comparison is unavailable.' : 'No hay particiones admisibles comunes. La comparación entre modelos no está disponible.');
        else expect(cellText(section!)).toContain(`${commonTitle}: ${cohort.folds.join(', ')}.`);

        if (protocol.folds.length) {
          const rows = tableRows(html, `${protocol.title}: R²`);
          expect(rows).toHaveLength(protocol.folds.length);
          protocol.folds.forEach((fold, i) => {
            expect(rows[i].slice(0, 2)).toEqual([fold.id, formatFraction(fold.flagRate, lang, 0)]);
            record.models.forEach((model, j) => expectScoreCell(rows[i][j + 2], fold.models[model][target], lang));
          });
        }
      }

      const seedSummary = record.mlp_seeds.summary[target];
      expect(tableRows(html, lang === 'en' ? 'MLP seed stability: conditional one-case-out metrics' : 'Estabilidad del MLP entre semillas: métricas condicionales con un caso fuera'))
        .toEqual(record.mlp_seeds.seeds.map((seed, i) => {
          const counts = seedSummary.loco_folds[i];
          return [formatFixed(seed, lang, 0), metricText(seedSummary.loco_r2_median[i], lang), metricText(seedSummary.loco_rmse_mean[i], lang), countsText(counts.attempted, counts.scored, counts.rejected, lang)];
        }));
      const seedRows = tableRows(html, `${lang === 'en' ? 'One case out / Interpolation' : 'Un caso fuera / Interpolación'}: R²`);
      expect(seedRows).toHaveLength(Object.keys(record.mlp_seeds.scores).length);
      Object.entries(record.mlp_seeds.scores).forEach(([split, targets], i) => {
        expect(seedRows[i][0]).toBe(split === 'interpolation' ? lang === 'en' ? 'Interpolation' : 'Interpolación' : split);
        targets[target].forEach((score, j) => expectScoreCell(seedRows[i][j + 1], score, lang));
      });
      const text = cellText(html), gp = record.summary.gaussian_process[target];
      expect(text).toContain(`${lang === 'en' ? 'Case-mean baseline R²' : 'R² de la referencia de media por caso'}: ${metricText(record.interpolation.case_mean_baseline[target].r2, lang)}.`);
      expect(text).toContain(`${lang === 'en' ? 'Gaussian-process interpolation interval coverage' : 'Cobertura de intervalos del proceso gaussiano en interpolación'}: ${formatFraction(record.interpolation.models.gaussian_process[target].coverage_95, lang, 1)}.`);
      expect(text).toContain(`${lang === 'en' ? 'Gaussian-process interval coverage with one case out (conditional pooled / worst fold): ' : 'Cobertura de intervalos del proceso gaussiano con un caso fuera (agrupada condicional / peor partición): '}${coverageText(gp.loco_coverage_pooled, lang)} / ${coverageText(gp.loco_coverage_worst, lang)}`);
      expect(text).not.toMatch(/NaN|Infinity/);
      if (lang === 'es') expect(text).not.toMatch(/Unavailable|Rejected|planned|scored|prediction range/);
    }

    const plots: Array<ComponentProps<typeof ChartModule.Chart>> = [];
    const chart = vi.spyOn(ChartModule, 'Chart').mockImplementation(props => {
      plots.push(props); return createElement('figure', { 'aria-label': props.title }, props.summary);
    });
    try {
      const html = renderToStaticMarkup(createElement(LearningComparison, { record, lang }));
      expect(plots).toHaveLength(1);
      const target = 'recovery_pct', cohort = record.common_cohorts.transfer[target];
      expect(plots[0].data).toEqual([record.models.map((_, i) => i), record.models.map(model => record.summary[model][target].interpolation_r2), record.models.map(model => cohort.models[model].r2_median)]);
      expect(plots[0].categories).toEqual(names);
      expect(plots[0].series[1].label).toBe(lang === 'en' ? 'Matched common folds' : 'Particiones comunes entre modelos');
      expect(plots[0].summary).toContain(lang === 'en' ? 'gaps' : 'huecos');
      for (const model of record.models) {
        const counts = record.summary[model][target].transfer_folds;
        expect(cellText(html)).toContain(countsText(counts.attempted, counts.scored, counts.rejected, lang));
      }
      const comparisonSelect = [...html.matchAll(/<select[^>]*>([\s\S]*?)<\/select>/g)][2]?.[1];
      expect(comparisonSelect).toMatch(/<option(?=[^>]*value="common")(?=[^>]*selected="")[^>]*>/);
    } finally { chart.mockRestore(); }
  }
}

describe('the Benchmark page says what the records hold', () => {
  it('published examples: Moly-Cop, GMG, Laplante and Zandrivierspoort as quoted', () => {
    // E-05 and E-08: every published input, net energy against net; P80 and the load are inputs
    const m = benchmark.oracles.molycop;
    expect(Math.abs(m.inputs.p80_um.relative_error)).toBeLessThan(1e-9);
    expect(Math.abs(m.inputs.circulating_load.relative_error)).toBeLessThan(1e-9);
    const c = m.comparison;
    expect([round(c.net_specific_energy_kwh_t.engine, 2), round(c.net_specific_energy_kwh_t.published, 2)]).toEqual([7.3, 7.71]);
    expect(round(100 * c.net_specific_energy_kwh_t.relative_error, 1)).toBe(-5.2);
    expect(m.tolerance.net_specific_energy_kwh_t).toBe(0.2);
    expect([Math.round(c.cut_um.engine), c.cut_um.published]).toEqual([188, 183.3]);
    expect([round(100 * c.water_bypass.engine, 1), round(100 * c.water_bypass.published, 1)]).toEqual([37.4, 37.5]);
    expect(c.overflow_passing_max_abs_difference_pct).toBeLessThan(0.5);
    // E-07: the sizing fails both published classifier states, by the factors the page quotes
    const bs = m.sizing.examples.BallSim_Direct, bp = m.sizing.examples.BallParam_Direct;
    expect([round(1 / bs.calibration.cut, 2), round(1 / bp.calibration.cut, 2)]).toEqual([1.66, 1.38]);
    expect([round(1 / bs.calibration.pressure, 1), round(1 / bp.calibration.pressure, 1)]).toEqual([2.2, 1.7]);
    expect([bs.sized_for_published_cut.cyclones, Math.round(bs.sized_for_published_cut.pressure_kpa)]).toEqual([2, 816]);
    expect([bs.published.cyclones, Math.round(bs.published.pressure_kpa)]).toEqual([6, 53]);
    const gmg = benchmark.oracles.gmg;
    expect(gmg.examples.map(e => round(e.engine_operating_work_index_kwh_t, 2))).toEqual([14.38, 11.71]);
    expect(gmg.examples.map(e => e.operating_work_index_kwh_t)).toEqual([14.4, 11.7]);
    for (const e of gmg.examples) expect(Math.abs(e.error_kwh_t)).toBeLessThan(0.03);
    expect(gmg.tolerance_abs_kwh_t).toBe(0.05);
    // E-11: the simulator example like for like, as the page quotes it
    const l = benchmark.oracles.laplante, e = l.engine, w = l.without_grg_below_25um;
    expect(l.published.grg_recovery_pct).toEqual([79.78, 88.28, 91.79, 93.74, 94.75, 95.85]);
    expect([l.published.grg_circulating_load_pct[0], l.published.grg_circulating_load_pct[3], l.published.grg_circulating_load_pct.at(-1)]).toEqual([2016.31, 602.84, 412.63]);
    expect(e.fit_at_bound && e.max_recovery === 1 && !e.within_tolerance).toBe(true);
    expect([round(e.grg_recovery_pct[0], 1), round(e.grg_recovery_pct.at(-1)!, 1)]).toEqual([69.5, 90.7]);
    const missed = e.grg_recovery_pct.map((v, i) => l.published.grg_recovery_pct[i] - v);
    expect([round(Math.max(...missed), 1), round(Math.min(...missed), 1)]).toEqual([10.3, 5.2]);
    const clLow = e.grg_circulating_load_pct.map((v, i) => 100 * (1 - v / l.published.grg_circulating_load_pct[i]));
    expect([Math.round(Math.min(...clLow)), Math.round(Math.max(...clLow))]).toEqual([65, 80]);
    expect([Math.round(Math.min(...e.grg_to_overflow_pct)), Math.round(Math.max(...e.grg_to_overflow_pct))]).toEqual([9, 31]);
    expect([round(Math.min(...e.discharge_grg_below_150um_pct), 1), round(Math.max(...e.discharge_grg_below_150um_pct), 1)]).toEqual([86.7, 88.3]);
    expect(round(w.max_recovery, 2)).toBe(0.74);
    const near = w.grg_recovery_pct.map((v, i) => Math.abs(v - l.published.grg_recovery_pct[i]));
    expect([round(Math.max(...near.slice(1)), 1), round(near[0], 1)]).toEqual([1.1, 4.8]);
    const wLow = w.grg_circulating_load_pct.map((v, i) => 100 * (1 - v / l.published.grg_circulating_load_pct[i]));
    expect([Math.round(Math.min(...wLow)), Math.round(Math.max(...wLow))]).toEqual([50, 69]);
    expect([Math.round(l.audit.grg_circulating_load_pct), round(l.audit.underflow_over_overflow_au_grade, 1), Math.round(100 * l.audit.underflow_grg_share)]).toEqual([2812, 9.3, 97]);
    expect(l.rising && l.diminishing && l.grg_above_ore_without_gravity).toBe(true);
    const z = benchmark.oracles.zandrivierspoort;
    expect(z.engine.concentrate_fe_pct.map(v => round(v, 1))).toEqual([63.8, 67.8]);
    expect(z.published.concentrate_fe_pct).toEqual([64.9, 69.0]);
    expect(round(z.grade_difference_pct_points.engine, 1)).toBe(4.0);
    expect(round(z.grade_difference_pct_points.published, 1)).toBe(4.1);
    expect(z.engine.magnetite_recovery_pct.map(v => round(v, 1))).toEqual([94.9, 93.5]);
  });

  it('kinetic lumping: 88 converged fits a model, first order worst, gamma then Kelsall best', () => {
    const k = benchmark.kinetics;
    for (const record of Object.values(k)) expect([record.fits, record.converged_share]).toEqual([88, 1]);
    const mean = (id: string) => round(k[id].mean_abs_lumping_error_pct, 1), worst = (id: string) => round(k[id].worst_abs_lumping_error_pct, 1);
    expect([mean('first_order'), worst('first_order')]).toEqual([7.6, 19.1]);
    expect([round(k.gamma.mean_abs_lumping_error_pct, 2), round(k.kelsall.mean_abs_lumping_error_pct, 2)]).toEqual([1.27, 1.81]);
    expect([worst('gamma'), worst('kelsall')]).toEqual([5.1, 8.5]);
    expect([mean('klimpel'), mean('stretched_exponential')]).toEqual([2.8, 4.8]);
    // the first-order model's bank: residence past the 16-minute test, and an underestimate at every nominal state
    const index = read<{ cases: Array<{ case_id: string }> }>('manifests/index.json');
    const nominal = index.cases.map(c => read<{ variants: Array<{ trace: { metrics: Record<string, number>; methods: { kinetics: { status?: string; models?: Array<{ id: string; lumping_error_pct: number }> } } } }> }>(`cases/${c.case_id}.json`).variants[0].trace)
      .filter(tr => tr.methods.kinetics.status !== 'not_applicable');
    const residence = nominal.map(tr => tr.metrics.rougher_residence_min);
    expect([Math.round(Math.min(...residence)), Math.round(Math.max(...residence))]).toEqual([23, 84]);
    const text = ENGINE_BENCHMARK.KINETICS.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/7\.6 points of recovery on average and 19\.1 at worst/);
    expect(text).toMatch(/nominal bank residence ranges from 23 to 84 minutes/);
    expect(text).toMatch(/Gamma and Kelsall lose 1\.27 and 1\.81 points on average, with worst errors of 5\.1 and 8\.5; Klimpel averages 2\.80 and the stretched exponential 4\.76 points/);
    expect(Math.min(...residence)).toBeGreaterThan(16);
    expect(nominal.every(tr => tr.methods.kinetics.models!.find(m => m.id === 'first_order')!.lumping_error_pct < 0)).toBe(true);
    const order = Object.keys(k).sort((a, b) => k[a].mean_abs_lumping_error_pct - k[b].mean_abs_lumping_error_pct);
    expect(order[0]).toBe('gamma');
    expect(order.at(-1)).toBe('first_order');
  });

  it('optimization: 94 of 96 feasible, 28 target-mode variants break a constraint, the one loss from one, power most often active', () => {
    const records = Object.entries(benchmark.optimization).flatMap(([id, variants]) => Object.entries(variants).map(([v, r]) => ({ id, v, r })));
    expect(records).toHaveLength(96);
    expect(records.filter(x => x.r.status === 'optimal')).toHaveLength(94);
    expect(records.filter(x => x.r.status !== 'optimal').map(x => `${x.id}:${x.v}`).sort()).toEqual(['iron_magnetite_fine:harder_ore', 'iron_magnetite_fine:higher_throughput']);
    const cut = records.filter(x => x.v.startsWith('cut_')), target = records.filter(x => !x.v.startsWith('cut_'));
    expect([target.length, target.filter(x => !x.r.base_feasible).length]).toEqual([72, 29]);
    expect([cut.length, cut.filter(x => !x.r.base_feasible).length, cut.filter(x => x.r.status === 'optimal').length]).toEqual([24, 0, 24]);
    const gains = records.filter(x => x.r.gain_pct !== null).sort((a, b) => (a.r.gain_pct as number) - (b.r.gain_pct as number));
    expect([gains[0].id, gains[0].v, round(gains[0].r.gain_pct as number, 1)]).toEqual(['iron_magnetite_fine', 'coarser_grind', -0.8]);
    expect([gains.at(-1)!.id, gains.at(-1)!.v, round(gains.at(-1)!.r.gain_pct as number, 1)]).toEqual(['copper_oxide', 'coarser_grind', 20.0]);
    // both ends of the range are measured from a state that broke a constraint, as the page says
    expect([gains[0].r.base_feasible, gains.at(-1)!.r.base_feasible]).toEqual([false, true]);
    const losses = gains.filter(x => (x.r.gain_pct as number) < 0);
    expect(losses).toHaveLength(2);
    expect(losses.every(x => !x.r.base_feasible)).toBe(true);
    const count = (name: string, set = records) => set.filter(x => x.r.active.includes(name)).length;
    expect([count('power'), count('grade'), count('water')]).toEqual([70, 31, 20]);
    expect(count('power', cut)).toBe(24);
    const nominal = Object.entries(benchmark.optimization).map(([id, v]) => ({ id, gain: v.nominal.gain_pct as number })).sort((a, b) => a.gain - b.gain);
    expect([nominal[0].id, round(nominal[0].gain, 1)]).toEqual(['iron_magnetite_fine', 0.3]);
    expect([nominal.at(-1)!.id, round(nominal.at(-1)!.gain, 1)]).toEqual(['copper_oxide', 7.9]);
    const cutGains = cut.map(x => ({ id: x.id, gain: x.r.gain_pct as number })).sort((a, b) => a.gain - b.gain);
    expect([cutGains[0].id, round(cutGains[0].gain, 1), cutGains.at(-1)!.id, round(cutGains.at(-1)!.gain, 1)]).toEqual(['iron_magnetite_fine', 0.3, 'zinc_sulfide', 6.2]);
    const text = ENGINE_BENCHMARK.OPTIMIZATION.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/94 of the 96 variants/);
    expect(text).toMatch(/Twenty-nine of the 72 target-mode variants/);
    expect(text).toMatch(/from -0\.8% \(magnetite with a coarser grind\) to \+20\.0% \(oxide copper with a coarser grind\)/);
    expect(text).toMatch(/Nominal gains run from 0\.3% \(magnetite\) to 7\.9% \(oxide copper\)/);
    expect(text).toMatch(/their optimized gains range from 0\.3% in magnetite to 6\.2% in zinc sulphide/);
    expect(text).toMatch(/active at 70 of the 94 optima and at all 24 in the cut mode, then the grade specification at 31 and the water capacity at 20/);
  });

  it('optimization: what the screen cost, the surrogate\'s error, the unscreened optima and the weight path (OP-07, OP-11)', () => {
    const records = Object.entries(benchmark.optimization).flatMap(([id, variants]) => Object.entries(variants).map(([v, r]) => ({ id, v, r })));
    const screened = records.filter(x => x.r.screened);
    // the learned lane describes the target mode, so exactly the target-mode variants are screened
    expect(screened.map(x => `${x.id}:${x.v}`).sort()).toEqual(records.filter(x => !x.v.startsWith('cut_')).map(x => `${x.id}:${x.v}`).sort());
    const sum = (f: (r: Opt) => number) => screened.reduce((a, x) => a + f(x.r), 0);
    const withScreen = sum(r => r.evaluations), without = sum(r => r.evaluations_without_screen!);
    expect([withScreen, without, round(100 * (withScreen / without - 1), 1)]).toEqual([26367, 22487, 17.3]);
    const change = screened.map(x => x.r.evaluations - x.r.evaluations_without_screen!);
    expect([change.filter(c => c < 0).length, change.filter(c => c > 0).length, change.filter(c => c === 0).length]).toEqual([0, 68, 4]);
    expect([sum(r => r.proposed!), sum(r => r.screened_candidates!), sum(r => r.improved!)]).toEqual([5811, 79034, 901]);
    // the rejections by reason are in the case records' per-start screen counts
    const rejected = { guard: 0, interval: 0 };
    for (const x of screened) {
      const starts = read<{ variants: Array<{ id: string; methods: { optimization: { starts: Array<{ screen: { rejected: Record<string, number> } }> } } }> }>(`cases/${x.id}.json`)
        .variants.find(v => v.id === x.v)!.methods.optimization.starts;
      for (const s of starts) { rejected.guard += s.screen.rejected.guard; rejected.interval += s.screen.rejected.interval; }
    }
    expect([rejected.guard, rejected.interval]).toEqual([19, 48268]);
    const errors = screened.map(x => x.r.surrogate_abs_error_pp).filter((e): e is number => typeof e === 'number');
    expect(errors).toHaveLength(68);
    expect(round(errors.reduce((a, e) => a + e, 0) / errors.length, 2)).toBe(0.66);
    const differ = screened.filter(x => !x.r.same_optimum_without_screen);
    expect([screened.length - differ.length, differ.length]).toEqual([65, 7]);
    // Compare every differing feasible pair in recovered metal and finest-mesh decision steps.
    const artifact = (id: string) => read<{ variants: Array<{ id: string; methods: { optimization: OptimizationRecord } }> }>(`cases/${id}.json`);
    const meshMinimum = 2 ** -10;
    const gaps = differ.map(x => {
      const rec = artifact(x.id).variants.find(v => v.id === x.v)!.methods.optimization;
      const plain = rec.without_screen!;
      const steps = Math.max(...rec.decisions.map(n => Math.abs(rec.optimum!.decisions[n] - plain.decisions![n]) / ((rec.bounds[n][1] - rec.bounds[n][0]) * meshMinimum)));
      return { key: `${x.id}:${x.v}`, short: 1 - rec.optimum!.recovered_tph / plain.recovered_tph!, steps: Math.round(steps) };
    });
    expect(gaps.filter(g => g.short > 0)).toHaveLength(5);
    expect(gaps.filter(g => g.short < 0)).toHaveLength(2);
    expect(gaps.every(g => g.steps >= 1 && g.steps <= 5)).toBe(true);
    expect(gaps.map(g => g.key).sort()).toEqual(['low_grade_copper:harder_ore', 'low_grade_copper:higher_throughput', 'mixed_ore_high_clay:coarser_grind', 'mixed_ore_high_clay:more_collector', 'mixed_ore_high_clay:nominal', 'nickel_sulphide:harder_ore', 'zinc_sulfide:coarser_grind']);
    // OP-07: at a quarter of the weight on metal the nominal optima trade metal for energy, except magnetite's
    const trade = Object.keys(benchmark.optimization).map(id => {
      const opt = artifact(id).variants[0].methods.optimization.optimum!, last = benchmark.optimization[id].nominal.path.at(-1)!;
      expect([last.weight, last.status]).toEqual([0.25, 'optimal']);
      return { id, energy: 100 * (1 - last.energy_kwh_t! / opt.values.energy_kwh_t), metal: 100 * (1 - last.recovered_tph / opt.recovered_tph) };
    });
    const moved = trade.filter(x => x.id !== 'iron_magnetite_fine');
    expect([Math.round(Math.min(...moved.map(x => x.energy))), Math.round(Math.max(...moved.map(x => x.energy)))]).toEqual([0, 42]);
    expect([Math.round(Math.min(...moved.map(x => x.metal))), Math.round(Math.max(...moved.map(x => x.metal)))]).toEqual([0, 29]);
    const magnetite = trade.find(x => x.id === 'iron_magnetite_fine')!;
    expect([Math.abs(magnetite.energy) < 1e-9, Math.abs(magnetite.metal) < 1e-9]).toEqual([true, true]);
    expect(benchmark.optimization.iron_magnetite_fine.nominal.active).toContain('grade');
    // along every full path neither energy nor metal rises as the weight falls, beyond the mesh's resolution
    let worst = 0;
    for (const x of records.filter(r => r.r.status === 'optimal' && r.r.path.every(s => s.status === 'optimal'))) {
      const opt = artifact(x.id).variants.find(v => v.id === x.v)!.methods.optimization.optimum!;
      const energy = [opt.values.energy_kwh_t, ...x.r.path.map(s => s.energy_kwh_t!)], metal = [opt.recovered_tph, ...x.r.path.map(s => s.recovered_tph)];
      for (const series of [energy, metal]) for (let k = 1; k < series.length; k += 1) worst = Math.max(worst, series[k] / series[k - 1] - 1);
    }
    expect(worst).toBeLessThan(1e-4);
    const text = ENGINE_BENCHMARK.OPTIMIZATION.paragraphs.map(p => p.en).join(' ');
    expect(text).toMatch(/26,367 cached trials versus 22,487 without screening, 17\.3% more/);
    expect(text).toMatch(/Of 79,034 candidates, 19 were rejected by the guard and 48,268 by the uncertainty interval; 5,811 were proposed to the engine and 901 improved/);
    expect(text).toMatch(/0\.66 points across the 68 of 72 variants with evaluated proposals/);
    expect(text).toMatch(/exclude the later weight path, uncached audits, model fitting\/loading and inference/);
    expect(text).toMatch(/same terminal outcome in 65 variants: 63 identical feasible decisions and two matching infeasible outcomes\. Seven of the 70 feasible pairs selected different decisions; recovered metal differed by at most 0\.017%, and the decisions were one to five mesh steps apart\. Five favoured the unscreened result and two the screened result/);
    expect(text).toMatch(/spends 0 to 42% less energy per tonne and 0 to 29% less metal/);
    expect(text).toMatch(/beyond 0\.01%, the mesh's resolution/);
    const spanish = ENGINE_BENCHMARK.OPTIMIZATION.paragraphs.map(p => p.es).join(' ');
    expect(spanish).toContain('79.034 candidatos');
    expect(spanish).toContain('incertidumbre 48.268');
    expect(spanish).toContain('68 de 72 variantes');
    expect(spanish).toContain('de 0 a 42% menos energía');
    expect(spanish).toContain('de 0 a 29% menos metal');
  });

  it('uncertainty: the spreads, the joint probabilities and the dominant inputs as quoted', () => {
    const u = benchmark.uncertainty;
    const width = Object.entries(u).map(([id, r]) => ({ id, w: r.recovery_pct.p95 - r.recovery_pct.p05 })).sort((a, b) => a.w - b.w);
    expect([width[0].id, round(width[0].w, 1)]).toEqual(['mixed_ore_high_clay', 1.5]);
    expect([width.at(-1)!.id, round(width.at(-1)!.w, 1)]).toEqual(['zinc_sulfide', 9.7]);
    const joint = Object.entries(u).map(([id, r]) => ({ id, p: r.probabilities.all_constraints })).sort((a, b) => a.p - b.p);
    expect([joint[0].id, Math.round(100 * joint[0].p)]).toEqual(['zinc_sulfide', 44]);
    const m = u.iron_magnetite_fine.probabilities;
    expect([Math.round(100 * m.grade_meets_spec), Math.round(100 * m.power_within_installed)]).toEqual([66, 79]);
    const top = joint.filter(x => x.p === joint.at(-1)!.p).map(x => x.id).sort();
    expect([top, Math.round(100 * joint.at(-1)!.p)]).toEqual([['copper_oxide'], 88]);
    // the record's phosphate case is two draws of 128 above the soft porphyry
    expect([Math.round(100 * u.copper_porphyry_soft.probabilities.all_constraints), Math.round(128 * (u.phosphate_clay.probabilities.all_constraints - u.copper_porphyry_soft.probabilities.all_constraints))]).toEqual([82, 2]);
    const not = (key: string, value: string) => Object.entries(u).filter(([, r]) => r.dominant_input[key] !== value).map(([id]) => id).sort();
    expect(not('recovery_pct', 'floatability')).toEqual(['copper_porphyry_hard', 'iron_magnetite_fine']);
    expect(u.copper_porphyry_hard.dominant_input.recovery_pct).toBe('work_index');
    expect(u.iron_magnetite_fine.dominant_input.recovery_pct).toBe('head_grade');
    expect(not('concentrate_grade', 'liberation_size')).toEqual(['copper_oxide', 'gold_free_milling', 'mixed_ore_high_clay', 'nickel_sulphide', 'refractory_gold']);
    expect(not('specific_energy_grinding_kwh_t', 'work_index')).toEqual([]);
    expect(not('recovered_primary_tph', 'head_grade')).toEqual([]);
    // UQ-08: the page says which record the workbench re-runs live and which stays baked
    const limits = (ENGINE_BENCHMARK.UNCERTAINTY.limits ?? []).map(l => l.en).join(' ');
    expect(limits).toMatch(/re-runs the uncertainty record/);
    expect(limits).toMatch(/Sobol indices are precomputed only/);
  });

  it('learning-v2: real artifact boundary, conditional denominators, matched cohorts and rendered evidence', () => {
    // This read must fail on a v1 production artifact. Every assertion below then
    // waits on the same explicit data dependency, without skips or fallback data.
    const record = readRealLearning();
    expect(record.schema).toBe('oreflow.learning/v2');
    expect(record.leave_one_case_out.map(fold => fold.held_out).sort()).toEqual([...record.design.cases].sort());

    // Reconstruct the transfer denominator independently: grouped holdouts and
    // each singleton group's case holdout contribute once each.
    const groups = new Map<string, string[]>();
    for (const [id, group] of Object.entries(record.transfer_groups)) groups.set(group, [...groups.get(group) ?? [], id]);
    const transfer = [...groups].map(([id, members]) => {
      if (members.length === 1) {
        const fold = record.leave_one_case_out.find(fold => fold.held_out === members[0]);
        expect(fold, `missing singleton transfer ${id}`).toBeDefined();
        return { id, models: fold!.models };
      }
      const fold = record.leave_one_group_out.find(fold => fold.held_out_group === id);
      expect(fold, `missing grouped transfer ${id}`).toBeDefined();
      expect([...fold!.cases].sort()).toEqual([...members].sort());
      return { id, models: fold!.models };
    });
    const protocols = [
      { id: 'leave_one_case_out' as const, prefix: 'loco' as const, folds: record.leave_one_case_out.map(fold => ({ id: fold.held_out, models: fold.models })) },
      { id: 'transfer' as const, prefix: 'transfer' as const, folds: transfer },
    ];
    for (const target of record.targets) {
      for (const model of record.models) {
        const interpolation = record.interpolation.models[model][target], summary = record.summary[model][target];
        expect(interpolation.status).toBe('scored');
        expect(interpolation.rows).toBe(record.interpolation.test_rows);
        expectMetric(summary.interpolation_rmse, interpolation.rmse);
        expectMetric(summary.interpolation_r2, interpolation.r2);
        expectMetric(summary.interpolation_r2_within_case, interpolation.r2_within_case ?? null);
        expectMetric(summary.case_mean_r2, record.interpolation.case_mean_baseline[target].r2);
      }
      for (const protocol of protocols) {
        const matched = protocol.folds.filter(fold => record.models.every(model => fold.models[model][target].status === 'scored'));
        const excluded = protocol.folds.filter(fold => !matched.includes(fold));
        const cohort = record.common_cohorts[protocol.id][target];
        expect(cohort.attempted).toBe(protocol.folds.length);
        expect([...cohort.folds].sort()).toEqual(matched.map(fold => fold.id).sort());
        expect([...cohort.excluded].sort()).toEqual(excluded.map(fold => fold.id).sort());
        expect(new Set([...cohort.folds, ...cohort.excluded]).size).toBe(protocol.folds.length);
        for (const model of record.models) {
          const scores = protocol.folds.map(fold => fold.models[model][target]);
          const expected = conditionalMetrics(scores), summary = record.summary[model][target];
          expect(summary[`${protocol.prefix}_folds`]).toEqual({ attempted: expected.attempted, scored: expected.scored, rejected: expected.rejected });
          expectMetric(summary[`${protocol.prefix}_rmse_mean`], expected.mean);
          expectMetric(summary[`${protocol.prefix}_rmse_max`], expected.max);
          expectMetric(summary[`${protocol.prefix}_r2_median`], expected.median);
          const common = conditionalMetrics(matched.map(fold => fold.models[model][target]));
          expectMetric(cohort.models[model].rmse_mean, common.mean);
          expectMetric(cohort.models[model].r2_median, common.median);
          for (const [comparison, values] of [
            ['conditional', record.models.map(model => record.summary[model][target][`${protocol.prefix}_r2_median`])],
            ['common', record.models.map(model => cohort.models[model].r2_median)],
          ] as const) expect(learningSeries(record, target, protocol.id, comparison)).toEqual(values);
        }
      }

      const seeds = record.mlp_seeds;
      expect(Object.keys(seeds.scores).sort()).toEqual(['interpolation', ...record.design.cases].sort());
      for (const [split, targets] of Object.entries(seeds.scores)) {
        expect(targets[target]).toHaveLength(seeds.seeds.length);
        targets[target].forEach((score, i) => {
          expect(score.evaluation).toMatchObject({ method: 'mlp', target, fold: split, seed: seeds.seeds[i] });
          if (split !== 'interpolation') expect(seeds.summary[target].loco_rmse_by_case[split][i]).toBe(score.rmse);
        });
      }
      seeds.seeds.forEach((_, i) => {
        const expected = conditionalMetrics(record.design.cases.map(id => seeds.scores[id][target][i]));
        expect(seeds.summary[target].loco_folds[i]).toEqual({ attempted: expected.attempted, scored: expected.scored, rejected: expected.rejected });
        expectMetric(seeds.summary[target].loco_rmse_mean[i], expected.mean);
        expectMetric(seeds.summary[target].loco_r2_median[i], expected.median);
        expect(seeds.summary[target].interpolation_rmse[i]).toBe(seeds.scores.interpolation[target][i].rmse);
      });

      const gp = record.interpolation.models.gaussian_process[target];
      expect(gp.training_rows).toBe(Math.min(record.settings.gp_training_rows, record.interpolation.train_rows));
      expect(gp.kernel).toBeTypeOf('string');
      expect(Object.keys(gp.length_scales ?? {}).sort()).toEqual([...record.features].sort());
      if (gp.training_rows! < record.interpolation.train_rows) for (const model of ['ridge', 'random_forest', 'hist_gradient_boosting']) {
        const equalRows = record.equal_rows[model];
        expect(equalRows, `missing equal-training-row score for ${model}`).toBeDefined();
        expect(equalRows![target]).toMatchObject({ status: 'scored', rows: record.interpolation.test_rows, evaluation: { method: model, target, protocol: 'interpolation' } });
      }
      const covered = record.leave_one_case_out.map(fold => fold.models.gaussian_process[target]).filter(score => score.status === 'scored');
      const coveredRows = covered.reduce((sum, score) => sum + score.rows, 0);
      expectMetric(record.summary.gaussian_process[target].loco_coverage_pooled ?? null, covered.length ? covered.reduce((sum, score) => sum + score.coverage_95 * score.rows, 0) / coveredRows : null);
      expectMetric(record.summary.gaussian_process[target].loco_coverage_worst ?? null, covered.length ? Math.min(...covered.map(score => score.coverage_95)) : null);
    }
    const distances = record.guard.acceptance_by_distance;
    expect(distances.map(probe => probe.distance)).toEqual(record.settings.ood_shifts);
    const headline = distances.find(probe => probe.distance === record.settings.ood_shift);
    expect(headline).toBeDefined();
    expect(record.guard.false_accept_rate).toBeCloseTo(headline!.upward, 12);
    for (const rate of [record.guard.false_alarm_rate, record.guard.false_accept_rate, ...Object.values(record.guard.false_accept_by_feature), ...distances.flatMap(probe => [probe.upward, probe.downward]), ...record.leave_one_case_out.map(fold => fold.held_out_flag_rate)]) {
      expect(Number.isFinite(rate)).toBe(true); expect(rate).toBeGreaterThanOrEqual(0); expect(rate).toBeLessThanOrEqual(1);
    }
    expectRenderedLearning(record);
  });

  it('learning-v2: table and comparison rendering probe uses an explicitly authored fixture', () => {
    // Independent rendering coverage can run while the real-data test above
    // remains red. This fixture never satisfies or replaces that real boundary.
    expectRenderedLearning(readLearningRecord(authoredLearningFixture));
  });

  it('measured lanes: the GeoMet bootstrap and the HZDR probability errors as quoted', () => {
    const g = read<{
      source: { raw_rows: number; usable_rows: number; holes: number };
      protocols: Record<'hole' | 'zone', { folds: unknown[]; paired_bootstrap: { samples: number; rmse_differences: Record<string, { mean_pp: number; interval_95_pp: [number, number]; excludes_zero: boolean }> };
        robust?: Record<'repeated_partitions' | 'leave_one_hole_out', { rmse_differences: Record<string, { difference_pp: number; interval_adjusted_pp: [number, number]; excludes_zero: boolean }>; ridge_gain_over_mean_pp?: { mean: number; published_percentile: number } }> }>;
    }>('source/geomet_lct_benchmark.json');
    expect([g.source.raw_rows, g.source.usable_rows, g.source.holes]).toEqual([53, 52, 29]);
    expect([g.protocols.hole.folds.length, g.protocols.zone.folds.length]).toEqual([5, 3]);
    const hole = g.protocols.hole.paired_bootstrap, zone = g.protocols.zone.paired_bootstrap;
    expect(hole.samples).toBe(2000);
    expect(Object.entries(hole.rmse_differences).filter(([, d]) => d.excludes_zero).map(([pair]) => pair)).toEqual(['train_mean-ridge']);
    const ridge = hole.rmse_differences['train_mean-ridge'];
    expect([round(ridge.mean_pp, 2), round(ridge.interval_95_pp[0], 2), round(ridge.interval_95_pp[1], 2)]).toEqual([0.42, 0.02, 0.82]);
    expect(Object.values(zone.rmse_differences).some(d => d.excludes_zero)).toBe(false);
    // M-05: the fixed partition is extreme; over partitions and leaving a hole out nothing separates
    const robust = g.protocols.hole.robust!;
    const rp = robust.repeated_partitions, lo = robust.leave_one_hole_out;
    expect([rp.ridge_gain_over_mean_pp!.published_percentile, round(rp.ridge_gain_over_mean_pp!.mean, 2)]).toEqual([98.5, 0.18]);
    const rr = rp.rmse_differences['train_mean-ridge'], lr = lo.rmse_differences['train_mean-ridge'];
    expect([round(rr.difference_pp, 2), round(rr.interval_adjusted_pp[0], 2), round(rr.interval_adjusted_pp[1], 2)]).toEqual([0.17, -0.39, 0.71]);
    expect([round(lr.difference_pp, 2), round(lr.interval_adjusted_pp[0], 2), round(lr.interval_adjusted_pp[1], 2)]).toEqual([0.22, -0.36, 0.79]);
    expect([...Object.values(rp.rmse_differences), ...Object.values(lo.rmse_differences)].some(d => d.excludes_zero)).toBe(false);
    const p = read<{
      protocol: { train_rows: number; validation_rows: number; test_rows: number };
      cases: Array<{ case: string; test_rows: number; excluded_test_rows: number; models: Record<string, { rmse: number }> }>;
    }>('source/hzdr_particle_benchmark.json');
    expect([p.protocol.train_rows, p.protocol.validation_rows, p.protocol.test_rows]).toEqual([68008, 10202, 29147]);
    const c4 = p.cases.find(c => c.case === '4')!;
    expect([c4.test_rows, c4.excluded_test_rows]).toEqual([28484, 663]);
    const better = (model: string) => p.cases.filter(c => c.models[model].rmse < c.models.published_reference.rmse).map(c => c.case);
    expect(better('particle_mlp')).toEqual(['1', '3', '4']);
    expect(better('l1_logistic')).toEqual(['1', '2', '3']);
    // M-09: the network against the linear model, the ordering the sentence once read as the opposite
    expect(p.cases.filter(c => c.models.l1_logistic.rmse < c.models.particle_mlp.rmse).map(c => c.case)).toEqual(['1', '2']);
    expect([round(c4.models.l1_logistic.rmse, 2), round(c4.models.published_reference.rmse, 3), round(c4.models.particle_mlp.rmse, 3)]).toEqual([0.19, 0.037, 0.023]);
  });
});

// The review of 2026-10-02 (dimension 2, M items; E-10): every statistic the rewritten paragraphs quote is recomputed
// here from the records, so the next precompute cannot leave a number the record no longer holds
describe('the Benchmark statistics say what they hold (M-06 to M-23, E-10)', () => {
  const studies = read<any>('studies.json'), bench = read<any>('benchmark.json');
  const en = (topic: { paragraphs: Array<{ en: string }> }) => topic.paragraphs.map(p => p.en).join(' ');
  const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

  it('M-06: the spreads and extremes over the seed study', () => {
    const cases = Object.keys(studies.cases);
    const widths = (c: string): number[] => studies.cases[c].seed_study.per_seed.map((p: any) => p.recovery_pct.p95 - p.recovery_pct.p05);
    const joint = (c: string): number[] => studies.cases[c].seed_study.per_seed.map((p: any) => p.all_constraints);
    const seeds = widths(cases[0]).length;
    const extreme = (f: (c: string) => number[], pick: (a: number, b: number) => boolean) =>
      Array.from({ length: seeds }, (_, i) => cases.reduce((a, b) => (pick(f(b)[i], f(a)[i]) ? b : a)));
    expect(new Set(extreme(widths, (a, b) => a < b))).toEqual(new Set(['mixed_ore_high_clay']));
    expect(new Set(extreme(widths, (a, b) => a > b))).toEqual(new Set(['zinc_sulfide']));
    expect(extreme(joint, (a, b) => a < b).filter(c => c === 'iron_magnetite_fine')).toHaveLength(0);
    const g = widths('mixed_ore_high_clay'), z = widths('zinc_sulfide'), m = joint('iron_magnetite_fine');
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    expect([round(mean(g), 1), round(Math.min(...g), 1), round(Math.max(...g), 1), round(mean(z), 1), round(Math.min(...z), 1), round(Math.max(...z), 1)]).toEqual([1.6, 1.5, 1.7, 10.9, 10.2, 11.9]);
    expect([Math.round(100 * mean(m)), Math.round(100 * Math.min(...m)), Math.round(100 * Math.max(...m))]).toEqual([52, 50, 56]);
    expect(['copper_porphyry_soft', 'phosphate_clay', 'gold_free_milling'].map(c => Math.round(100 * mean(joint(c))))).toEqual([82, 82, 81]);
    const text = en(ENGINE_BENCHMARK.UNCERTAINTY);
    expect(text).toMatch(/recovery P05–P95 by 1\.5 points in high-clay copper and up to 9\.7 in zinc. Across eight further seeds, those widths range from 1\.5 to 1\.7 in high-clay copper and 10\.2 to 11\.9 in zinc/);
    expect(text).toMatch(/probability of meeting all constraints together is lowest in zinc \(44%\) and highest in oxide copper \(88%\)/);
    expect(text).toMatch(/magnetite is 52%, with grade meeting specification in 66% and mill power within its limit in 79%/);

  });

  it('M-10, M-14: the proposals behind the surrogate error, and the gains from states that met every constraint', () => {
    const recs = Object.entries(bench.optimization).flatMap(([id, vs]: [string, any]) => Object.entries(vs).map(([v, r]: [string, any]) => ({ id, v, r })));
    const errs: number[] = [];
    for (const x of recs.filter(x => x.r.screened)) {
      const o = read<any>(`cases/${x.id}.json`).variants.find((v: any) => v.id === x.v).methods.optimization;
      const c = o.proposal_columns as string[];
      for (const s of o.starts) for (const row of s.screen?.proposals ?? []) if (row[c.indexOf('engine_recovery_pct')] !== null) errs.push(row[c.indexOf('surrogate_recovery_pct')] - row[c.indexOf('engine_recovery_pct')]);
    }
    const abs = errs.map(Math.abs);
    expect([errs.length, round(abs.reduce((a, b) => a + b, 0) / abs.length, 2), round(median(abs), 2), round(Math.max(...abs), 1)]).toEqual([5811, 0.71, 0.48, 38.2]);
    expect(Math.round(4 * errs.filter(e => e < 0).length / errs.length)).toBe(2);
    const feasible = recs.filter(x => !x.v.startsWith('cut_') && x.r.base_feasible && x.r.gain_pct !== null).sort((a, b) => a.r.gain_pct - b.r.gain_pct);
    expect([feasible.length, feasible[0].id, feasible[0].v, round(feasible[0].r.gain_pct, 1), feasible.at(-1)!.id, feasible.at(-1)!.v, round(feasible.at(-1)!.r.gain_pct, 1)])
      .toEqual([43, 'iron_magnetite_fine', 'finer_crusher', 0.3, 'copper_oxide', 'coarser_grind', 20.0]);
    const text = en(ENGINE_BENCHMARK.OPTIMIZATION);
    expect(text).toMatch(/across the 5,811 proposals its mean is 0\.71, median 0\.48 and maximum 38\.16 points/);
    expect(text).toMatch(/Among the 43 feasible-start target variants, gains run from 0\.3% .* to 20\.0%/);
  });

  it('L-01: learned prose and captions qualify conditional and common-fold protocols in both languages', () => {
    const topic = ENGINE_BENCHMARK.LEARNED;
    for (const lang of ['en', 'es'] as const) {
      const prose = topic.paragraphs.map(paragraph => paragraph[lang]).join(' ');
      expect(prose).toMatch(lang === 'en' ? /planned denominator/ : /total previsto/);
      expect(prose).toMatch(lang === 'en' ? /ordinary RMSE, MAE and R² are unavailable/ : /RMSE, el MAE y el R² ordinarios no están disponibles/);
      expect(prose).toMatch(lang === 'en' ? /Finite constant predictions remain scored negative evidence/ : /predicciones constantes finitas siguen siendo evidencia negativa evaluada/);
      expect(topic.figure!.caption[lang]).toMatch(lang === 'en' ? /default comparison uses matched common folds/ : /comparación inicial usa particiones comunes/);
      expect(topic.figure!.caption[lang]).toMatch(lang === 'en' ? /conditional results.*coverage/ : /resultados condicionales.*cobertura/);
      const equation = topic.equations![0];
      const tex = typeof equation.tex === 'string' ? equation.tex : equation.tex[lang];
      expect(tex).toContain('A_{\\cap}=\\bigcap_m A_m');
      expect(equation.caption[lang]).toMatch(lang === 'en' ? /intersection of admissible fold IDs across all models/ : /intersección de los identificadores admisibles entre todos los modelos/);
      expect(prose).not.toMatch(/highest median recovery|most accurate on four|240 points|217 to 277/);
    }
  });

  it('E-10: the Zandrivierspoort levels, silica and rougher beside the step', () => {
    const z = bench.oracles.zandrivierspoort;
    expect(z.engine.concentrate_silica_pct.map((v: number) => round(v, 1))).toEqual([10.9, 5.8]);
    expect(z.gap_fe_pct_points.map((v: number) => round(-v, 1))).toEqual([1.1, 1.2]);
    expect([round(z.engine.rougher_75.magnetite_recovery_pct, 1), round(z.engine.rougher_75.concentrate_fe_pct, 1), z.published.rougher_75.magnetite_recovery_pct, z.published.rougher_75.concentrate_fe_pct]).toEqual([97.3, 60.1, 98.1, 63.8]);
    const text = en(ENGINE_BENCHMARK.ORACLES);
    expect(text).toMatch(/at levels 1\.1 and 1\.2 points below the published ones\. Its silica is 10\.9 and 5\.8% against the published 7\.7 and 2\.25%, and its rougher drum at 75 µm recovers 97\.3% of the magnetite at 60\.1% Fe, against the published 98\.1% at 63\.8%/);
  });
});
