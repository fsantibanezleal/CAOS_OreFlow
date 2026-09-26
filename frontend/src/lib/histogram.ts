/**
 * Equal-width bins over the sampled range, for the Uncertainty histogram: a count, not a model. Every
 * value lands in a bin (the largest in the last one), and the bin centres are the bar positions.
 */
export function histogram(values: readonly number[], bins: number): { centres: number[]; counts: number[]; width: number } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const width = hi > lo ? (hi - lo) / bins : 1.0;
  const n = hi > lo ? bins : 1;
  const counts = new Array<number>(n).fill(0);
  for (const v of values) counts[Math.min(n - 1, Math.floor((v - lo) / width))] += 1;
  return { centres: counts.map((_, i) => lo + (i + 0.5) * width), counts, width };
}

/**
 * Half the spacing of equally spaced bar positions. A bar is drawn centred on its x value, so a bar
 * chart's x range reaches this far past its first and last position; ranged on the positions alone, the
 * end bars were cut in half at the plot's edges (the Uncertainty histogram in 0.05.000). 0 for fewer
 * than two bars.
 */
export function halfSpacing(xs: readonly number[]): number {
  return xs.length > 1 ? Math.abs(xs[1] - xs[0]) / 2 : 0;
}
