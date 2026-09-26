/**
 * Independent conservation audit (port of engine/balance.py; docs/methodologies/10_conservation-audit.md):
 * every unit's mineral solids, reported species and water re-summed from the named streams alone.
 */
import type { ResolvedOre } from './ore';
import type { Stream } from './streams';

function relative(inflow: number, outflow: number): number {
  const scale = Math.max(Math.abs(inflow), Math.abs(outflow));
  return scale > 0.0 ? Math.abs(inflow - outflow) / scale : 0.0;
}

export function unitClosure(inputs: Stream[], outputs: Stream[], ore: ResolvedOre, waterIn = 0.0): Record<string, number> {
  const errors: Record<string, number> = {};
  const sum = (streams: Stream[], fn: (s: Stream) => number) => { let t = 0.0; for (const s of streams) t += fn(s); return t; };
  for (const m of ore.ids) errors[`solids:${m}`] = relative(sum(inputs, s => s.mineralTph(m)), sum(outputs, s => s.mineralTph(m)));
  for (const species of ore.species) {
    errors[`species:${species}`] = relative(sum(inputs, s => s.speciesTph(species, ore.composition)),
      sum(outputs, s => s.speciesTph(species, ore.composition)));
  }
  errors.water = relative(sum(inputs, s => s.water) + waterIn, sum(outputs, s => s.water));
  return errors;
}

export type Unit = [string, Stream[], Stream[], number];

export function audit(units: Unit[], ore: ResolvedOre): { units: Record<string, number>; max_relative_error: number } {
  const report: Record<string, number> = {};
  let worst = 0.0;
  for (const [name, inputs, outputs, waterIn] of units) {
    const errors = Object.values(unitClosure(inputs, outputs, ore, waterIn));
    report[name] = errors.length ? Math.max(...errors) : 0.0;
    worst = Math.max(worst, report[name]);
  }
  return { units: report, max_relative_error: worst };
}

/** Names of streams carrying a negative class mass beyond the tolerance. */
export function nonnegative(streams: Record<string, Stream>, tolerance: number): string[] {
  const bad: string[] = [];
  for (const [name, stream] of Object.entries(streams)) {
    let negative = false;
    for (const mass of Object.values(stream.solids)) {
      for (let i = 0; i < mass.length; i += 1) if (mass[i] < -tolerance) { negative = true; break; }
      if (negative) break;
    }
    if (negative) bad.push(name);
  }
  return bad;
}
