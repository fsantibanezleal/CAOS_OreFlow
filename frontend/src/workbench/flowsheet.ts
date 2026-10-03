/**
 * Flowsheet layout from the trace topology (PE-37). The circuit reads in two bands, like two lines of
 * text: the grinding circuit on top (crusher, mill, sump, cyclones, and the underflow return or the
 * gravity unit below the cyclones), the separation circuit on the band below, starting again at the left
 * (desliming, the LIMS stages, or conditioning, rougher, regrind, cleaner and recleaner). Streams
 * become edges from the unit that produces them to the unit that consumes them: the feed enters from
 * the left, every product leaves as a terminal (to the right of its unit, or downward when the right is
 * taken by a unit or by the unit's concentrate), the cyclone overflow runs down to the second band, and
 * an edge that runs back against the flow is routed along its own row when no unit is in the way, above
 * its row when it returns along the second band's lower row and the strip above is free (the recleaner tail,
 * D-09: below the band it crossed the cleaner tail's lane in every recleaner case), and otherwise in a lane
 * of its own below the band, so two recycles never share or cross a line. The circulating
 * streams (cyclone underflow and its return, cleaner and recleaner tails) are drawn as recycles
 * wherever they run.
 */
import type { Inset } from '../components/charts/inset';
import type { TopologyUnit } from '../engine/circuit';
import { formatWithUnit, type Lang } from '../lib/format';
import { streamName } from '../lib/i18n';

export type Node = { unit: string; col: number; row: number };
export type Edge = {
  stream: string;
  from: string | null;          // null: enters the circuit
  to: string | null;            // null: leaves the circuit (a product)
  recycle: boolean;
  points: Array<[number, number]>;  // grid coordinates of the polyline
};
export type Layout = { nodes: Node[]; edges: Edge[]; cols: number; rows: number };

const GRINDING: Record<string, [number, number]> = {
  crusher: [0, 0], mill_feed_junction: [1, 0], mill: [2, 0], sump: [3, 0], cyclone: [4, 0],
  underflow_return: [4, 1], gravity_split: [4, 1],
};
/** Streams that circulate by definition, drawn as recycles along their whole path. */
const CIRCULATING = new Set(['cyclone_underflow', 'recycle', 'cleaner_tail', 'recleaner_tail']);
/** The second band starts on this row. */
const BAND = 2;
const MAGNETIC: Record<string, [number, number]> = { lims_link: [0, BAND], lims_rougher: [1, BAND], lims_cleaner: [2, BAND] };
const FLOTATION: Record<string, [number, number]> = {
  flotation_link: [0, BAND], rougher_junction: [1, BAND], rougher: [2, BAND], regrind: [2, BAND + 1],
  cleaner_junction: [3, BAND + 1], cleaner: [4, BAND + 1], recleaner_dilution: [5, BAND + 1], recleaner: [6, BAND + 1],
};
/** Half the extent of a unit box, in cells: edges start and end this far from the unit's centre. */
const HALF = 0.35;

export function layout(topology: TopologyUnit[], concentrates: string[], tails: string[]): Layout {
  const units = topology.map(u => u.unit);
  const shift = units.includes('deslime') ? 1 : 0;
  const cell = (unit: string): [number, number] => {
    if (unit in GRINDING) return GRINDING[unit];
    if (unit === 'deslime') return [0, BAND];
    if (unit in MAGNETIC) return MAGNETIC[unit];
    if (unit in FLOTATION) { const [c, r] = FLOTATION[unit]; return [c + shift, r]; }
    return [0, BAND + 2];
  };
  const nodes: Node[] = units.map(unit => { const [col, row] = cell(unit); return { unit, col, row }; });
  const at: Record<string, Node> = Object.fromEntries(nodes.map(n => [n.unit, n]));
  const band = (row: number) => (row >= BAND ? 1 : 0);
  const occupied = (row: number, lo: number, hi: number) => nodes.some(n => n.row === row && n.col > lo && n.col < hi);
  const producer: Record<string, string> = {};
  const consumers: Record<string, string[]> = {};
  for (const u of topology) {
    for (const s of u.outputs) producer[s] = u.unit;
    for (const s of u.inputs) (consumers[s] ??= []).push(u.unit);
  }
  const products = new Set([...concentrates, ...tails]);
  // the tails last, so a unit with two products gives the right to its concentrate (a stable sort: the
  // other streams, and the recycle lanes they take, keep their order)
  const tailSet = new Set(tails);
  const streams = [...new Set(topology.flatMap(u => [...u.inputs, ...u.outputs]))].sort((a, b) => Number(tailSet.has(a)) - Number(tailSet.has(b)));
  const productSides: Record<string, Set<'right' | 'down'>> = {};
  const edges: Edge[] = [];
  const bandRows = [0, 1].map(b => nodes.filter(n => band(n.row) === b).map(n => n.row));
  const lanes = [0, 0];   // recycle lanes already used below each band
  let maxCol = Math.max(...nodes.map(n => n.col));
  let maxRow = Math.max(...nodes.map(n => n.row));
  for (const stream of streams) {
    const from = producer[stream] ?? null;
    const targets = consumers[stream] ?? [];
    if (from === null) {
      for (const to of targets) {
        const t = at[to];
        edges.push({ stream, from: null, to, recycle: false, points: [[t.col - 0.85, t.row], [t.col - HALF, t.row]] });
      }
      continue;
    }
    const f = at[from];
    if (targets.length === 0 || products.has(stream)) {
      // a product leaves to the right of its unit, or downward when the right cell is taken or another
      // product of the unit already leaves to the right (the LIMS cleaner's concentrate and tail)
      const sides = (productSides[from] ??= new Set());
      const right = !sides.has('right') && !nodes.some(n => n.row === f.row && n.col === f.col + 1);
      sides.add(right ? 'right' : 'down');
      const points: Array<[number, number]> = right ? [[f.col + HALF, f.row], [f.col + 0.9, f.row]] : [[f.col, f.row + HALF], [f.col, f.row + 0.8]];
      edges.push({ stream, from, to: null, recycle: false, points });
      if (right) maxCol = Math.max(maxCol, f.col + 1);
      else maxRow = Math.max(maxRow, f.row + 1);
      continue;
    }
    for (const to of targets) {
      const t = at[to];
      const down = band(t.row) > band(f.row);
      const backward = !down && (t.col < f.col || (t.col === f.col && t.row < f.row));
      const recycle = backward || CIRCULATING.has(stream);
      let points: Array<[number, number]>;
      if (down) {
        // the carriage return: out of the right of the unit, down between the bands, back to the left
        const between = BAND - 0.5;
        points = [[f.col + HALF, f.row], [f.col + 1, f.row], [f.col + 1, between], [t.col - 0.6, between], [t.col - 0.6, t.row], [t.col - HALF, t.row]];
        maxCol = Math.max(maxCol, f.col + 1);
      } else if (!backward && t.row === f.row) {
        points = [[f.col + HALF, f.row], [t.col - HALF, t.row]];
      } else if (!backward && t.col === f.col) {
        points = [[f.col, f.row + HALF], [t.col, t.row - HALF]];
      } else if (!backward) {
        points = [[f.col, f.row + HALF], [f.col, t.row], [t.col - HALF, t.row]];
      } else if (t.row > f.row) {
        // back and down: down from the unit, then left into the target's side
        points = [[f.col, f.row + HALF], [f.col, t.row], [t.col + HALF, t.row]];
      } else if (t.row < f.row && !occupied(f.row, t.col - 1, f.col)) {
        // back and up with a free row: left along the source's row, then up into the target
        points = [[f.col - HALF, f.row], [t.col, f.row], [t.col, t.row + HALF]];
      } else if (t.row === f.row && f.row > BAND && !nodes.some(n => n.row === f.row - 1 && n.col >= t.col && n.col <= f.col)) {
        // back along the second band's lower row: above the row, between it and the band's first row
        // it rises from the left of the unit's top, so the space above the unit stays free for its product's label
        const above = f.row - 0.5;
        points = [[f.col - 0.2, f.row - HALF], [f.col - 0.2, above], [t.col, above], [t.col, t.row - HALF]];
      } else {
        // a lane of its own below the band, deeper for each further recycle of that band
        const b = band(f.row);
        const lane = Math.max(...bandRows[b]) + 0.55 + 0.22 * lanes[b];
        lanes[b] += 1;
        points = [[f.col, f.row + HALF], [f.col, lane], [t.col, lane], [t.col, t.row + HALF]];
        maxRow = Math.max(maxRow, Math.ceil(lane - 0.3));
      }
      edges.push({ stream, from, to, recycle, points });
    }
  }
  // D-21: a product that leaves to the right stops short of a vertical line one cell on (the cyclone overflow's
  // carriage return), so its arrowhead never reads as joining that line
  for (const e of edges) {
    if (e.to !== null || e.points.length !== 2 || e.points[0][1] !== e.points[1][1]) continue;
    const [[x0, y], [x1]] = e.points;
    if (x1 <= x0) continue;
    const blocked = edges.some(o => o !== e && o.points.slice(1).some((b, i) => {
      const a = o.points[i];
      return a[0] === b[0] && Math.abs(a[0] - Math.ceil(x1)) < 1e-9 && Math.min(a[1], b[1]) <= y && Math.max(a[1], b[1]) >= y;
    }));
    if (blocked) e.points[1] = [x0 + 0.35, y];
  }
  return { nodes, edges, cols: maxCol + 1, rows: maxRow + 1 };
}

/** The grid's extent in cells: every unit box and every edge point, with room for the labels above the first row. */
export type Extent = { x0: number; x1: number; y0: number; y1: number };
export function extent(plan: Layout): Extent {
  const gx = [...plan.nodes.flatMap(n => [n.col - 0.45, n.col + 0.45]), ...plan.edges.flatMap(e => e.points.map(p => p[0]))];
  const gy = [...plan.nodes.flatMap(n => [n.row - 0.3, n.row + 0.3]), ...plan.edges.flatMap(e => e.points.map(p => p[1]))];
  return { x0: Math.min(...gx) - 0.1, x1: Math.max(...gx) + 0.1, y0: Math.min(...gy) - 0.4, y1: Math.max(...gy) + 0.15 };
}

/** The widest and tallest cell, in px at the drawing's own scale, where the 11 px unit names read well. */
export const CELL_W = 210;
export const CELL_H = 150;
/** The narrowest cell that holds a 64 px unit box (a name on two lines) and 24 px for the stream and its
 * arrow to the next box: a stage narrower than that (a phone) keeps this width and scrolls sideways. */
export const MIN_CELL_W = 88;

export type Fit = {
  zoom: number; cellW: number; cellH: number; ox: number; oy: number; width: number; height: number;
  frame: { x0: number; y0: number; x1: number; y1: number };   // the box less the inset, where everything is drawn
};

/**
 * The grid on a stage. One scale per axis fills the stage up to the readable cell; a stage larger than
 * that on both axes is filled by scaling the whole drawing, text and strokes with it, by one factor, so
 * the circuit spans the stage on its limiting axis instead of sitting small in its middle (ADR-0071).
 * The drawing is laid out in a box of the stage divided by that factor (width by height, in the
 * drawing's own px), which the SVG viewBox scales back; the text never shrinks, since the factor is at
 * least 1. A stage narrower than the narrowest readable cell keeps that cell, so the box is wider than
 * the stage and the diagram's host scrolls sideways; shrinking would take the names below 6 px. The
 * frame is the part of the box no overlay covers: units, streams and labels stay in it.
 */
export function fit(e: Extent, stage: { width: number; height: number }, inset: Inset): Fit {
  const [top, right, bottom, left] = inset;
  const spanX = e.x1 - e.x0;
  const spanY = e.y1 - e.y0;
  const W = stage.width - left - right;
  const H = stage.height - top - bottom;
  const zoom = Math.max(1, Math.min(W / (CELL_W * spanX), H / (CELL_H * spanY)));
  const w = Math.max(W / zoom, MIN_CELL_W * spanX);
  const h = H / zoom;
  const cellW = Math.min(CELL_W, w / spanX);
  const cellH = Math.min(CELL_H, h / spanY);
  const width = w + (left + right) / zoom;
  return {
    zoom, cellW, cellH,
    ox: left / zoom + (w - cellW * spanX) / 2 - e.x0 * cellW,
    oy: top / zoom + (h - cellH * spanY) / 2 - e.y0 * cellH,
    width,
    height: stage.height / zoom,
    frame: { x0: left / zoom, y0: top / zoom, x1: width - right / zoom, y1: (stage.height - bottom) / zoom },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The drawing in px and its labels: pure functions of the layout, the fit and the trace's stream records, so the
// placement is tested over every case and stage (flowsheet.test.ts) and the component only renders the result.

export const BOX_H = 34;
export const NODE_R = 6;            // a junction's radius
export const NAME_CHAR = 6.2;       // px per character of an 11 px unit name
const CAPTION_CHAR = 5.4;           // px per character of a 9.5 px junction name
const LABEL_CHAR = 6.1;             // px per character of a 10 px monospaced edge label
export const LINE = 11;             // px between the lines of a two-line label
/** px by which another stream must be nearer a label than its own before the label is refused (D-21). */
const NEARER = 8;
/** D-20: the points where streams join or water is added, drawn as small nodes, not as equipment. */
export const JUNCTIONS = new Set(['mill_feed_junction', 'underflow_return', 'lims_link', 'flotation_link', 'rougher_junction', 'cleaner_junction', 'recleaner_dilution']);

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Label = { x: number; y: number; anchor: 'middle' | 'start' | 'end'; lines: string[] };
export type Caption = { unit: string; box: Box; y: number };
export type Drawing = { boxW: number; paths: Array<Array<[number, number]>>; units: Box[]; segments: Box[]; centres: Record<string, [number, number]> };
type StreamRecord = { solids_tph: number; grades: Record<string, number> };

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
function toSegment([x, y]: [number, number], [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax, dy = by - ay;
  const s = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(x - (ax + s * dx), y - (ay + s * dy));
}
const toPath = (q: [number, number], path: Array<[number, number]>) => Math.min(...path.slice(1).map((b, i) => toSegment(q, path[i], b)));
/** The distance from a label's box to a path: from the nearest of its corners, edge midpoints and centre. */
function toBox(b: Box, path: Array<[number, number]>): number {
  const xs = [b.x0, (b.x0 + b.x1) / 2, b.x1], ys = [b.y0, (b.y0 + b.y1) / 2, b.y1];
  return Math.min(...xs.flatMap(x => ys.map(y => toPath([x, y], path))));
}

/** Every unit box and edge polyline in the drawing's px. */
export function drawing(plan: Layout, f: Fit): Drawing {
  const px = (col: number) => f.ox + col * f.cellW;
  const py = (row: number) => f.oy + row * f.cellH;
  const boxW = Math.max(64, Math.min(132, f.cellW * 0.66));
  const at = Object.fromEntries(plan.nodes.map(n => [n.unit, n]));
  const halfW = (unit: string) => (JUNCTIONS.has(unit) ? NODE_R : boxW / 2);
  const halfH = (unit: string) => (JUNCTIONS.has(unit) ? NODE_R : BOX_H / 2);
  // edge ends that sit HALF a cell from a unit's centre are moved onto that unit's border
  const paths = plan.edges.map(edge => edge.points.map(([c, r], k): [number, number] => {
    const end = k === 0 ? edge.from : k === edge.points.length - 1 ? edge.to : null;
    const node = end ? at[end] : undefined;
    let x = px(c);
    let y = py(r);
    if (node) {
      if (Math.abs(Math.abs(c - node.col) - HALF) < 1e-9 && r === node.row) x = px(node.col) + Math.sign(c - node.col) * halfW(node.unit);
      if (Math.abs(Math.abs(r - node.row) - HALF) < 1e-9 && Math.abs(c - node.col) < 0.5) y = py(node.row) + Math.sign(r - node.row) * halfH(node.unit);
    }
    return [x, y];
  }));
  // U-26: every edge segment (and its arrowhead) is an obstacle for every label, so no label sits on a line
  const segments: Box[] = paths.flatMap(path => path.slice(1).map(([x1, y1], i) => {
    const [x0, y0] = path[i];
    return { x0: Math.min(x0, x1) - 3, y0: Math.min(y0, y1) - 3, x1: Math.max(x0, x1) + 3, y1: Math.max(y0, y1) + 3 };
  }));
  const units = plan.nodes.map(n => ({ x0: px(n.col) - halfW(n.unit), y0: py(n.row) - halfH(n.unit), x1: px(n.col) + halfW(n.unit), y1: py(n.row) + halfH(n.unit) }));
  const centres = Object.fromEntries(plan.nodes.map(n => [n.unit, [px(n.col), py(n.row)] as [number, number]]));
  return { boxW, paths, units, segments, centres };
}

/** Each junction's name, above its node or below it, where neither a unit, a line nor a stream label is; a name
 * that finds no room is left out (the node keeps it as its accessible name, and the unit panel shows it). */
export function placeCaptions(plan: Layout, d: Drawing, frame: Fit['frame'], labelBoxes: Box[], nameOf: (unit: string) => string): Caption[] {
  const taken: Box[] = [...d.units, ...d.segments, ...labelBoxes];
  const out: Caption[] = [];
  for (const n of plan.nodes.filter(m => JUNCTIONS.has(m.unit))) {
    const w = nameOf(n.unit).length * CAPTION_CHAR;
    const [cx, cy] = d.centres[n.unit];
    for (const box of [{ x0: cx - w / 2, y0: cy - NODE_R - 13, x1: cx + w / 2, y1: cy - NODE_R - 2 }, { x0: cx - w / 2, y0: cy + NODE_R + 2, x1: cx + w / 2, y1: cy + NODE_R + 13 }]) {
      if (box.x0 < frame.x0 || box.x1 > frame.x1 || box.y0 < frame.y0 || box.y1 > frame.y1 || taken.some(b => overlaps(b, box))) continue;
      taken.push(box);
      out.push({ unit: n.unit, box, y: box.y1 - 2 });
      break;
    }
  }
  return out;
}

/** Each edge's hover text and its label options: one line, or two (the name over the values) where one line
 * finds no room (D-08); the underflow into the gravity unit also says the bleed it treats (D-04). */
export function labelTexts(plan: Layout, streams: Record<string, StreamRecord>, primary: { species: string; unit: string }, point: Record<string, number>, lang: Lang) {
  const partsOf = (stream: string) => {
    const s = streams[stream];
    return s ? [formatWithUnit(s.solids_tph, 't/h', lang), formatWithUnit(s.grades[primary.species], primary.unit, lang)] : [];
  };
  const bleedShare = Number.isFinite(point.gravity_bleed) ? formatWithUnit(100 * point.gravity_bleed, '%', lang) : '';
  const bleedLine = streams.gravity_feed && bleedShare ? `b = ${bleedShare}: ${formatWithUnit(streams.gravity_feed.solids_tph, 't/h', lang)} ${lang === 'es' ? 'a la unidad' : 'to the unit'}` : '';
  const edges = plan.edges.map(edge => {
    const name = streamName(edge.stream, lang);
    const parts = partsOf(edge.stream);
    const value = parts.join(' · ');
    const outlet = edge.to === null || edge.from === null;
    // U-09: an outlet or the feed says which stream it is; an inner edge keeps its rate and grade only
    const text = outlet ? `${name}: ${value}` : value;
    const bleed = edge.stream === 'cyclone_underflow' && edge.to === 'gravity_split' && bleedLine !== '';
    // D-08: one line first; where it finds no room, the name over the values, then the rate over the grade (the
    // bleed's line gives way last: the gravity box names its share and the title says it all)
    const options: string[][] = !value ? []
      : bleed ? [[value, bleedLine], [value], parts]
        : outlet ? [[text], [`${name}:`, value], [`${name}:`, ...parts]] : [[text], parts];
    return { title: `${name}: ${bleed ? `${value}; ${bleedLine}` : text}`, options };
  });
  return { edges, bleedShare };
}

/** A label for each edge, or null where none of its options finds room, and the boxes the labels take. */
export function placeLabels(plan: Layout, d: Drawing, frame: Fit['frame'], options: string[][][]): { labels: Array<Label | null>; boxes: Box[] } {
  const placed: Box[] = [];
  const obstacles = [...d.units, ...d.segments];
  // the outlets and the feed claim their room first: they name their streams (U-09), and the final concentrate's
  // label is the one a reader looks for (D-08)
  const order = plan.edges.map((_, k) => k).sort((a, b) => Number(plan.edges[b].to === null || plan.edges[b].from === null) - Number(plan.edges[a].to === null || plan.edges[a].from === null));
  const labels: Array<Label | null> = plan.edges.map(() => null);
  for (const k of order) labels[k] = place(k);
  return { labels, boxes: placed };

  function place(k: number): Label | null {
    const edge = plan.edges[k];
    const path = d.paths[k];
    // the label goes by the longest segment: above a horizontal one, beside a vertical one
    let best = 0;
    let bestLength = -1;
    for (let i = 0; i + 1 < path.length; i += 1) {
      const length = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      if (length > bestLength) { bestLength = length; best = i; }
    }
    const [[ax, ay], [bx, by]] = [path[best], path[best + 1]];
    const horizontal = Math.abs(by - ay) < 1e-6;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    // the first candidate, over every form, that fits and that no other stream is clearly nearer (D-21: a label
    // reads as the stream nearest to it), else the first that fits
    let fallback: { label: Label; box: Box } | null = null;
    for (const lines of options[k]) {
      const w = Math.max(...lines.map(l => l.length)) * LABEL_CHAR;
      const up = LINE * (lines.length - 1);
      // above the row of units first (a short edge between two units has no room of its own), then just
      // above or below the line; a product's label may also end at its arrow and a feed's start at its
      // tail, on the line or above the row
      const candidates: Array<{ x: number; y: number; anchor: 'middle' | 'start' | 'end' }> = horizontal
        ? [
          ...(edge.to === null ? [{ x: Math.max(ax, bx), y: my - 6 - up, anchor: 'end' as const }, { x: Math.max(ax, bx), y: my - BOX_H / 2 - 5 - up, anchor: 'end' as const }] : []),
          ...(edge.from === null ? [{ x: Math.min(ax, bx), y: my - 6 - up, anchor: 'start' as const }, { x: Math.min(ax, bx), y: my - BOX_H / 2 - 5 - up, anchor: 'start' as const }] : []),
          { x: mx, y: my - BOX_H / 2 - 5 - up, anchor: 'middle' },
          { x: mx, y: my - 6 - up, anchor: 'middle' },
          { x: mx, y: my + BOX_H / 2 + 13, anchor: 'middle' },
          ...(edge.to === null ? [{ x: Math.max(ax, bx), y: my + 14, anchor: 'end' as const }, { x: Math.max(ax, bx), y: my + BOX_H / 2 + 13, anchor: 'end' as const }] : []),
        ]
        : [{ x: mx + 6, y: my + 3 - up / 2, anchor: 'start' }, { x: mx - 6, y: my + 3 - up / 2, anchor: 'end' }];
      for (const c of candidates) {
        const bx0 = c.anchor === 'middle' ? c.x - w / 2 : c.anchor === 'start' ? c.x : c.x - w;
        const box = { x0: bx0 - 2, y0: c.y - 10, x1: bx0 + w + 2, y1: c.y + 3 + up };
        // inside the frame, so no label sits under an overlay (the focus route's readouts)
        if (box.x0 < frame.x0 || box.x1 > frame.x1 || box.y0 < frame.y0 || box.y1 > frame.y1 || [...obstacles, ...placed].some(b => overlaps(b, box))) continue;
        const own = toBox(box, path);
        if (d.paths.some((other, j) => j !== k && plan.edges[j].stream !== edge.stream && toBox(box, other) + NEARER < own)) {
          fallback ??= { label: { ...c, lines }, box };
          continue;
        }
        placed.push(box);
        return { ...c, lines };
      }
    }
    if (fallback) placed.push(fallback.box);
    return fallback?.label ?? null;
  }
}
