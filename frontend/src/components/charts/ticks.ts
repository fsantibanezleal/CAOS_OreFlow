/**
 * Category labels on a chart's x axis, wrapped to the width each category has. uPlot draws tick labels on
 * the canvas, where no page check can see them: in Spanish at 1280x800 the four Sobol factor names ran
 * into each other ("...de trabajoFactor de la ley de cabeza..."). A label wraps at its spaces, and the
 * count of labels that still do not fit (a word wider than the slot, or more lines than the axis holds) is
 * what the chart declares for the browser gate.
 */

/** Greedy word wrap into lines no wider than `max`, measured by `width`; a word wider than `max` keeps a
 * line of its own. */
export function wrapLabel(text: string, max: number, width: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > max) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Each label wrapped to its slot (lines joined by a newline, which uPlot draws as lines), and how many
 * labels still do not fit. */
export function categoryTicks(labels: readonly string[], slot: number, width: (s: string) => number, maxLines = 3): { values: string[]; cut: number } {
  let cut = 0;
  const values = labels.map(label => {
    const lines = wrapLabel(label, slot, width);
    if (lines.length > maxLines || lines.some(l => width(l) > slot)) cut += 1;
    return lines.join('\n');
  });
  return { values, cut };
}

/** Lines in the tallest wrapped label, at least one. */
export const tickLines = (values: readonly unknown[] | null | undefined) => Math.max(1, ...(values ?? []).map(v => String(v ?? '').split('\n').length));
