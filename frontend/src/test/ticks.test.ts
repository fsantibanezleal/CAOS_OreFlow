import { describe, expect, it } from 'vitest';
import { categoryTicks, tickLines, wrapLabel } from '../components/charts/ticks';

// a fixed-pitch stand-in for the canvas: 6 px a character
const width = (s: string) => 6 * s.length;
const SOBOL_ES = ['Factor del índice de trabajo', 'Factor de la ley de cabeza', 'Factor del tamaño de liberación', 'Factor de flotabilidad'];

describe('category tick labels', () => {
  it('wrap at spaces into lines no wider than the slot', () => {
    expect(wrapLabel('Factor del índice de trabajo', 100, width)).toEqual(['Factor del', 'índice de', 'trabajo']);
    expect(wrapLabel('Flotabilidad', 100, width)).toEqual(['Flotabilidad']);
    for (const line of wrapLabel('Factor del tamaño de liberación', 100, width)) expect(width(line)).toBeLessThanOrEqual(100);
  });

  it('keep a word wider than the slot on a line of its own, and count it as cut', () => {
    expect(wrapLabel('Desliming partition', 40, width)).toEqual(['Desliming', 'partition']);
    expect(categoryTicks(['Desliming partition'], 40, width).cut).toBe(1);
  });

  it('count a label that needs more lines than the axis holds', () => {
    expect(categoryTicks(['a b c d'], 6, width, 3).cut).toBe(1);
    expect(categoryTicks(['a b c'], 6, width, 3).cut).toBe(0);
  });

  it('fit the Spanish Sobol factors in the slot a 1280 px chart gives them, and not unwrapped', () => {
    // the Methods chart at 1280x800 is about 520 px of plot: 130 px a factor, less a margin
    const { values, cut } = categoryTicks(SOBOL_ES, 124, width);
    expect(cut).toBe(0);
    expect(tickLines(values)).toBeLessThanOrEqual(3);
    // unwrapped, each of the four names is wider than its slot
    expect(SOBOL_ES.filter(label => width(label) > 124).length).toBe(4);
  });

  it('keep a short label as it is', () => {
    expect(categoryTicks(['1', '2', '3'], 60, width)).toEqual({ values: ['1', '2', '3'], cut: 0 });
    expect(tickLines(['1', '2'])).toBe(1);
    expect(tickLines(null)).toBe(1);
  });
});
