import { describe, expect, it, vi } from 'vitest';

// PE-35 for formulas: a formula written once is shown in both languages, so it may not carry a word; a
// formula with words carries its TeX in both languages, and the two must differ. The content modules are
// data (topics, formulas), inspected as built.
vi.mock('uplot', () => ({ default: class {} }));
vi.mock('uplot/dist/uPlot.min.css', () => ({}));
type Bi = { en: string; es: string };
type Topic = { id: string; equations?: Array<{ tex: string | Bi }> };
type Group = { topics: Topic[] };

const { INTRODUCTION } = await import('../content/introduction');
const { IMPLEMENTATION } = await import('../content/implementation');
const { EXPERIMENTS } = await import('../content/experiments');
const { ENGINE_BENCHMARK } = await import('../content/benchmark');
const { MEASURED_LANES } = await import('../content/lanes');
const { STREAMS } = await import('../content/methodology/streams');
const { COMMINUTION } = await import('../content/methodology/comminution');
const { SEPARATION } = await import('../content/methodology/separation');
const { METHODS } = await import('../content/methodology/methods');
const { CIRCUIT, FLOTATION, GRAVITY, MAGNETIC, DESLIME } = await import('../content/equations');

const topics: Topic[] = [
  ...[INTRODUCTION, IMPLEMENTATION, EXPERIMENTS].flatMap(groups => (groups as Group[]).flatMap(g => g.topics)),
  ...Object.values(ENGINE_BENCHMARK as Record<string, Topic>), ...Object.values(MEASURED_LANES as Record<string, Topic>),
  ...(STREAMS as Topic[]), ...(COMMINUTION as Topic[]), ...(SEPARATION as Topic[]), ...(METHODS as Topic[]),
];
const formulas: Array<{ where: string; tex: string | Bi }> = [
  ...topics.flatMap(t => (t.equations ?? []).map(e => ({ where: t.id, tex: e.tex }))),
  ...[CIRCUIT, FLOTATION, GRAVITY, MAGNETIC, DESLIME].flat().map(f => ({ where: 'case view', tex: (f as { tex: string }).tex })),
];

// what reads the same in both languages: units, the RMSE acronym (kept in Spanish technical writing) and
// operator names that are notation, not words
const NEUTRAL = new Set(['RMSE', 'diag', 'kPa', 't/h', 'kWh', 'kW', 'MW', 'ppm', 'g/t']);
const WORDS = /\\(?:text|mathrm|operatorname|textrm|textit|mathit)\{([^}]*)\}/g;

describe('formulas in two languages', () => {
  it('reads every topic and formula of the pages and the Case view', () => {
    expect(topics.length).toBeGreaterThan(30);
    expect(formulas.length).toBeGreaterThan(60);
  });

  it('a formula written once carries no word', () => {
    const offenders: string[] = [];
    for (const { where, tex } of formulas) {
      if (typeof tex !== 'string') continue;
      for (const match of tex.matchAll(WORDS)) {
        const word = match[1].trim();
        if (/[A-Za-z]{2,}/.test(word) && !NEUTRAL.has(word)) offenders.push(`${where}: ${word}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('a formula written twice differs between the languages', () => {
    const same = formulas.filter(f => typeof f.tex !== 'string' && f.tex.en === f.tex.es).map(f => f.where);
    expect(same).toEqual([]);
  });
});
