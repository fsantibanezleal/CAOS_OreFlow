import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// T-46, T-47, T-48 (review of 2026-10-02): the precompute is named in words a reader decodes ("bake" and "horneado"
// were software slang), the Spanish workbench is the "simulador" (the "laboratorio" is where the tests are run), and
// the TypeScript port is a "versión", never a "traducción" on a bilingual site. Code identifiers keep their names; this
// reads the user-facing strings only: en/es values, p() and pick() arguments and the figures' language ternaries.
const src = fileURLToPath(new URL('../', import.meta.url));
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? (name === 'test' ? [] : walk(path)) : /\.tsx?$/.test(name) ? [path] : [];
});
const LIT = String.raw`'((?:\\.|[^'\\\n])*)'`;
const SOURCES = [
  new RegExp(String.raw`\b(?:en|es|body_en|body_es|title_en|title_es)\s*:\s*` + LIT, 'g'),
  new RegExp(String.raw`\b(?:p|pick\(lang,)\s*\(?\s*` + LIT + String.raw`\s*,\s*` + LIT, 'g'),
  new RegExp(String.raw`es\s*\?\s*` + LIT + String.raw`\s*:\s*` + LIT, 'g'),
];
const strings: Array<{ where: string; text: string }> = [];
for (const file of walk(src)) {
  const where = relative(src, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf-8');
  for (const rx of SOURCES) for (const m of content.matchAll(rx)) for (const g of m.slice(1)) if (g) strings.push({ where, text: g });
}

describe('the interface names the precompute, the simulator and the port in plain words', () => {
  it('reads the user-facing strings', () => {
    expect(strings.length).toBeGreaterThan(1500);
  });

  it('no "bake" or "horneado" reaches a reader', () => {
    const hits = strings.filter(s => /\b(bake[sd]?|baking)\b|hornea/i.test(s.text)).map(s => `${s.where}: ${s.text.slice(0, 60)}`);
    expect(hits).toEqual([]);
  });

  it('the Spanish workbench is the "simulador", and the port a "versión"', () => {
    const lab = strings.filter(s => /\b(el|del|al)\s+laboratorio\b(?!\s+(de|del)\b)/i.test(s.text) && !/latencia|informe del laboratorio/.test(s.text)).map(s => `${s.where}: ${s.text.slice(0, 60)}`);
    expect(lab).toEqual([]);
    expect(strings.filter(s => /traducci[oó]n|traducid[oa]/i.test(s.text)).map(s => s.where)).toEqual([]);
    const nav = readFileSync(join(src, 'main.tsx'), 'utf-8');
    expect(nav).toMatch(/en: "Workbench", es: "Simulador"/);
  });
});
