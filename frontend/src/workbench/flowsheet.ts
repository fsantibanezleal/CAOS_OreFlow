/**
 * Flowsheet layout from the trace topology (PE-37). The circuit reads in two bands, like two lines of
 * text: the grinding circuit on top (crusher, mill, sump, cyclones, and the underflow return or the
 * gravity unit below the cyclones), the separation circuit on the band below, starting again at the left
 * (desliming, the LIMS stages, or conditioning, rougher, regrind, cleaner and recleaner). Streams
 * become edges from the unit that produces them to the unit that consumes them: the feed enters from
 * the left, every product leaves as a terminal, the cyclone overflow runs down to the second band, and
 * an edge that runs back against the flow is routed along its own row when no unit is in the way and
 * otherwise in a lane of its own below the band, so two recycles never share a line. The circulating
 * streams (cyclone underflow and its return, cleaner and recleaner tails) are drawn as recycles
 * wherever they run.
 */
import type { TopologyUnit } from '../engine/circuit';

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
  const streams = [...new Set(topology.flatMap(u => [...u.inputs, ...u.outputs]))];
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
      // a product leaves to the right of its unit, or downward when the right cell is taken
      const right = !nodes.some(n => n.row === f.row && n.col === f.col + 1);
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
  return { nodes, edges, cols: maxCol + 1, rows: maxRow + 1 };
}
