/**
 * JSON trace of one circuit evaluation (port of engine/trace.py; docs/data-contract/02_trace-and-live-api.md).
 * Every number is finite: a non-finite value becomes null and raises the non_finite_output flag with its path.
 */
import type { CircuitResult } from './circuit';
import { kineticRecord } from './kinetics';
import type { OperatingPoint } from './model';
import { fractionToGrade, type ResolvedOre } from './ore';
import type { Stream } from './streams';

export const TRACE_SCHEMA = 'oreflow.trace/v2';

export function streamRecord(stream: Stream, ore: ResolvedOre): Record<string, unknown> {
  const solids = stream.tph();
  const minerals: Record<string, number> = {};
  for (const m of ore.ids) minerals[m] = stream.mineralTph(m);
  const grades: Record<string, number> = {};
  for (const s of ore.species) grades[s] = fractionToGrade(stream.grade(s, ore.composition), ore.units[s]);
  return { solids_tph: solids, water_tph: stream.water, solids_pct: 100.0 * stream.pctSolids(), p80_um: solids > 0.0 ? stream.p80() : null,
    minerals_tph: minerals, grades };
}

function finite(value: unknown, path: string, bad: string[]): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    bad.push(path);
    return null;
  }
  if (Array.isArray(value) || value instanceof Float64Array) return Array.from(value as ArrayLike<unknown>, (v, i) => finite(v, `${path}[${i}]`, bad));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = finite(v, `${path}.${k}`, bad);
    return out;
  }
  return value;
}

function kinetics(result: CircuitResult, op: OperatingPoint): Record<string, unknown> {
  if (result.flotation === null) return { status: 'not_applicable', reason: 'the circuit has no flotation stage' };
  return kineticRecord(result.flotation, result.ore, op.rougher_cells, result.metrics.rougher_recovery_pct);
}

export type Trace = Record<string, unknown> & {
  metrics: Record<string, number>;
  metric_units: Record<string, string>;
  flags: Array<{ code: string; message: string }>;
};

export function trace(result: CircuitResult, op: OperatingPoint, family: string): Trace {
  const streams: Record<string, unknown> = {};
  for (const [name, s] of Object.entries(result.streams)) streams[name] = streamRecord(s, result.ore);
  const body = {
    schema: TRACE_SCHEMA,
    family,
    point: { ...op },
    metrics: result.metrics,
    metric_units: result.metric_units,
    concentrates: result.concentrates,
    tails: result.tails,
    topology: result.topology,
    streams,
    curves: result.curves,
    balance: result.balance,
    methods: { kinetics: kinetics(result, op) },
  };
  const bad: string[] = [];
  const clean = finite(body, 'trace', bad) as Trace;
  const flags = result.flags.map(f => ({ ...f }));
  if (bad.length) flags.push({ code: 'non_finite_output', message: `Non-finite values replaced by null at: ${bad.slice(0, 20).join(', ')}.` });
  clean.flags = flags;
  return clean;
}
