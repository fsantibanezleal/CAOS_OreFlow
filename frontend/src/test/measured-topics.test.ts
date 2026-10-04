import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MEASURED } from '../content/methodology/measured';

// T-10, S-15, S-19 (review of 2026-10-02): the Methodology's measured-data topics quote the real-sample and the iron-plant
// records; every number they print is held here, so a new precompute cannot leave them describing the old one.
// OF_DERIVED points a development run at a sandbox bake.
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));
const read = <T,>(path: string) => JSON.parse(readFileSync(join(derived, path), 'utf-8')) as T;
const text = (id: string) => MEASURED.find(t => t.id === id)!.paragraphs.map(p => p.en).join(' ');
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

describe('the measured-data topics say what the records hold', () => {
  it('the real samples: the work index, its assignment, the bands, the shares and the magnetite', () => {
    const r = read<any>('real_samples.json');
    const s = r.summary;
    const t = text('real-samples');
    expect(t).toContain(`leaving ${s.samples}`);
    expect(t).toContain(`${s.comminution_samples} comminution samples`);
    expect(t).toContain(`this gives ${s.work_index_kwh_t.min.toFixed(1)} to ${s.work_index_kwh_t.max.toFixed(1)} kWh/t, median ${s.work_index_kwh_t.median.toFixed(1)}`);
    expect(t).toContain(`(${s.work_index_assignment.nearest_in_hole} of the ${s.samples}) or else the deposit median (${s.work_index_assignment.deposit_median})`);
    expect(t).toContain(`One sample falls in the first band, ${s.bands.chalcopyrite_bornite} in the second and ${s.bands.bornite_chalcocite} in the third`);
    expect(s.bands.chalcopyrite_pyrite).toBe(1);
    const shares = (m: string) => Math.round(100 * median(r.samples.map((x: any) => x.allocation.copper_shares[m] ?? 0)));
    expect(t).toContain(`bornite carries ${shares('bornite')}% of the copper and chalcocite ${shares('chalcocite')}%`);
    const mag = r.samples.map((x: any) => 100 * x.allocation.fractions.magnetite);
    expect(t).toContain(`(${Math.min(...mag).toFixed(1)} to ${Math.round(Math.max(...mag))}% of the ore)`);
    expect(t).toContain(`bornite at 84.2% at best`);
    expect([r.floatability_ratios.bornite, r.floatability_ratios.chalcocite_to_bornite]).toEqual([0.8, 1.5]);
    const floor = MEASURED.find(x => x.id === 'real-samples')!.limits!.map(l => l.en).join(' ');
    expect(floor).toContain(`(${Math.floor(r.sensitivity.target_grind_throughput.tph.min)} t/h in the record)`);
  });

  it('the soft sensor: the rows, the exclusions, the pairs and the pooled scores', () => {
    const i = read<any>('source/iron_plant_soft_sensor.json');
    const t = text('soft-sensor');
    const n = (v: number) => v.toLocaleString('en-US');
    expect(t).toContain(`${n(i.quality.source_rows)} rows from ${i.source.date_first.slice(0, 10)} to ${i.source.date_last.slice(0, 10)}`);
    expect(t).toContain(`${i.quality.rows_per_hour_min} to ${i.quality.rows_per_hour_max} rows an hour`);
    expect(t).toContain(`In ${i.quality.changing_lab_hours_excluded} hours`);
    expect(t).toContain(`(${n(i.quality.changing_lab_rows_excluded)} rows)`);
    expect(t).toContain(`${n(i.protocol.pair_rows)} pairs`);
    expect(t).toContain(`a mean absolute error of ${i.pooled_scores.previous_lab.mae_pct_points.toFixed(3)} points`);
    expect(t).toContain(`has the lowest RMSE (${i.pooled_scores.ar1_previous_lab.rmse_pct_points.toFixed(3)})`);
    const rmse = Object.entries(i.pooled_scores as Record<string, { rmse_pct_points: number }>).sort((a, b) => a[1].rmse_pct_points - b[1].rmse_pct_points);
    expect(rmse[0][0]).toBe('ar1_previous_lab');
    const mae = Object.entries(i.pooled_scores as Record<string, { mae_pct_points: number }>).sort((a, b) => a[1].mae_pct_points - b[1].mae_pct_points);
    expect(mae[0][0]).toBe('previous_lab');
    expect(t).toContain(`${Math.round(100 * i.repeated_assay_share)}% of the test hours repeat the previous assay exactly`);
    // the sensors added to the previous assay do worse than the fitted last assay under both metrics
    const worse = (i.comparisons as any[]).filter(c => c.a === 'ridge_with_previous_lab' && c.b === 'ar1_previous_lab');
    expect(worse.map(c => c.difference_pct_points > 0 && c.interval_95[0] > 0)).toEqual([true, true]);
  });
});
