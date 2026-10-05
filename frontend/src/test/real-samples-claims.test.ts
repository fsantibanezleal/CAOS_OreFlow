import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import constantsDoc from '../../../data-pipeline/pipeline/engine/data/constants.json';
import { SOURCE_TEXT } from '../workbench/views/SourceViews';
import { SAMPLE_FIXED } from '../workbench/Rail';

// RS-07, RS-08, RS-09: what the workbench says about a real source is what the engine and the records hold. The
// authored flotation ratios the Case view quotes are the declared constants; the fixed controls say why; an
// iron-plant hour is stated as outside the engine's families. OF_DERIVED points a development run at a sandbox bake.
const constants = (constantsDoc as { constants: Record<string, { value: unknown }> }).constants;
const derived = process.env.OF_DERIVED ?? fileURLToPath(new URL('../../../data/derived/', import.meta.url));

describe('the real-source views say what the records and the engine hold', () => {
  it('the Case view: what the sample fixes and what the engine authors (RS-09)', () => {
    expect(constants['minerals.bornite_floatability_ratio'].value).toBe(0.8);
    expect(constants['minerals.chalcocite_to_bornite_floatability_ratio'].value).toBe(1.5);
    expect(SOURCE_TEXT.authored.en).toMatch(/bornite floats at 0\.8 of chalcopyrite's floatability and chalcocite at 1\.5 times bornite's/);
    expect(SOURCE_TEXT.authored.es).toMatch(/la bornita flota a 0,8 de la flotabilidad de la calcopirita y la calcosina a 1,5 veces la de la bornita/);
    expect(SOURCE_TEXT.allocation.en).toMatch(/an assumption/);
    expect(SOURCE_TEXT.assumption.en).toMatch(/the assays do not identify it/);
    expect(SOURCE_TEXT.comparison.en).toMatch(/a comparison, not a calibration/);
  });

  it('the rail fixes the datum and says why (RS-08)', () => {
    expect(Object.keys(SAMPLE_FIXED).sort()).toEqual(['head_grade', 'work_index_kwh_t']);
    expect(SAMPLE_FIXED.work_index_kwh_t.en).toMatch(/nearest comminution sample in its hole, or the deposit median/);
  });

  it('an iron-plant hour is shown, never simulated (RS-07)', () => {
    expect(SOURCE_TEXT.notEngine.en).toMatch(/reverse cationic flotation is not an engine family/);
    expect(SOURCE_TEXT.notEngine.es).toMatch(/flotación catiónica inversa no es una familia del motor/);
    // since U-15 the hour opens only its Case view, which carries the statement itself
    expect(SOURCE_TEXT.caseNotEngine.en).toMatch(/reverse cationic flotation is not an engine family/);
    expect(SOURCE_TEXT.caseNotEngine.es).toMatch(/flotación catiónica inversa no es una familia del motor/);
    const lane = JSON.parse(readFileSync(join(derived, 'source', 'iron_plant_soft_sensor.json'), 'utf-8')) as { folds: Array<{ trace: Array<{ sensors: Record<string, number>; lab_pct: Record<string, number> }> }> };
    for (const fold of lane.folds) for (const hour of fold.trace) {
      expect(Object.keys(hour.sensors)).toHaveLength(21);
      expect(Object.keys(hour.lab_pct).sort()).toEqual(['iron', 'silica']);
    }
  });
});

// T-10, S-01 to S-09, S-15 (review of 2026-10-02): the Benchmark's topic on the samples in the engine quotes the
// record's sensitivity block; every number it prints is held here
describe('the Benchmark states the real-sample comparison as the record holds it', () => {
  it('the level, the curve against the grind, the residence share, the ordering and the authored choices', async () => {
    const { MEASURED_LANES } = await import('../content/lanes');
    const r = JSON.parse(readFileSync(join(derived, 'real_samples.json'), 'utf-8'));
    const se = r.sensitivity, s = r.summary;
    const text = MEASURED_LANES.SAMPLES.paragraphs.map(p => p.en).join(' ');
    const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
    const curve = Object.fromEntries(se.gap_by_assumed_p80.map((x: any) => [x.p80_um, x]));
    expect(text).toContain(`The samples are ${Math.floor(s.work_index_kwh_t.min)} to ${Math.round(s.work_index_kwh_t.max)} kWh/t`);
    expect(text).toContain(`the engine is ${(-s.engine_minus_measured_pp.mean).toFixed(1)} points below the locked-cycle tests on average (RMSE ${s.engine_minus_measured_pp.rmse.toFixed(1)})`);
    expect(text).toContain(`in the hard porphyry's circuit it is ${(-se.hosts.hard_nominal.mean_gap_pp).toFixed(1)} points below`);
    expect(text).toContain(`from ${curve[75].mean_gap_pp.toFixed(1)} points above at 75 µm to ${(-curve[300].mean_gap_pp).toFixed(1)} below at 300 µm, crossing zero near 150 µm`);
    // the sign changes between 150 and 160 µm, nearer 150 (linear interpolation within 5 µm of it)
    expect(curve[150].mean_gap_pp > 0 && curve[160].mean_gap_pp < 0).toBe(true);
    expect(150 + 10 * curve[150].mean_gap_pp / (curve[150].mean_gap_pp - curve[160].mean_gap_pp)).toBeLessThan(155);
    expect(text).toContain(`the gap is ${signed(se.target_grind_throughput.mean_gap_pp)} points, of which ${se.target_grind_throughput.residence_share_pp.toFixed(1)} come from the longer flotation residence`);
    const rs = se.gap_by_assumed_p80.map((x: any) => x.pearson), sd = se.gap_by_assumed_p80.map((x: any) => x.engine_sd_pp);
    expect(text).toContain(`(Pearson r between ${Math.min(...rs).toFixed(2)} and ${Math.max(...rs).toFixed(2)})`);
    expect(text).toContain(`by ${Math.min(...sd).toFixed(1)} to ${Math.max(...sd).toFixed(1)} points against the tests' ${se.measured_population_sd_pp.toFixed(1)}`);
    const base = se.hosts.soft_720_sized_150.mean_gap_pp, grid = se.ratio_grid.map((x: any) => x.sized_150.mean_gap_pp - base);
    expect(text).toContain(`the alternative allocation moves the level by ${signed(se.allocation_alternative.sized_150.mean_gap_pp - base)} points, dropping the magnetite by ${signed(se.no_magnetite.sized_150.mean_gap_pp - base)}`);
    expect(text).toContain(`by ${Math.min(...grid).toFixed(1)} to ${signed(Math.max(...grid))}`);
    const b720 = se.hosts.soft_720_record.mean_gap_pp;
    expect(text).toContain(`by ${se.work_index.shift_kwh_t} kWh/t moves the 720 t/h gap by ${signed(se.work_index.all_minus_shift.mean_gap_pp - b720)} and ${(se.work_index.all_plus_shift.mean_gap_pp - b720).toFixed(1)} points`);
  });
});
