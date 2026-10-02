import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { localizeTex } from '../lib/format';
import { inlineFormulas } from '../lib/math';

// U-32 (review of 2026-10-02): a symbol in prose is typeset, never raw ("water bypass R_f", "tau_bank", "h_max" in an
// axis title), and every inline formula the prose carries renders in both languages
const src = fileURLToPath(new URL('../', import.meta.url));
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? (name === 'test' ? [] : walk(path)) : /\.tsx?$/.test(name) ? [path] : [];
});
// a symbol with a subscript: one or two letters, or a Greek letter or its name, then an underscore
const RAW = /(?<![\w$\\{])(?:[A-Za-z]{1,2}|tau|xi|delta|rho|sigma|alpha|beta|[ρπσαβτξδ])_(?:\{[^}]+\}|[A-Za-z0-9]{1,8})(?![\w(])/;
const LITERAL = /'((?:\\.|[^'\\\n])*)'/g;
const PROSE_KEY = /\b(?:en|es|caption|label|title)\s*:\s*'((?:\\.|[^'\\\n])*)'/g;
const TEMPLATE = /`(?:\\.|[^`\\])*`/gs;

type Hit = { where: string; text: string };
const prose: Hit[] = [];
const svg: Hit[] = [];
for (const file of walk(src)) {
  const where = relative(src, file).replace(/\\/g, '/');
  const content = where.startsWith('content/');
  // TeX lives in template literals; their contents are formulas, not prose
  const lines = readFileSync(file, 'utf-8').replace(TEMPLATE, m => m.replace(/[^\n]/g, ' ')).split('\n');
  lines.forEach((line, n) => {
    if (/<text\b|<tspan\b/.test(line)) {
      svg.push({ where: `${where}:${n + 1}`, text: line.replace(/<[^>]*>/g, ' ') });
      return;
    }
    // the content pages: every prose literal (a paragraph, a caption, a parameter cell); the app: its en/es strings
    for (const m of line.matchAll(content ? LITERAL : PROSE_KEY)) {
      if (/[\s,]/.test(m[1])) prose.push({ where: `${where}:${n + 1}`, text: m[1].replace(/\\(.)/g, '$1') });
    }
  });
}
const outsideFormulas = (text: string) => text.replace(/\$[^$]+\$/g, ' ');

describe('symbols in prose are typeset', () => {
  it('collects the prose of the content pages and the app', () => {
    expect(prose.length).toBeGreaterThan(1000);
    expect(prose.filter(h => inlineFormulas(h.text).length > 0).length).toBeGreaterThan(40);
  });

  it('no prose string carries a raw symbol outside an inline formula', () => {
    const raw = prose.filter(h => RAW.test(outsideFormulas(h.text))).map(h => `${h.where}: ${outsideFormulas(h.text).match(RAW)![0]}`);
    expect(raw).toEqual([]);
  });

  it('no SVG label carries a raw symbol (they use SvgSub)', () => {
    const raw = svg.filter(h => RAW.test(h.text.replace(/SvgSub[^/]*\//g, ' '))).map(h => h.where);
    expect(raw).toEqual([]);
  });

  it('every inline formula renders in English and in Spanish', () => {
    const broken: string[] = [];
    for (const h of prose) {
      for (const tex of inlineFormulas(h.text)) {
        for (const t of [tex, localizeTex(tex, 'es')]) {
          try { katex.renderToString(t, { throwOnError: true }); } catch (e) { broken.push(`${h.where}: ${t}: ${(e as Error).message}`); }
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
