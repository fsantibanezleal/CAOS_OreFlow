import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import contractDoc from '../../../data/derived/contract/operating_contract.json';
import type { OperatingContract } from '../engine/contract';
import type { Ore } from '../engine/model';
import type { Trace } from '../engine/trace';

// U-10 (review of 2026-10-02): two series of one chart drawn in the same style must be told apart by colour. "Mill
// discharge" (accent-2) and "Cyclone overflow" (accent) were 0.098 apart in OKLab in the dark theme, and a reader took
// the teal curve for the overflow. Each theme's tokens are read from the shell's own stylesheet.
vi.mock('uplot', () => ({ default: class {} }));
vi.mock('uplot/dist/uPlot.min.css', () => ({}));
const { TOKEN } = await import('../components/charts/Chart');
const { grindingCharts } = await import('../workbench/views/GrindingView');
const { separationCharts } = await import('../workbench/views/SeparationView');

const MINIMUM = 0.12;
const css = readFileSync(fileURLToPath(new URL('../../node_modules/@fasl-work/caos-app-shell/styles.css', import.meta.url)), 'utf-8');
const themes: Record<string, Record<string, string>> = {};
for (const m of css.matchAll(/(:root[^{]*|\[data-theme="(?:dark|light)"\][^{]*)\{([^}]*)\}/g)) {
  const theme = /light/.test(m[1]) ? 'light' : 'dark';
  for (const v of m[2].matchAll(/(--color-[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) (themes[theme] ??= {})[v[1]] = v[2];
}

const linear = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(i => linear(parseInt(hex.slice(i, i + 2), 16)));
  const [l, m, s] = [0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b].map(Math.cbrt);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const distance = (a: string, b: string) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

type Series = { label: string; colour?: string; dash?: number[]; points?: boolean; bars?: boolean };
/** Pairs of series in the same style (line, dashed line, points or bars) closer than the minimum, in either theme. */
function closePairs(series: Series[]): string[] {
  const style = (s: Series) => (s.bars ? 'bars' : s.points ? 'points' : s.dash ? 'dash' : 'line');
  const out: string[] = [];
  for (const [theme, tokens] of Object.entries(themes)) {
    for (let i = 0; i < series.length; i += 1) for (let j = i + 1; j < series.length; j += 1) {
      const a = series[i], b = series[j];
      if (style(a) !== style(b)) continue;
      const d = distance(tokens[TOKEN[(a.colour ?? 'accent') as keyof typeof TOKEN]], tokens[TOKEN[(b.colour ?? 'accent') as keyof typeof TOKEN]]);
      if (d < MINIMUM) out.push(`${theme}: ${a.label} and ${b.label} ${d.toFixed(3)}`);
    }
  }
  return out;
}

const contract = contractDoc as unknown as OperatingContract;
const root = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
const files = readdirSync(root).filter(f => f.endsWith('.json')).sort();

describe('series of one chart are told apart by colour', () => {
  it('reads both themes from the shell', () => {
    expect(Object.keys(themes).sort()).toEqual(['dark', 'light']);
    expect(themes.dark['--color-accent']).toMatch(/^#/);
  });

  it('fails the pair the review found', () => {
    expect(closePairs([{ label: 'overflow', colour: 'accent' }, { label: 'discharge', colour: 'accent-2' }])).not.toEqual([]);
  });

  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(root, file), 'utf-8')) as { case_id: string; definition: { ore: Ore }; variants: Array<{ trace: Trace }> };
    it(artifact.case_id, () => {
      const trace = artifact.variants[0].trace;
      const charts = { ...grindingCharts(trace, artifact.definition.ore, 'en', () => undefined),
        ...separationCharts(trace, contract.cases[artifact.case_id].primary, 'en', () => undefined) };
      for (const [id, element] of Object.entries(charts)) {
        const series = (element as ReactElement<{ series?: Series[] }>).props.series ?? [];
        expect(closePairs(series), `${artifact.case_id}:${id}`).toEqual([]);
      }
    });
  }
});
