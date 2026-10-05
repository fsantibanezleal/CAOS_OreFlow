/**
 * Independent conservation audit (port of engine/balance.py; docs/methodologies/10_conservation-audit.md):
 * every unit's mineral solids, reported species and water re-summed from the named streams alone, every size class
 * where no breakage acts, and the breakage operators by their own steady-state residual (K-01).
 */
import { matvec, type Mat } from './linalg';
import type { Vec } from './grid';
import type { ResolvedOre } from './ore';
import type { Stream } from './streams';

function relative(inflow: number, outflow: number): number {
  const scale = Math.max(Math.abs(inflow), Math.abs(outflow));
  return scale > 0.0 ? Math.abs(inflow - outflow) / scale : 0.0;
}

export function unitClosure(inputs: Stream[], outputs: Stream[], ore: ResolvedOre, waterIn = 0.0, byClass = false): Record<string, number> {
  const errors: Record<string, number> = {};
  const sum = (streams: Stream[], fn: (s: Stream) => number) => { let t = 0.0; for (const s of streams) t += fn(s); return t; };
  for (const m of ore.ids) {
    errors[`solids:${m}`] = relative(sum(inputs, s => s.mineralTph(m)), sum(outputs, s => s.mineralTph(m)));
    if (byClass) {
      // every size class, against the mineral's flow through the unit (K-01)
      const n = inputs[0].solids[m].length;
      let worst = 0.0;
      let inTotal = 0.0;
      let outTotal = 0.0;
      for (let i = 0; i < n; i += 1) {
        let fin = 0.0;
        let fout = 0.0;
        for (const s of inputs) fin += s.solids[m][i];
        for (const s of outputs) fout += s.solids[m][i];
        worst = Math.max(worst, Math.abs(fin - fout));
        inTotal += Math.abs(fin);
        outTotal += Math.abs(fout);
      }
      const scale = Math.max(inTotal, outTotal);
      errors[`classes:${m}`] = scale > 0.0 ? worst / scale : 0.0;
    }
  }
  for (const species of ore.species) {
    errors[`species:${species}`] = relative(sum(inputs, s => s.speciesTph(species, ore.composition)),
      sum(outputs, s => s.speciesTph(species, ore.composition)));
  }
  errors.water = relative(sum(inputs, s => s.water) + waterIn, sum(outputs, s => s.water));
  return errors;
}

export type Unit = [string, Stream[], Stream[], number];

export const BREAKAGE_UNITS = new Set(['crusher', 'mill', 'regrind', 'circuit']);

/** Relative residual of a breakage operator's steady state T^-1 p = m per class, against the feed's flow. */
export function residual(matrix: Mat, product: Vec, feed: Vec): number {
  const r = matvec(matrix, product);
  let worst = 0.0;
  let scale = 0.0;
  for (let i = 0; i < feed.length; i += 1) { worst = Math.max(worst, Math.abs(r[i] - feed[i])); scale += Math.abs(feed[i]); }
  return scale > 0.0 ? worst / scale : 0.0;
}

export function audit(units: Unit[], ore: ResolvedOre, equations: Record<string, number> = {}): { units: Record<string, number>; max_relative_error: number } {
  const report: Record<string, number> = {};
  let worst = 0.0;
  for (const [name, inputs, outputs, waterIn] of units) {
    const errors = Object.values(unitClosure(inputs, outputs, ore, waterIn, !BREAKAGE_UNITS.has(name)));
    report[name] = errors.length ? Math.max(...errors) : 0.0;
    worst = Math.max(worst, report[name]);
  }
  for (const [name, error] of Object.entries(equations)) {
    report[name] = error;
    worst = Math.max(worst, error);
  }
  return { units: report, max_relative_error: worst };
}

/** Names of streams carrying a class mass below minus `tolerance` times that mineral's flow in the stream (K-10). */
export function nonnegative(streams: Record<string, Stream>, tolerance: number): string[] {
  const bad: string[] = [];
  for (const [name, stream] of Object.entries(streams)) {
    let negative = false;
    for (const mass of Object.values(stream.solids)) {
      let total = 0.0;
      for (let i = 0; i < mass.length; i += 1) total += Math.abs(mass[i]);
      for (let i = 0; i < mass.length; i += 1) if (mass[i] < -tolerance * total) { negative = true; break; }
      if (negative) break;
    }
    if (negative) bad.push(name);
  }
  return bad;
}
