import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A LaTeX command in an ordinary string loses its backslash to a JavaScript escape: '\varphi' is a vertical tab and
// "arphi", '\frac' a form feed, '\rho' a carriage return. 0.09.000 wrote two such captions while fixing F-01 (the
// equations themselves are String.raw and safe); every string the content modules export is checked here.
const roots = [fileURLToPath(new URL('../content/', import.meta.url)), fileURLToPath(new URL('../content/methodology/', import.meta.url))];
const files = roots.flatMap(root => readdirSync(root).filter(n => /\.tsx?$/.test(n) && !n.endsWith('.test.ts')).map(n => join(root, n)));
const CONTROL = /[\u0007\u0008\u000b\u000c\r]/;

function strings(value: unknown, out: string[], seen: Set<unknown>): void {
  if (typeof value === 'string') { out.push(value); return; }
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const v of Object.values(value as Record<string, unknown>)) strings(v, out, seen);
}

describe('content strings carry no control characters', () => {
  it.each(files)('%s', async file => {
    const module = await import(/* @vite-ignore */ file);
    const found: string[] = [];
    strings(module, found, new Set());
    const bad = found.filter(s => CONTROL.test(s)).map(s => s.slice(0, 80));
    expect(bad).toEqual([]);
  });
});
