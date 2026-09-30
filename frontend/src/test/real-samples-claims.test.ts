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
    const lane = JSON.parse(readFileSync(join(derived, 'source', 'iron_plant_soft_sensor.json'), 'utf-8')) as { folds: Array<{ trace: Array<{ sensors: Record<string, number>; lab_pct: Record<string, number> }> }> };
    for (const fold of lane.folds) for (const hour of fold.trace) {
      expect(Object.keys(hour.sensors)).toHaveLength(21);
      expect(Object.keys(hour.lab_pct).sort()).toEqual(['iron', 'silica']);
    }
  });
});
