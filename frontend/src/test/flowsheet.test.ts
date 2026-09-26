import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { TopologyUnit } from '../engine/circuit';
import { CELL_H, CELL_W, extent, fit, layout } from '../workbench/flowsheet';

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
        // no two streams share a stretch of line: a unit with two products (the LIMS cleaner's concentrate
        // and tail) once drew both along the same terminal, one arrow under two labels
        const segments = plan.edges.flatMap(e => e.points.slice(1).map((b, i) => ({ stream: e.stream, a: e.points[i], b })));
        for (const [i, s] of segments.entries()) {
          for (const t of segments.slice(i + 1)) {
            if (s.stream === t.stream) continue;
            const along = (k: 0 | 1) => s.a[k] === s.b[k] && t.a[k] === t.b[k] && s.a[k] === t.a[k];
            const overlap = (k: 0 | 1) => Math.min(Math.max(s.a[k], s.b[k]), Math.max(t.a[k], t.b[k])) - Math.max(Math.min(s.a[k], s.b[k]), Math.min(t.a[k], t.b[k]));
            const shared = (along(1) && overlap(0) > 1e-9) || (along(0) && overlap(1) > 1e-9);
            expect(shared, `${where}: ${s.stream} and ${t.stream} share a line`).toBe(false);
          }
        }
      }
    });
  }
});

// ADR-0071 on the flowsheet: on every stage, from a phone to a 4K screen, with and without the focus
// route's overlay inset, the drawing spans its frame on the limiting axis, never leaves it, sits in its
// centre, and never shrinks its text (the scale factor is at least 1). At 2560 x 1440 the drawing had
// stopped at the readable cell and filled 75% of the stage's width and half its height.
const STAGES: Array<[number, number]> = [[358, 420], [960, 520], [952, 600], [1300, 700], [2189, 1203], [2221, 1440], [3500, 1900]];
const INSETS: Array<[number, number, number, number]> = [[0, 0, 0, 0], [72, 16, 12, 156]];

describe('the flowsheet fills its stage', () => {
  for (const file of files) {
    const artifact = JSON.parse(readFileSync(join(root, file), 'utf-8')) as { case_id: string; variants: Array<{ id: string; trace: Trace }> };
    it(artifact.case_id, () => {
      for (const variant of artifact.variants) {
        const trace = variant.trace;
        const e = extent(layout(trace.topology, trace.concentrates, trace.tails));
        for (const [width, height] of STAGES) {
          for (const inset of INSETS) {
            const [top, right, bottom, left] = inset;
            const where = `${artifact.case_id}:${variant.id} on ${width} x ${height}, inset ${inset.join(' ')}`;
            const f = fit(e, { width, height }, inset);
            const W = width - left - right;
            const H = height - top - bottom;
            const drawnW = f.cellW * (e.x1 - e.x0) * f.zoom;
            const drawnH = f.cellH * (e.y1 - e.y0) * f.zoom;
            expect(f.zoom, where).toBeGreaterThanOrEqual(1);
            expect(f.cellW, where).toBeLessThanOrEqual(CELL_W);
            expect(f.cellH, where).toBeLessThanOrEqual(CELL_H);
            expect(drawnW, where).toBeLessThanOrEqual(W + 1e-9);
            expect(drawnH, where).toBeLessThanOrEqual(H + 1e-9);
            expect(Math.max(drawnW / W, drawnH / H), where).toBeCloseTo(1, 9);
            expect((f.ox + e.x0 * f.cellW) * f.zoom, where).toBeCloseTo(left + (W - drawnW) / 2, 6);
            expect((f.oy + e.y0 * f.cellH) * f.zoom, where).toBeCloseTo(top + (H - drawnH) / 2, 6);
            expect(f.frame.x0 * f.zoom, where).toBeCloseTo(left, 9);
            expect(f.frame.y0 * f.zoom, where).toBeCloseTo(top, 9);
            expect(f.frame.x1 * f.zoom, where).toBeCloseTo(width - right, 9);
            expect(f.frame.y1 * f.zoom, where).toBeCloseTo(height - bottom, 9);
            expect(f.width * f.zoom, where).toBeCloseTo(width, 9);
            expect(f.height * f.zoom, where).toBeCloseTo(height, 9);
          }
        }
      }
    });
  }
});
