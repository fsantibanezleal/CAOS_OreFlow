/**
 * The circuit as the trace describes it (PE-37): units from the topology, every stream labelled with its
 * solids flow and payable grade from the trace's stream records, recycles dashed, products as terminals.
 * The diagram measures its own box and lays the grid out in pixels up to a readable cell, so text keeps
 * its size on a small stage; a stage larger than that cell on both axes is filled by scaling the whole
 * drawing by one factor (flowsheet.ts, fit), so the circuit spans the stage at any viewport and its text
 * grows with it. The geometry and the label placement are flowsheet.ts's (drawing, labelTexts,
 * placeLabels): a label that would overlap a unit or another label, or sit clearly nearer another stream
 * than its own, is left out; every edge still carries its values as a hover title, and the unit panel
 * lists them. Selecting a unit reports it upward; the diagram computes nothing.
 */
import { useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { OverlayInset } from '../components/charts/inset';
import type { TopologyUnit } from '../engine/circuit';
import type { Trace } from '../engine/trace';
import type { Lang } from '../lib/format';
import { BOX_H, drawing, extent, fit, JUNCTIONS, labelTexts, layout, LINE, NAME_CHAR, NODE_R, placeCaptions, placeLabels } from './flowsheet';

const UNIT_NAMES: Record<string, [string, string]> = {
  crusher: ['Crusher', 'Chancador'], mill_feed_junction: ['Mill feed', 'Alimentación molino'], mill: ['Ball mill', 'Molino de bolas'],
  sump: ['Sump', 'Cajón'], cyclone: ['Cyclones', 'Ciclones'], underflow_return: ['Underflow return', 'Retorno de descarga'],
  gravity_split: ['Gravity bleed', 'Purga gravimétrica'], lims_link: ['LIMS feed', 'Alimentación LIMS'],
  lims_rougher: ['LIMS rougher', 'LIMS rougher'], lims_cleaner: ['LIMS cleaner', 'LIMS limpieza'], deslime: ['Desliming', 'Deslamado'],
  // D-20: the unit only adds dilution water to the rougher feed; the collector acts through the rate constants
  flotation_link: ['Dilution', 'Dilución'], rougher_junction: ['Rougher feed', 'Alimentación rougher'], rougher: ['Rougher', 'Rougher'],
  regrind: ['Regrind', 'Remolienda'], cleaner_junction: ['Cleaner feed', 'Alimentación limpieza'], cleaner: ['Cleaner', 'Limpieza'],
  recleaner_dilution: ['Recleaner feed', 'Alimentación relimpieza'], recleaner: ['Recleaner', 'Relimpieza'],
};

export const unitName = (unit: string, lang: Lang) => (UNIT_NAMES[unit] ? UNIT_NAMES[unit][lang === 'es' ? 1 : 0] : unit);

type StreamRecord = { solids_tph: number; water_tph: number; grades: Record<string, number> };

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
  const point = (trace.point ?? {}) as Record<string, number>;
  const plan = useMemo(() => layout(topology, concentrates, tails), [topology, concentrates, tails]);

  // the grid on the stage (flowsheet.ts): everything below is in the drawing's own px, which the viewBox
  // scales to the stage when the stage is larger than the readable cell on both axes
  const f = fit(extent(plan), size, [top, right, bottom, left]);
  const { zoom, ox, oy, cellW, cellH, width, height } = f;
  // the stage's width, or the readable width on a stage narrower than that (the host then scrolls sideways)
  const svgWidth = width * zoom > size.width + 0.5 ? width * zoom : size.width;
  const d = drawing(plan, f);
  const texts = labelTexts(plan, streams, primary, point, lang);
  const { labels, boxes } = placeLabels(plan, d, f.frame, texts.edges.map(e => e.options));
  const captions = placeCaptions(plan, d, f.frame, boxes, unit => unitName(unit, lang));
  const missing = labels.filter((l, k) => !l && texts.edges[k].options.length).length;
  // below the desktop stages only the outlets and the feed are promised a label (D-21, flowsheet-labels.test.ts)
  const outletsMissing = labels.filter((l, k) => !l && texts.edges[k].options.length && (plan.edges[k].to === null || plan.edges[k].from === null)).length;

  return (
    <div className="of-flowmap-host" ref={hostRef}>
      <svg className="of-flowmap" viewBox={`0 0 ${width} ${height}`} width={svgWidth} height={size.height} role="img" aria-label={summary}
        data-zoom={zoom.toFixed(3)} data-inset={`${top} ${right} ${bottom} ${left}`} data-labels-missing={missing} data-outlets-missing={outletsMissing}>
        <defs>
          {(['plain', 'recycle', 'product', 'tail'] as const).map(kind => (
            <marker key={kind} id={`of-arrow-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={`of-flow-arrow ${kind}`} />
            </marker>
          ))}
        </defs>
        {plan.edges.map((edge, k) => {
          // U-09: a concentrate leaves green; a tail leaves in the plain colour, never as a product
          const kind = edge.recycle ? 'recycle' : edge.to === null ? (concentrates.includes(edge.stream) ? 'product' : 'tail') : 'plain';
          const label = labels[k];
          return (
            <g key={`${edge.stream}-${k}`} className={`of-flow-edge ${kind}`}>
              <title>{texts.edges[k].title}</title>
              <polyline points={d.paths[k].map(([x, y]) => `${x},${y}`).join(' ')} fill="none" markerEnd={`url(#of-arrow-${kind})`} />
              {label && (
                <text x={label.x} y={label.y} textAnchor={label.anchor} className="of-flow-label">
                  {label.lines.map((line, i) => <tspan key={i} x={label.x} dy={i === 0 ? 0 : LINE}>{line}</tspan>)}
                </text>
              )}
            </g>
          );
        })}
        {plan.nodes.map(node => {
          const cx = ox + node.col * cellW;
          const cy = oy + node.row * cellH;
          const select = () => onSelect(selected === node.unit ? null : node.unit);
          const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } };
          const name = unitName(node.unit, lang);
          const cls = `of-flow-unit${JUNCTIONS.has(node.unit) ? ' of-flow-junction' : ''}${selected === node.unit ? ' selected' : ''}`;
          if (JUNCTIONS.has(node.unit)) {
            const caption = captions.find(c => c.unit === node.unit);
            return (
              <g key={node.unit} className={cls} role="button" tabIndex={0} aria-pressed={selected === node.unit} aria-label={name} onClick={select} onKeyDown={onKeyDown}>
                <title>{name}</title>
                <circle cx={cx} cy={cy} r={NODE_R} />
                {caption && <text x={cx} y={caption.y} textAnchor="middle" className="of-flow-junction-name">{name}</text>}
              </g>
            );
          }
          // D-04: the gravity bleed names its share of the underflow on a second line
          const lines = node.unit === 'gravity_split' && texts.bleedShare ? [name, `b = ${texts.bleedShare}`] : nameLines(name, d.boxW);
          return (
            <g key={node.unit} className={cls} transform={`translate(${cx - d.boxW / 2},${cy - BOX_H / 2})`}
              role="button" tabIndex={0} aria-pressed={selected === node.unit} aria-label={name} onClick={select} onKeyDown={onKeyDown}>
              <rect width={d.boxW} height={BOX_H} rx={7} />
              {lines.map((line, i) => {
                // a single word longer than the box is condensed to fit, never clipped
                const fitted = line.length * NAME_CHAR > d.boxW - 8 ? { textLength: d.boxW - 8, lengthAdjust: 'spacingAndGlyphs' as const } : {};
                return <text key={i} x={d.boxW / 2} y={BOX_H / 2 + 4 + (i - (lines.length - 1) / 2) * 12} textAnchor="middle" {...fitted}>{line}</text>;
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
