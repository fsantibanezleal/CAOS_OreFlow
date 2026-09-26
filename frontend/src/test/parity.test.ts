import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine';
import type { OperatingPoint, Ore, Plant } from '../engine';

// PE-31: the browser engine reproduces every baked variant's metrics, streams, curves and kinetic records
// within 1e-6 relative. Audit residuals are round-off magnitudes and are bounded absolutely instead, and
// the engine's iteration counters may differ by a step or two when the last bit of an exp or log differs.
// The kinetic fits' Levenberg-Marquardt step counts are solver diagnostics and are not compared: on a flat
// valley (a two-rate fit whose second component is nearly empty) a last-bit difference flips one step's
// acceptance and the stopping test is met a few steps earlier or later, while the fitted parameters, the
// fit error, the convergence flag and the bank projections still agree within 1e-6.
const root = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
const files = readdirSync(root).filter(f => f.endsWith('.json')).sort();
const RELATIVE = 1e-6;
const ABSOLUTE = 1e-12;
const RESIDUALS = new Set(['balance_max_relative_error', 'species_consistency_error']);

function compare(a: unknown, b: unknown, path: string, out: string[]): void {
  if (out.length > 20) return;
  const key = path.split('.').at(-1) ?? '';
  if (typeof a === 'number' && typeof b === 'number') {
    if (RESIDUALS.has(key)) { if (a > 1e-9) out.push(`${path}: residual ${a}`); return; }
    if (key === 'iterations' && path.startsWith('methods.kinetics.models')) return;
    if (key.endsWith('iterations')) { if (Math.abs(a - b) > 2) out.push(`${path}: ${a} vs ${b}`); return; }
    const scale = Math.max(Math.abs(a), Math.abs(b));
    if (Math.abs(a - b) > Math.max(RELATIVE * scale, ABSOLUTE)) out.push(`${path}: ${a} vs ${b}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${path}: length ${a.length} vs ${b.length}`); return; }
    a.forEach((v, i) => compare(v, b[i], `${path}[${i}]`, out));
    return;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of keys) {
      if (k === 'message') continue;   // flag text formats numbers per language; codes are compared
      compare((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out);
    }
    return;
  }
  if (a !== b) out.push(`${path}: ${String(a)} vs ${String(b)}`);
}

describe('the browser engine reproduces the baked variants', () => {
  expect(files.length).toBe(12);
  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(root, file), 'utf-8')) as {
      case_id: string; definition: { ore: Ore; plant: Plant };
      variants: Array<{ id: string; point: OperatingPoint; trace: Record<string, unknown> }>;
    };
    for (const variant of artifact.variants) {
      it(`${artifact.case_id}:${variant.id}`, () => {
        const mine = evaluate(artifact.definition.ore, artifact.definition.plant, variant.point) as Record<string, unknown>;
        const problems: string[] = [];
        for (const part of ['metrics', 'metric_units', 'topology', 'streams', 'curves', 'methods', 'balance', 'concentrates', 'tails']) {
          compare(mine[part], variant.trace[part], part, problems);
        }
        const codes = (flags: unknown) => (flags as Array<{ code: string }>).map(f => f.code);
        expect(codes(mine.flags)).toEqual(codes(variant.trace.flags));
        expect(problems).toEqual([]);
      });
    }
  }
});
