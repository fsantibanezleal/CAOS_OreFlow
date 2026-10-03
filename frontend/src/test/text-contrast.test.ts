import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// D-29 (review of 0.07.000): small text that carries content (figure notes and ticks, table captions, footnotes,
// hints) was drawn in the shell's --color-fg-faint, 4.27:1 on the light page and 3.80:1 on the dark surface, below
// WCAG AA (4.5:1) for text under 18 px. It now takes --color-fg-subtle. This reads the shell's own tokens, so a
// shell release that lightens the subtle colour fails here, and it fails if a product rule goes back to faint text.
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf-8');
const shell = read('../../node_modules/@fasl-work/caos-app-shell/styles.css');

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Each theme's value of a token, in the order the shell declares them (dark first, then light). */
const token = (name: string) => [...shell.matchAll(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map(m => m[1]);

describe('content-bearing small text meets WCAG AA', () => {
  it('the subtle text colour is at least 4.5:1 on the page and both surfaces, in both themes', () => {
    const subtle = token('fg-subtle');
    expect(subtle).toHaveLength(2);
    for (const background of ['bg', 'surface', 'surface-2']) {
      const values = token(background);
      expect(values, background).toHaveLength(2);
      for (const theme of [0, 1]) expect(contrast(subtle[theme], values[theme]), `${background} theme ${theme}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the faint colour, which fails AA, is the reason: under 4.5:1 somewhere', () => {
    const faint = token('fg-faint');
    const worst = Math.min(...['bg', 'surface', 'surface-2'].flatMap(b => [0, 1].map(theme => contrast(faint[theme], token(b)[theme]))));
    expect(worst).toBeLessThan(4.5);
  });

  it('figure notes and ticks take the subtle colour, and no product text rule uses the faint one', () => {
    const content = read('../content/content.css');
    expect(content).toMatch(/\.fig-svg \.dg-note, \.fig-svg \.dg-tick \{ fill: var\(--color-fg-subtle\); \}/);
    // an inactive control's label is exempt (WCAG 1.4.3): the rail's following and fixed knobs keep the faint colour
    const faintText = [content, read('../workbench/workbench.css')].flatMap(css => css.split('\n'))
      .filter(line => /(?:^|[\s;{])(?:color|fill):\s*var\(--color-fg-faint\)/.test(line))
      .filter(line => !/^\.of-knob\.(follows|fixed) /.test(line));
    expect(faintText).toEqual([]);
  });
});
