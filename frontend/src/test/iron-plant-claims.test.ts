import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INDUSTRIAL } from '../content/industrial';
import type { IronPlant } from '../lib/artifacts';

// IS-05, IS-06: every number and ordering the industrial-quality tab states is recomputed from the committed
// soft-sensor artifact, in both languages, and the tab gives no set-point advice.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const a = JSON.parse(readFileSync(join(derived, 'source', 'iron_plant_soft_sensor.json'), 'utf-8')) as IronPlant;
const text = (lang: 'en' | 'es') => [...INDUSTRIAL.IRON_PLANT.paragraphs, ...(INDUSTRIAL.IRON_PLANT.limits ?? [])].map(p => p[lang]).join(' ');
const mae = (id: string) => a.pooled_scores[id].mae_pct_points;

describe('the industrial-quality tab says what the soft-sensor artifact holds', () => {
  it('the data and the exclusions', () => {
    expect([a.quality.source_rows, a.quality.changing_lab_hours_excluded, a.protocol.pair_rows, a.protocol.features.length]).toEqual([737_453, 310, 3_701, 21]);
    expect([a.source.dataset_id, a.source.version, a.source.license]).toEqual([6294, 1, 'CC0: Public Domain']);
    expect(a.folds.every(f => f.embargo_hours_min >= 24)).toBe(true);
    expect(text('en')).toMatch(/737,453 rows/);
    expect(text('en')).toMatch(/In 310 hours the silica label changes/);
    expect(text('en')).toMatch(/3,701 of them/);
    expect(text('en')).toMatch(/the 21 feed, reagent, pulp and column sensors/);
    expect(text('en')).toMatch(/at least 24 hours of embargo/);
    expect(text('es')).toMatch(/737\.453 filas/);
    expect(text('es')).toMatch(/3\.701\./);
  });

  it('the result: the mean, the sensors and persistence', () => {
    // ridge is 0.001 below the training mean; the forest and boosting are above it
    expect(Number((mae('train_mean') - mae('ridge')).toFixed(3))).toBe(0.001);
    expect(Number(mae('train_mean').toFixed(3))).toBe(0.766);
    expect(mae('random_forest') > mae('train_mean') && mae('hist_gradient_boosting') > mae('train_mean')).toBe(true);
    // M-04: persistence wins by MAE, the fitted last assay by RMSE, and the sensors added to the assay lose to the
    // fitted last assay under both, with intervals that exclude zero
    const all = Object.keys(a.pooled_scores);
    const rmse = (id: string) => a.pooled_scores[id].rmse_pct_points;
    expect(all.reduce((b, id) => (mae(id) < mae(b) ? id : b))).toBe('previous_lab');
    expect(all.reduce((b, id) => (rmse(id) < rmse(b) ? id : b))).toBe('ar1_previous_lab');
    expect([Number(mae('previous_lab').toFixed(3)), Number(rmse('ar1_previous_lab').toFixed(3)), Number(rmse('previous_lab').toFixed(3))]).toEqual([0.464, 0.707, 0.767]);
    const diff = (x: string, y: string, metric: string) => a.comparisons.find(c => c.a === x && c.b === y && c.metric === metric)!;
    const mm = diff('ridge_with_previous_lab', 'ar1_previous_lab', 'mae'), rr = diff('ridge_with_previous_lab', 'ar1_previous_lab', 'rmse');
    expect([Number(mm.difference_pct_points.toFixed(3)), Number(rr.difference_pct_points.toFixed(3))]).toEqual([0.015, 0.010]);
    expect([Number(mm.interval_95[0].toFixed(3)), Number(mm.interval_95[1].toFixed(3)), Number(rr.interval_95[0].toFixed(3)), Number(rr.interval_95[1].toFixed(3))]).toEqual([0.004, 0.025, 0.002, 0.018]);
    expect(Math.round(100 * a.repeated_assay_share)).toBe(14);
    expect(text('en')).toMatch(/ridge is 0\.001 points below its mean absolute error of 0\.766, and the random forest and gradient boosting are above it/);
    expect(text('en')).toMatch(/By mean absolute error the previous assay alone is best, 0\.464 points; by root-mean-square error the fitted last assay is best, 0\.707 points against persistence's 0\.767/);
    expect(text('en')).toMatch(/by 0\.015 points of mean absolute error and 0\.010 of root-mean-square error \(95% intervals from resampling whole days, 0\.004 to 0\.025 and 0\.002 to 0\.018\)/);
    expect(text('en')).toMatch(/14% of the test hours repeat the previous assay exactly/);
    expect(text('es')).toMatch(/0,001 puntos bajo su error absoluto medio de 0,766/);
    expect(text('es')).toMatch(/el ensaye anterior solo es el mejor, 0,464 puntos/);
    expect(text('es')).toMatch(/0,707 puntos frente a 0,767/);
  });

  it('no set-point advice, and the separation from the copper circuit (IS-06)', () => {
    for (const lang of ['en', 'es'] as const) {
      expect(text(lang).toLowerCase()).not.toMatch(/\brecommend|\bset point to|\bshould (raise|lower|increase|decrease)/);
    }
    expect(text('en')).toMatch(/nothing on it is set-point advice/);
    expect(text('en')).toMatch(/stays apart from the copper circuit and from the optimizer/);
  });
});
