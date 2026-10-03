import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIGURE_PAGES, FIGURE_TOPICS, figureFiles } from '../content/figure-export';

// W-29 (review of 0.07.000): the wiki's methodology pages carried no figure while the app drew one per topic. The
// app's figures are exported to docs/svg/ by export-figures.mjs; this renders them again and holds the committed
// files, and each page's embed, to them.
const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const read = (p: string) => readFileSync(path(p), 'utf-8');
const files = figureFiles(read('../../node_modules/@fasl-work/caos-app-shell/styles.css'), read('../content/content.css'));
const committed = readdirSync(path('../../../docs/svg/')).filter(n => n.endsWith('.svg')).sort();

describe('the wiki figures are the app figures', () => {
  it('every Methodology figure has a wiki page and a committed file, and no file is left over', () => {
    expect(FIGURE_TOPICS.map(t => t.id).sort()).toEqual(Object.keys(FIGURE_PAGES).sort());
    expect(committed).toEqual(Object.keys(files).sort());
  });

  it.each(Object.keys(files))('%s is the figure the page draws', name => {
    expect(read(`../../../docs/svg/${name}`)).toBe(files[name]);
  });

  it('every colour keeps its token with a system fallback, so a file shown on its own follows the scheme', () => {
    for (const [name, text] of Object.entries(files)) {
      expect(text.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), name).toBe(true);
      expect(text, name).not.toMatch(/var\(--[\w-]+\)/);
      expect(text, name).not.toMatch(/(?:fill|stroke)="#/);
    }
  });

  it('each methodology page embeds its figure', () => {
    for (const [topic, page] of Object.entries(FIGURE_PAGES)) {
      const doc = read(`../../../docs/methodologies/${page}.md`);
      expect(doc, page).toContain(`](../svg/${page.slice(0, 2)}-${topic}.svg)`);
    }
  });
});
