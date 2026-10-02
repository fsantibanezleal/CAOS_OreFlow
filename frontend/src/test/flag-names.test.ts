import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { flagShort, flagText } from '../lib/i18n';

// U-06 (review of 2026-10-02): every flag either engine can raise has a sentence and a short name in both languages,
// so no raw code (circulating_load_out_of_range) reaches the readout, the Context table or the Variants table
const roots = [fileURLToPath(new URL('../engine/', import.meta.url)), fileURLToPath(new URL('../../../data-pipeline/pipeline/engine/', import.meta.url))];
const codes = new Set<string>();
for (const root of roots) {
  for (const name of readdirSync(root)) {
    if (!/\.(ts|py)$/.test(name)) continue;
    for (const m of readFileSync(join(root, name), 'utf-8').matchAll(/flags\.add\(['"]([a-z_]+)['"]/g)) codes.add(m[1]);
  }
}

describe('every engine flag has a name', () => {
  it('collects the codes from both engines', () => {
    expect(codes.size).toBeGreaterThanOrEqual(10);
    expect(codes.has('circulating_load_out_of_range')).toBe(true);
  });
  it.each([...codes])('%s', code => {
    for (const lang of ['en', 'es'] as const) {
      expect(flagText(code, lang), lang).not.toBe(code);
      expect(flagShort(code, lang), lang).not.toBe(code);
    }
  });
});
