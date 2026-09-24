import type { Metrics, Params } from '../lib/contract.types';

type Stage = 'feed' | 'crush' | 'grind' | 'classify' | 'float' | 'product' | 'tail';
type Props = { active: Stage; onSelect: (stage: Stage) => void; metrics: Metrics; params: Params; es: boolean };

const nodes: Array<{ id: Stage; x: number; y: number; en: string; es: string; tone: string }> = [
  { id: 'feed', x: 90, y: 210, en: 'FEED', es: 'ALIMENTACIÓN', tone: 'ore' },
  { id: 'crush', x: 235, y: 210, en: 'CRUSH', es: 'TRITURACIÓN', tone: 'ore' },
  { id: 'grind', x: 380, y: 210, en: 'GRIND', es: 'MOLIENDA', tone: 'ore' },
  { id: 'classify', x: 525, y: 210, en: 'CLASSIFY', es: 'CLASIFICACIÓN', tone: 'water' },
  { id: 'float', x: 675, y: 210, en: 'ROUGHER', es: 'ROUGHER', tone: 'copper' },
  { id: 'product', x: 830, y: 112, en: 'CONCENTRATE', es: 'CONCENTRADO', tone: 'product' },
  { id: 'tail', x: 830, y: 320, en: 'TAILINGS', es: 'RELAVES', tone: 'tail' },
];

const fmt = (v: number, digits = 0) => Number.isFinite(v) ? v.toFixed(digits) : 'n/a';

export default function CircuitDiagram({ active, onSelect, metrics, params, es }: Props) {
  const overflowTph = params.feed_tph * (metrics.overflow_fraction ?? 0);
  const concTph = metrics.concentrate_tph ?? 0;
  const tailTph = Math.max(0, params.feed_tph - concTph);
  const facts: Record<Stage, string> = {
    feed: `${fmt(params.feed_tph)} t/h · ${fmt(params.feed_grade_pct, 2)}%`,
    crush: `P80 ${fmt(metrics.crusher_p80_um)} µm`,
    grind: `P80 ${fmt(params.grind_p80_um)} µm`,
    classify: `${fmt(overflowTph)} t/h ${es ? 'a finos' : 'to overflow'}`,
    float: `${fmt(metrics.recovery_pct, 1)}% ${es ? 'global' : 'overall'}`,
    product: `${fmt(concTph, 1)} t/h · ${fmt(metrics.concentrate_grade_pct, 2)}%`,
    tail: `${fmt(tailTph, 1)} t/h`,
  };
  const streams = [
    { d: 'M124 210H201', mass: params.feed_tph, tone: 'ore', text: `${fmt(params.feed_tph)} t/h`, x: 163, y: 185 },
    { d: 'M269 210H346', mass: params.feed_tph, tone: 'ore', text: '', x: 0, y: 0 },
    { d: 'M414 210H491', mass: params.feed_tph, tone: 'ore', text: '', x: 0, y: 0 },
    { d: 'M559 210H641', mass: overflowTph, tone: 'water', text: `${fmt(overflowTph)} t/h`, x: 600, y: 185 },
    { d: 'M525 244V337H760', mass: Math.max(0, params.feed_tph - overflowTph), tone: 'tail', text: '', x: 0, y: 0 },
    { d: 'M709 194L795 128', mass: concTph, tone: 'product', text: `${fmt(concTph, 1)} t/h`, x: 751, y: 137 },
    { d: 'M709 226L795 304', mass: Math.max(0, overflowTph - concTph), tone: 'tail', text: '', x: 0, y: 0 },
  ];
  return <div className="of-circuit-visual" data-testid="circuit-visual">
    <svg viewBox="0 0 920 430" role="img" aria-label={es ? 'Circuito de proceso con flujos de masa' : 'Process circuit with mass flow readouts'} preserveAspectRatio="xMidYMid meet">
      <defs><pattern id="of-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="var(--of-gridline)" strokeWidth="1" /></pattern></defs>
      <rect width="920" height="430" fill="url(#of-grid)" />
      <text x="30" y="38" className="of-svg-overline">{es ? 'BALANCE DE MASA / UNA PASADA' : 'MASS FLOW / ONE-PASS CIRCUIT'}</text>
      <text x="890" y="38" textAnchor="end" className="of-svg-overline">{es ? 'ESCENARIO ILUSTRATIVO' : 'ILLUSTRATIVE SCENARIO'}</text>
      {streams.map((stream, i) => <g key={i}><path d={stream.d} className={`of-stream of-stream-${stream.tone}`} strokeWidth={Math.max(2.5, 2.5 + 8 * stream.mass / Math.max(params.feed_tph, 1))} />{stream.text && <text x={stream.x} y={stream.y} textAnchor="middle" className="of-stream-label">{stream.text}</text>}</g>)}
      {nodes.map(node => <g key={node.id} role="button" tabIndex={0} aria-label={`${es ? node.es : node.en}: ${facts[node.id]}`} aria-pressed={node.id === active} className={`of-unit of-unit-${node.tone} ${node.id === active ? 'is-active' : ''}`} onClick={() => onSelect(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id); } }}>
        <circle cx={node.x} cy={node.y} r="35" className="of-unit-ring" />
        <circle cx={node.x} cy={node.y} r="27" className="of-unit-core" />
        <text x={node.x} y={node.y + 4} textAnchor="middle" className="of-unit-index">{String(nodes.indexOf(node) + 1).padStart(2, '0')}</text>
        <text x={node.x} y={node.y + 62} textAnchor="middle" className="of-unit-name">{es ? node.es : node.en}</text>
        <text x={node.x} y={node.y + 78} textAnchor="middle" className="of-unit-value">{facts[node.id]}</text>
      </g>)}
      <text x="30" y="403" className="of-svg-note">{es ? 'Seleccione una operación para inspeccionar su estado. Anchos de línea ∝ flujo másico.' : 'Select a unit to inspect its state. Line width ∝ solids mass flow.'}</text>
  </svg><div className="of-circuit-mobile"><span className="of-kicker">{es ? 'ALIMENTACIÓN → ROUGHER → PRODUCTOS' : 'FEED → ROUGHER → PRODUCTS'}</span><div className="of-mobile-units">{nodes.slice(0, 5).map((node, i) => <button type="button" key={node.id} className={`of-mobile-unit ${active === node.id ? 'active' : ''}`} onClick={() => onSelect(node.id)}><b>{String(i + 1).padStart(2, '0')}</b><span>{es ? node.es : node.en}</span><strong>{facts[node.id]}</strong></button>)}<div className="of-mobile-outlets">{nodes.slice(5).map(node => <button type="button" key={node.id} className={`of-mobile-unit ${active === node.id ? 'active' : ''}`} onClick={() => onSelect(node.id)}><b>{node.id === 'product' ? '06' : '07'}</b><span>{es ? node.es : node.en}</span><strong>{facts[node.id]}</strong></button>)}</div></div></div>
  </div>;
}
