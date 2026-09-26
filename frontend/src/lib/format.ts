/**
 * Every number the interface shows goes through here (PE-35). Numbers are formatted with
 * Intl.NumberFormat in the interface language: a decimal point and comma grouping in English, a decimal
 * comma and point grouping in Spanish (es-CL). Precision is chosen per unit, so a grade, a size and a
 * tonnage each read at the resolution that means something for it.
 */
export type Lang = 'en' | 'es';

const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-CL' };
const MISSING = '-';
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(lang: Lang, minimum: number, maximum: number, grouping = true): Intl.NumberFormat {
  const key = `${lang}|${minimum}|${maximum}|${grouping}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: minimum, maximumFractionDigits: maximum, useGrouping: grouping });
    formatters.set(key, f);
  }
  return f;
}

const usable = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

/** A number with exactly `decimals` digits after the separator; a value that rounds to zero prints as 0, never -0. */
export function formatFixed(value: number | null | undefined, lang: Lang, decimals: number): string {
  if (!usable(value)) return MISSING;
  const text = formatter(lang, decimals, decimals).format(value);
  return /^-[0.,]*$/.test(text) ? text.slice(1) : text;
}

/**
 * An axis tick in the interface language: as many decimals as the tick spacing needs (a spacing of
 * 0.05 shows two), and on a logarithmic axis the value itself at up to three significant digits.
 */
export function formatTick(value: number, spacing: number, lang: Lang, log = false): string {
  if (!Number.isFinite(value)) return '';
  if (log) return formatSignificant(value, lang, 3);
  // the decimals that write the spacing exactly: 2.5 needs one, 0.05 two, 50 none
  let decimals = 0;
  while (decimals < 8 && spacing > 0 && Math.abs(spacing * 10 ** decimals - Math.round(spacing * 10 ** decimals)) > 1e-6) decimals += 1;
  return formatFixed(value, lang, decimals);
}

/** A number with `significant` significant digits, without trailing zeros. */
export function formatSignificant(value: number | null | undefined, lang: Lang, significant = 3): string {
  if (!usable(value)) return MISSING;
  if (value === 0) return formatter(lang, 0, 0).format(0);
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.max(0, Math.min(12, significant - 1 - magnitude));
  const text = formatter(lang, 0, decimals).format(value);
  return /^-[0.,]*$/.test(text) ? text.slice(1) : text;
}

/** Decimals that give a readable resolution for each engine unit. */
const DECIMALS: Record<string, (value: number) => number> = {
  '%': v => (Math.abs(v) >= 10 ? 1 : 2),
  't/h': v => (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 1 : 4),
  um: v => (Math.abs(v) >= 100 ? 0 : 1),
  mm: () => 1,
  'kWh/t': () => 2,
  kW: () => 0,
  kPa: () => 0,
  'g/t': v => (Math.abs(v) >= 10 ? 1 : 2),
  'm3/t': () => 2,
  'm3/h': () => 0,
  'cm/s': () => 2,
  min: () => 1,
  '1/s': () => 1,
  '1/min': () => 3,
  flag: () => 0,
};

/** A value in an engine unit, at the precision of that unit (dimensionless values: three significant digits). */
export function formatValue(value: number | null | undefined, unit: string, lang: Lang): string {
  if (!usable(value)) return MISSING;
  const decimals = DECIMALS[unit];
  return decimals ? formatFixed(value, lang, decimals(value)) : formatSignificant(value, lang, 3);
}

/** Engine unit names in ASCII (as the Python engine writes them) to their typeset form. */
const UNIT_LABEL: Record<string, string> = {
  um: 'µm', 'm3/t': 'm³/t', 'm3/h': 'm³/h', 't/m3': 't/m³', '1/s': 's⁻¹', '1/min': 'min⁻¹', '1': '', flag: '',
};

export function unitLabel(unit: string): string {
  return unit in UNIT_LABEL ? UNIT_LABEL[unit] : unit;
}

/** Value and unit together, with a thin no-break space between them where a unit is shown. */
export function formatWithUnit(value: number | null | undefined, unit: string, lang: Lang): string {
  const label = unitLabel(unit);
  const text = formatValue(value, unit, lang);
  if (!label || text === MISSING) return text;
  return label === '%' ? `${text}%` : `${text} ${label}`;
}

/** A fraction shown as a percentage (0.25 as 25%). */
export function formatFraction(value: number | null | undefined, lang: Lang, decimals = 1): string {
  return usable(value) ? `${formatFixed(100.0 * value, lang, decimals)}%` : MISSING;
}
