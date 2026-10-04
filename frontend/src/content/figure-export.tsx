/**
 * The Methodology page's figures as standalone SVG files for the documentation wiki (review of 0.07.000, W-29,
 * ADR-0056). Each file is the figure the page draws, rendered in English, with the shell's diagram rules and the
 * product's overrides inlined. Every colour keeps its shell token with a CSS system colour as the fallback, so a
 * file opened on its own, or shown as an image on GitHub, follows the reader's light or dark scheme instead of
 * rendering black; the same pattern as the architecture modal's diagrams.
 *
 * `frontend/export-figures.mjs` writes the files to `docs/svg/`; `src/test/doc-figures.test.ts` renders them again
 * and fails if a committed file differs, so a figure changed in the app cannot leave the wiki's copy behind.
 */
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COMMINUTION } from './methodology/comminution';
import { MEASURED } from './methodology/measured';
import { METHODS } from './methodology/methods';
import { SEPARATION } from './methodology/separation';
import { STREAMS } from './methodology/streams';
import type { Topic } from './doc';

/** Each Methodology topic with a figure, and the wiki page that embeds it. */
export const FIGURE_PAGES: Record<string, string> = {
  grid: '01_grid-streams-ore',
  crushing: '02_crushing',
  grinding: '03_grinding-circuit',
  classification: '04_classification',
  flotation: '05_flotation',
  gravity: '06_gravity-gold',
  magnetic: '07_magnetic-separation',
  desliming: '08_desliming',
  energy: '09_energy',
  audit: '10_conservation-audit',
  kinetics: '11_kinetic-fits',
  optimization: '12_optimization',
  uncertainty: '13_uncertainty-sensitivity',
  learned: '14_learned-lane',
  'real-samples': '15_real-samples',
  'soft-sensor': '16_industrial-soft-sensor',
};

export const FIGURE_TOPICS: Topic[] = [...STREAMS, ...COMMINUTION, ...SEPARATION, ...METHODS, ...MEASURED].filter(t => t.figure);

/** The system colour each shell token falls back to outside the page (CSS Color 4, section 6.2). */
const SYSTEM: Record<string, string> = {
  'color-fg': 'CanvasText',
  'color-fg-subtle': 'GrayText',
  'color-fg-faint': 'GrayText',
  'color-border': 'GrayText',
  'color-surface': 'Canvas',
  'color-surface-2': 'Canvas',
  'color-bg': 'Canvas',
  'color-accent': 'LinkText',
  'color-accent-soft': 'Canvas',
  'color-good': 'LinkText',
  'color-warn': 'GrayText',
  'color-bad': 'VisitedText',
  'color-magenta': 'VisitedText',
  'font-sans': 'system-ui, sans-serif',
  'font-mono': 'ui-monospace, monospace',
};

/** The top-level rules of a stylesheet whose selector names a diagram class; at-rule blocks are skipped. */
function diagramRules(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: string[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const selector = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1).trim();
    if (!selector.startsWith('@') && /\.(?:of-)?dg-/.test(selector)) rules.push(`${selector.replace(/\s+/g, ' ')} { ${body.replace(/\s+/g, ' ')} }`);
    i = j;
  }
  return rules;
}

/** Every `var(--token)` given its system fallback; a token without one is an error, never a silent black. */
function withFallbacks(rule: string): string {
  return rule.replace(/var\(--([\w-]+)\)/g, (_, token: string) => {
    const fallback = SYSTEM[token];
    if (!fallback) throw new Error(`no system fallback for --${token} in ${rule}`);
    return `var(--${token}, ${fallback})`;
  });
}

/** The inlined stylesheet: the shell's diagram rules first, then the product's overrides, as the page cascades them. */
export function standaloneStyle(shellCss: string, productCss: string): string {
  const rules = [...diagramRules(shellCss), ...diagramRules(productCss)].map(withFallbacks);
  return ['.fig-svg { color-scheme: light dark; }', ...rules].join('\n');
}

/** One figure as a standalone SVG document. */
export function standaloneSvg(element: ReactNode, style: string): string {
  const markup = renderToStaticMarkup(element);
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup);
  if (!markup.startsWith('<svg ') || !box) throw new Error('a figure must be one <svg> with a viewBox at the origin');
  const head = markup.indexOf('>') + 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box[1]}" height="${box[2]}" ${markup.slice(5, head)}`
    + `<style>\n${style}\n</style>${markup.slice(head)}\n`;
}

/** Every figure file, by its wiki file name. */
export function figureFiles(shellCss: string, productCss: string): Record<string, string> {
  const style = standaloneStyle(shellCss, productCss);
  const files: Record<string, string> = {};
  for (const topic of FIGURE_TOPICS) {
    const page = FIGURE_PAGES[topic.id];
    if (!page) throw new Error(`the figure of topic ${topic.id} has no wiki page`);
    files[`${page.slice(0, 2)}-${topic.id}.svg`] = standaloneSvg(topic.figure!.render('en'), style);
  }
  return files;
}
