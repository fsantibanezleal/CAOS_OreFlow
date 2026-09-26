import { describe, expect, it } from 'vitest';
import { formatFixed, formatFraction, formatSignificant, formatValue, formatWithUnit, localizeAuthored, localizeTex, unitLabel } from '../lib/format';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formulaText, metricLabel, provenanceText } from '../lib/i18n';
import { CONTENT_CITATIONS, localizeCitations } from '../content/citations';

// PE-35: every number is formatted with the active locale (the document-language half of PE-35 is
// checked by the browser gate on every route in both languages).
describe('locale formatting', () => {
  it('uses the decimal comma in Spanish and the decimal point in English', () => {
    expect(formatFixed(1234.5, 'en', 1)).toBe('1,234.5');
    expect(formatFixed(1234.5, 'es', 1)).toBe('1.234,5');
    expect(formatFixed(0.74, 'es', 2)).toBe('0,74');
  });

  it('keeps significant digits without trailing zeros', () => {
    expect(formatSignificant(0.000123456, 'en', 3)).toBe('0.000123');
    expect(formatSignificant(2.5, 'es', 3)).toBe('2,5');
    expect(formatSignificant(0, 'en')).toBe('0');
  });

  it('chooses precision by unit and typesets the units', () => {
    expect(formatValue(92.967, '%', 'en')).toBe('93.0');
    expect(formatValue(8.24, '%', 'es')).toBe('8,24');
    expect(formatValue(720, 't/h', 'en')).toBe('720');
    expect(formatValue(169.4, 'um', 'es')).toBe('169');
    expect(formatWithUnit(9.13, 'kWh/t', 'es')).toBe('9,13 kWh/t');
    expect(formatWithUnit(150, 'um', 'en')).toBe('150 µm');
    expect(formatWithUnit(26.2, '%', 'es')).toBe('26,2%');
    expect(unitLabel('m3/t')).toBe('m³/t');
    expect(formatFraction(0.25, 'es')).toBe('25,0%');
  });

  it('never prints NaN or Infinity', () => {
    expect(formatValue(NaN, '%', 'en')).toBe('-');
    expect(formatWithUnit(Infinity, 'kW', 'es')).toBe('-');
    expect(formatFixed(null, 'en', 1)).toBe('-');
  });

  it('writes authored values in the Spanish convention and leaves English as authored', () => {
    expect(localizeAuthored('0.4, 0.65, 4.02', 'es')).toBe('0,4; 0,65; 4,02');
    expect(localizeAuthored('0.4, 0.65, 4.02', 'en')).toBe('0.4, 0.65, 4.02');
    expect(localizeAuthored('0.0091 t/kWh, 0.651, 2.5', 'es')).toBe('0,0091 t/kWh; 0,651; 2,5');
    expect(localizeAuthored('1.8e-4 - 3.2e-4', 'es')).toBe('1,8e-4 - 3,2e-4');
    expect(localizeAuthored('0.8 + 0.45 J_g mm', 'es')).toBe('0,8 + 0,45 J_g mm');
    expect(localizeAuthored('0.256, 0.335, 0.197, 2.95 Dc', 'es')).toBe('0,256; 0,335; 0,197; 2,95 Dc');
    expect(localizeAuthored('3,150 kW at 450 t/h', 'es')).toBe('3.150 kW at 450 t/h');
    // lists without decimals keep their commas; identifiers, versions and DOIs are not numbers
    expect(localizeAuthored('12 - 60, 40 - 1500 g/t', 'es')).toBe('12 - 60, 40 - 1500 g/t');
    expect(localizeAuthored('β0, β1, β2', 'es')).toBe('β0, β1, β2');
    expect(localizeAuthored('v0.05.000, PE-31, doi:10.1016/j.minpro', 'es')).toBe('v0.05.000, PE-31, doi:10.1016/j.minpro');
  });

  it('sets decimals inside TeX with a braced comma in Spanish', () => {
    expect(localizeTex('m = 0.71 + 1.21\\,x', 'es')).toBe('m = 0{,}71 + 1{,}21\\,x');
    expect(localizeTex('m = 0.71', 'en')).toBe('m = 0.71');
    expect(localizeTex('10^{-9}', 'es')).toBe('10^{-9}');
  });

  it('prints chemical formulas with subscripts and leaves element symbols alone', () => {
    expect(formulaText('P2O5')).toBe('P₂O₅');
    expect(formulaText('SiO2')).toBe('SiO₂');
    expect(formulaText('Ca5(PO4)3F')).toBe('Ca₅(PO₄)₃F');
    expect(formulaText('Cu')).toBe('Cu');
    expect(metricLabel('head_SiO2', 'es')).toBe('SiO₂ en cabeza');
    expect(metricLabel('recovery_P2O5_pct', 'en')).toBe('P₂O₅ recovery');
  });

  it('gives the citations Spanish short labels and keeps every record verbatim', () => {
    expect(localizeCitations(CONTENT_CITATIONS, 'en')).toBe(CONTENT_CITATIONS);
    const es = localizeCitations(CONTENT_CITATIONS, 'es');
    for (const [k, c] of es.entries()) {
      expect(c.label, c.id).not.toMatch(/and|practice|review/i);
      expect({ ...c, label: CONTENT_CITATIONS[k].label }, c.id).toEqual(CONTENT_CITATIONS[k]);
    }
    expect(es.find(c => c.id === 'laplante2005')?.label).toBe('Laplante y Gray 2005');
    const pair = (label: string) => localizeCitations([{ id: 'x', label, citation: '' }], 'es')[0].label;
    expect(pair('Smith and Ibáñez 2020')).toBe('Smith e Ibáñez 2020');
    expect(pair('Smith and Hidalgo 2020')).toBe('Smith e Hidalgo 2020');
    expect(pair('Smith and Hierro 2020')).toBe('Smith y Hierro 2020');
  });

  it('renders the provenance of every case record in Spanish', () => {
    // the Case view printed the catalog's English phrase on the Spanish page
    const root = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
    const values = new Set(readdirSync(root).filter(f => f.endsWith('.json'))
      .map(f => (JSON.parse(readFileSync(join(root, f), 'utf-8')) as { provenance: string }).provenance));
    expect(values.size).toBeGreaterThan(0);
    for (const value of values) {
      expect(provenanceText(value, 'en'), value).toBe(value);
      expect(provenanceText(value, 'es'), value).not.toBe(value);
    }
  });
});
