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
  while (decimals < 8 && spacing > 0 && Math.abs(spacing * 10 ** decimals - Math.round(spacing * 10 ** decimals)) > 1e-6) decimals += 1; // not-engine: the decimals a tick label needs
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

// the decimals that give a value below one three significant digits: 0.1953 reads 0.195, 0.0123 reads 0.0123
const belowOne = (v: number) => (v === 0 ? 1 : Math.max(1, Math.min(6, 2 - Math.floor(Math.log10(Math.abs(v))))));

/** Decimals that give a readable resolution for each engine unit. */
const DECIMALS: Record<string, (value: number) => number> = {
  '%': v => (Math.abs(v) >= 10 ? 1 : 2),
  // U-30: a stream below 1 t/h at three significant digits ("0.195 t/h"), not four decimals beside "5.0"
  't/h': v => (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 1 : belowOne(v)),
  'kg/h': v => (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 1 ? 2 : 3),
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

/**
 * The decimals a set of values that are read together prints at (a table column, a row of base, optimum and bounds,
 * a range, a colour scale): the unit's rule at the set's largest magnitude, so 75 and 300 µm read "75 - 300", not
 * "75.0 - 300", and a scale reads "15.1 ... 97.0", not "15.1 ... 97" (U-30). A unit without a rule takes three
 * significant digits of the largest magnitude.
 */
export function sharedDecimals(values: Array<number | null | undefined>, unit: string): number {
  const finite = values.filter(usable);
  if (!finite.length) return 0;
  const largest = Math.max(...finite.map(v => Math.abs(v)));
  const rule = DECIMALS[unit];
  if (rule) return rule(largest);
  return largest === 0 ? 0 : Math.max(0, Math.min(12, 2 - Math.floor(Math.log10(largest))));
}

/** The decimal place of an interval's half-width rounded to one significant digit (0.0096 is 0.01: two places). */
export function intervalDecimals(halfWidth: number | null | undefined): number {
  if (!usable(halfWidth) || halfWidth === 0) return 2;
  const rounded = Number(Math.abs(halfWidth).toPrecision(1));
  return Math.max(0, Math.min(12, -Math.floor(Math.log10(rounded))));
}

/** An estimate with its half-width, both to the half-width's decimal place: "0.00 ± 0.01", never "0.0022 ± 0.01" (U-30). */
export function formatEstimate(value: number | null | undefined, halfWidth: number | null | undefined, lang: Lang): string {
  if (!usable(value)) return MISSING;
  if (!usable(halfWidth)) return formatSignificant(value, lang, 2);
  const d = intervalDecimals(halfWidth);
  return `${formatFixed(value, lang, d)}\u00a0±\u00a0${formatFixed(Math.abs(halfWidth), lang, d)}`;
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

/** A range at one precision, with the unit once after its upper end (pass `withUnit` false where a header names it). */
export function formatRange(low: number | null | undefined, high: number | null | undefined, unit: string, lang: Lang, withUnit = true): string {
  const d = sharedDecimals([low, high], unit);
  const text = `${formatFixed(low, lang, d)} – ${formatFixed(high, lang, d)}`;
  const label = unitLabel(unit);
  if (!withUnit || !label || !usable(low) || !usable(high)) return text;
  return label === '%' ? `${text}%` : `${text}\u202f${label}`;
}

/** A check's distance to the nearer bound of its range, in the check's unit, and which bound that is (E-12). */
export function kpiMargin(value: number, range: readonly number[]): { margin: number; floor: boolean } {
  const above = value - range[0], below = range[1] - value; // not-engine: a display distance of a baked value to its range
  return above <= below ? { margin: above, floor: true } : { margin: below, floor: false };
}

/** A fraction shown as a percentage (0.25 as 25%). */
export function formatFraction(value: number | null | undefined, lang: Lang, decimals = 1): string {
  return usable(value) ? `${formatFixed(100.0 * value, lang, decimals)}%` : MISSING;
}

// a number that stands alone: not joined to a letter, a dot or a slash (an identifier, a version, a DOI)
const AUTHORED_NUMBER = /(?<![\w./])([-+]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(e[-+]?\d+)?(?![\w./]|,\d)/gi;

/**
 * An authored value written in the English convention (a parameter cell such as '0.4, 0.65, 4.02' or
 * '1.8e-4 - 3.2e-4'), in the interface language. In Spanish a decimal point becomes the decimal comma
 * and English grouping becomes point grouping; where a decimal comma appeared, the commas that list
 * values become semicolons, so '0.4, 0.65' reads '0,4; 0,65' and not as four numbers.
 */
export function localizeAuthored(text: string, lang: Lang): string {
  if (lang === 'en') return text;
  let decimals = false;
  const out = text.replace(AUTHORED_NUMBER, (match: string, sign: string, whole: string, fraction?: string, exponent?: string) => {
    if (fraction === undefined && !whole.includes(',')) return match;
    if (fraction !== undefined) decimals = true;
    return `${sign}${whole.replace(/,/g, '.')}${fraction !== undefined ? `,${fraction}` : ''}${exponent ?? ''}`;
  });
  return decimals ? out.replace(/,(?=\s)/g, ';') : out;
}

/** A TeX formula in the interface language: in Spanish the decimal comma, braced so KaTeX sets it inside
 * the number instead of as punctuation followed by a space. */
export function localizeTex(tex: string, lang: Lang): string {
  return lang === 'en' ? tex : tex.replace(/(\d)\.(?=\d)/g, '$1{,}');
}
