/**
 * The circuit as the trace describes it (PE-37): units from the topology, every stream labelled with its
 * solids flow and payable grade from the trace's stream records, recycles dashed, products as terminals.
 * The diagram measures its own box and lays the grid out in pixels up to a readable cell, so text keeps
 * its size on a small stage; a stage larger than that cell on both axes is filled by scaling the whole
 * drawing by one factor (flowsheet.ts, fit), so the circuit spans the stage at any viewport and its text
 * grows with it. An edge label that would overlap a unit or another label
 * is left out; every edge still carries its values as a hover title, and the unit panel lists them.
 * Selecting a unit reports it upward; the diagram computes nothing.
 */
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { OverlayInset } from '../components/charts/inset';
import type { TopologyUnit } from '../engine/circuit';
import type { Trace } from '../engine/trace';
import { formatWithUnit, type Lang } from '../lib/format';
import { streamName } from '../lib/i18n';
import { extent, fit, layout, type Edge } from './flowsheet';

const UNIT_NAMES: Record<string, [string, string]> = {
  crusher: ['Crusher', 'Chancador'], mill_feed_junction: ['Mill feed', 'Alimentación molino'], mill: ['Ball mill', 'Molino de bolas'],
  sump: ['Sump', 'Cajón'], cyclone: ['Cyclones', 'Ciclones'], underflow_return: ['Underflow return', 'Retorno de descarga'],
  gravity_split: ['Gravity unit', 'Concentrador gravimétrico'], lims_link: ['LIMS feed', 'Alimentación LIMS'],
  lims_rougher: ['LIMS rougher', 'LIMS rougher'], lims_cleaner: ['LIMS cleaner', 'LIMS limpieza'], deslime: ['Desliming', 'Deslamado'],
  flotation_link: ['Conditioning', 'Acondicionamiento'], rougher_junction: ['Rougher feed', 'Alimentación rougher'], rougher: ['Rougher', 'Rougher'],
  regrind: ['Regrind', 'Remolienda'], cleaner_junction: ['Cleaner feed', 'Alimentación limpieza'], cleaner: ['Cleaner', 'Limpieza'],
  recleaner_dilution: ['Recleaner feed', 'Alimentación relimpieza'], recleaner: ['Recleaner', 'Relimpieza'],
};

export const unitName = (unit: string, lang: Lang) => (UNIT_NAMES[unit] ? UNIT_NAMES[unit][lang === 'es' ? 1 : 0] : unit);

type StreamRecord = { solids_tph: number; water_tph: number; grades: Record<string, number> };
type Box = { x0: number; y0: number; x1: number; y1: number };

const BOX_H = 34;
const NAME_CHAR = 6.2;      // px per character of an 11 px unit name
const LABEL_CHAR = 6.1;     // px per character of a 10 px monospaced edge label
const HALF = 0.35;          // edge end offset from a unit's centre, in cells (flowsheet.ts)
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** A unit name in one line, or two when it does not fit the box. */
function nameLines(name: string, width: number): string[] {
  if (name.length * NAME_CHAR <= width - 10 || !name.includes(' ')) return [name];
  const middle = name.length / 2;
  let cut = -1;
  for (let i = 0; i < name.length; i += 1) if (name[i] === ' ' && (cut < 0 || Math.abs(i - middle) < Math.abs(cut - middle))) cut = i;
  return [name.slice(0, cut), name.slice(cut + 1)];
}

export interface FlowsheetProps {
  trace: Trace;
  primary: { species: string; unit: string };
  lang: Lang;
  selected: string | null;
  onSelect: (unit: string | null) => void;
  summary: string;
}

export function FlowsheetDiagram({ trace, primary, lang, selected, onSelect, summary }: FlowsheetProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 520 });
  const [top, right, bottom, left] = useContext(OverlayInset);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => setSize({ width: Math.max(320, host.clientWidth), height: Math.max(220, host.clientHeight) }));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const topology = trace.topology as unknown as TopologyUnit[];
  const streams = trace.streams as unknown as Record<string, StreamRecord>;
  const concentrates = trace.concentrates as unknown as string[];
  const tails = trace.tails as unknown as string[];
  const plan = useMemo(() => layout(topology, concentrates, tails), [topology, concentrates, tails]);

  // the grid on the stage (flowsheet.ts): everything below is in the drawing's own px, which the viewBox
  // scales to the stage when the stage is larger than the readable cell on both axes
  const { zoom, cellW, cellH, ox, oy, width, height, frame } = fit(extent(plan), size, [top, right, bottom, left]);
  // the stage's width, or the readable width on a stage narrower than that (the host then scrolls sideways)
  const svgWidth = width * zoom > size.width + 0.5 ? width * zoom : size.width;
  const px = (col: number) => ox + col * cellW;
  const py = (row: number) => oy + row * cellH;
  const boxW = Math.max(64, Math.min(132, cellW * 0.66));
  const at = Object.fromEntries(plan.nodes.map(n => [n.unit, n]));

  // edge ends that sit HALF a cell from a unit's centre are moved onto that unit's border
  const pathOf = (edge: Edge): Array<[number, number]> => edge.points.map(([c, r], k) => {
    const end = k === 0 ? edge.from : k === edge.points.length - 1 ? edge.to : null;
    const node = end ? at[end] : undefined;
    let x = px(c);
    let y = py(r);
    if (node) {
      if (Math.abs(Math.abs(c - node.col) - HALF) < 1e-9 && r === node.row) x = px(node.col) + Math.sign(c - node.col) * boxW / 2;
      if (Math.abs(Math.abs(r - node.row) - HALF) < 1e-9 && c === node.col) y = py(node.row) + Math.sign(r - node.row) * BOX_H / 2;
    }
    return [x, y];
  });

  const unitBoxes: Box[] = plan.nodes.map(n => ({ x0: px(n.col) - boxW / 2, y0: py(n.row) - BOX_H / 2, x1: px(n.col) + boxW / 2, y1: py(n.row) + BOX_H / 2 }));
  const placed: Box[] = [];
  const valueOf = (stream: string) => {
    const s = streams[stream];
    return s ? `${formatWithUnit(s.solids_tph, 't/h', lang)} · ${formatWithUnit(s.grades[primary.species], primary.unit, lang)}` : '';
  };
  const edges = plan.edges.map((edge, k) => {
    const path = pathOf(edge);
    const text = valueOf(edge.stream);
    // the label goes by the longest segment: above a horizontal one, beside a vertical one
    let best = 0;
    let bestLength = -1;
    for (let i = 0; i + 1 < path.length; i += 1) {
      const length = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      if (length > bestLength) { bestLength = length; best = i; }
    }
    const [[ax, ay], [bx, by]] = [path[best], path[best + 1]];
    const w = text.length * LABEL_CHAR;
    const horizontal = Math.abs(by - ay) < 1e-6;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    // above the row of units first (a short edge between two units has no room of its own), then just
    // above or below the line; a product's label may also end at its arrow and a feed's start at its
    // tail, on the line or above the row
    const candidates: Array<{ x: number; y: number; anchor: 'middle' | 'start' | 'end' }> = horizontal
      ? [
        ...(edge.to === null ? [{ x: Math.max(ax, bx), y: my - 6, anchor: 'end' as const }, { x: Math.max(ax, bx), y: my - BOX_H / 2 - 5, anchor: 'end' as const }] : []),
        ...(edge.from === null ? [{ x: Math.min(ax, bx), y: my - 6, anchor: 'start' as const }, { x: Math.min(ax, bx), y: my - BOX_H / 2 - 5, anchor: 'start' as const }] : []),
        { x: mx, y: my - BOX_H / 2 - 5, anchor: 'middle' },
        { x: mx, y: my - 6, anchor: 'middle' },
        { x: mx, y: my + BOX_H / 2 + 13, anchor: 'middle' },
        ...(edge.to === null ? [{ x: Math.max(ax, bx), y: my + 14, anchor: 'end' as const }] : []),
      ]
      : [{ x: mx + 6, y: my + 3, anchor: 'start' }, { x: mx - 6, y: my + 3, anchor: 'end' }];
    let label: { x: number; y: number; anchor: 'middle' | 'start' | 'end' } | null = null;
    for (const c of candidates) {
      const bx0 = c.anchor === 'middle' ? c.x - w / 2 : c.anchor === 'start' ? c.x : c.x - w;
      const box = { x0: bx0 - 2, y0: c.y - 10, x1: bx0 + w + 2, y1: c.y + 3 };
      // inside the frame, so no label sits under an overlay (the focus route's readouts)
      if (box.x0 < frame.x0 || box.x1 > frame.x1 || box.y0 < frame.y0 || box.y1 > frame.y1 || [...unitBoxes, ...placed].some(b => overlaps(b, box))) continue;
      placed.push(box);
      label = c;
      break;
    }
    return { edge, key: `${edge.stream}-${k}`, path, text, label };
  });

  return (
    <div className="of-flowmap-host" ref={hostRef}>
      <svg className="of-flowmap" viewBox={`0 0 ${width} ${height}`} width={svgWidth} height={size.height} role="img" aria-label={summary}
        data-zoom={zoom.toFixed(3)} data-inset={`${top} ${right} ${bottom} ${left}`}>
        <defs>
          {(['plain', 'recycle', 'product'] as const).map(kind => (
            <marker key={kind} id={`of-arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`of-flow-arrow ${kind}`} />
            </marker>
          ))}
        </defs>
        {edges.map(({ edge, key, path, text, label }) => {
          const kind = edge.recycle ? 'recycle' : edge.to === null ? 'product' : 'plain';
          return (
            <g key={key} className={`of-flow-edge ${kind}`}>
              <title>{`${streamName(edge.stream, lang)}: ${text}`}</title>
              <polyline points={path.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" markerEnd={`url(#of-arrow-${kind})`} />
              {label && <text x={label.x} y={label.y} textAnchor={label.anchor} className="of-flow-label">{text}</text>}
            </g>
          );
        })}
        {plan.nodes.map(node => {
          const lines = nameLines(unitName(node.unit, lang), boxW);
          const cx = px(node.col);
          const cy = py(node.row);
          return (
            <g key={node.unit} className={`of-flow-unit${selected === node.unit ? ' selected' : ''}`} transform={`translate(${cx - boxW / 2},${cy - BOX_H / 2})`}
              role="button" tabIndex={0} aria-pressed={selected === node.unit} aria-label={unitName(node.unit, lang)}
              onClick={() => onSelect(selected === node.unit ? null : node.unit)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selected === node.unit ? null : node.unit); } }}>
              <rect width={boxW} height={BOX_H} rx={7} />
              {lines.map((line, i) => {
                // a single word longer than the box (Acondicionamiento) is condensed to fit, never clipped
                const fit = line.length * NAME_CHAR > boxW - 8 ? { textLength: boxW - 8, lengthAdjust: 'spacingAndGlyphs' as const } : {};
                return <text key={i} x={boxW / 2} y={BOX_H / 2 + 4 + (i - (lines.length - 1) / 2) * 12} textAnchor="middle" {...fit}>{line}</text>;
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
