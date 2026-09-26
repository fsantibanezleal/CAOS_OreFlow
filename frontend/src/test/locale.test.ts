import { describe, expect, it } from 'vitest';
import { formatFixed, formatFraction, formatSignificant, formatValue, formatWithUnit, unitLabel } from '../lib/format';

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
});
