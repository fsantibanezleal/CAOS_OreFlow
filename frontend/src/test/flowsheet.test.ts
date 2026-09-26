import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TopologyUnit } from '../engine/circuit';
import { layout } from '../workbench/flowsheet';

// PE-37 (the automated half; the screenshots are the other): on every baked variant the flowsheet
// places every unit of the trace topology in its own cell, draws every product as a terminal, draws the
// recycle streams the circuit has as recycle edges (cyclone underflow back to the mill, cleaner tails
// back to the rougher, recleaner tails back to the cleaner), and every stream it labels has a record.
const root = fileURLToPath(new URL('../../../data/derived/cases/', import.meta.url));
const files = readdirSync(root).filter(f => f.endsWith('.json')).sort();

type Trace = { topology: TopologyUnit[]; concentrates: string[]; tails: string[]; streams: Record<string, unknown> };
const RECYCLES: Array<[string, string, string]> = [
  ['recycle', 'mill_feed_junction', 'the cyclone underflow back to the mill'],
  ['cleaner_tail', 'rougher_junction', 'the cleaner tails back to the rougher'],
  ['recleaner_tail', 'cleaner_junction', 'the recleaner tails back to the cleaner'],
];

describe('the flowsheet draws the trace topology', () => {
  expect(files.length).toBe(12);
  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(root, file), 'utf-8')) as { case_id: string; variants: Array<{ id: string; trace: Trace }> };
    it(artifact.case_id, () => {
      for (const variant of artifact.variants) {
        const trace = variant.trace;
        const plan = layout(trace.topology, trace.concentrates, trace.tails);
        const where = `${artifact.case_id}:${variant.id}`;
        expect(plan.nodes.map(n => n.unit).sort(), where).toEqual(trace.topology.map(u => u.unit).sort());
        expect(new Set(plan.nodes.map(n => `${n.col},${n.row}`)).size, where).toBe(plan.nodes.length);
        const products = plan.edges.filter(e => e.to === null).map(e => e.stream);
        for (const product of [...trace.concentrates, ...trace.tails]) expect(products, where).toContain(product);
        for (const [stream, into, what] of RECYCLES) {
          const consumed = trace.topology.some(u => u.unit === into && u.inputs.includes(stream));
          if (!consumed) continue;
          const edge = plan.edges.find(e => e.stream === stream && e.to === into);
          expect(edge?.recycle, `${where}: ${what}`).toBe(true);
        }
        for (const edge of plan.edges) expect(trace.streams[edge.stream], `${where}: ${edge.stream}`).toBeDefined();
      }
    });
  }
});
