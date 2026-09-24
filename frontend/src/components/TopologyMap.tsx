import type { Params, Trace } from '../lib/contract.types';

type Node = { id: string; x: number; y: number; en: string; es: string; fact: string; tone: string };
type Edge = { from: string; to: string; mass: number; path: string; label?: string; lx?: number; ly?: number };
const fmt = (n: number, d = 0) => Number.isFinite(n) ? n.toFixed(d) : 'n/a';

export default function TopologyMap({ trace, params, active, es, onSelect }: {
  trace: Trace; params: Params; active: string; es: boolean; onSelect: (stage: string) => void;
}) {
  const id = trace.case_id.split(':')[0];
  const family = id === 'iron_magnetite_fine' ? 'magnetic' : id === 'gold_free_milling' ? 'gravity' : id === 'phosphate_clay' ? 'deslime' : 'rougher';
  const m = trace.metrics;
  const feed = params.feed_tph;
  const overflow = feed * m.overflow_fraction;
  const underflow = feed - overflow;
  const concentrate = m.concentrate_tph;
  const gravity = m.gravity_product_tph ?? 0;
  const rougherProduct = concentrate - gravity;
  const toRougher = family === 'deslime' ? underflow : overflow;
  const nodes: Node[] = family === 'magnetic' ? [
    { id:'feed', x:95,y:210,en:'FEED',es:'ALIMENTACIÓN',fact:`${fmt(feed)} t/h · ${fmt(params.feed_grade_pct,2)}%`,tone:'ore' },
    { id:'crush', x:270,y:210,en:'CRUSH',es:'TRITURACIÓN',fact:`P80 ${fmt(m.crusher_p80_um)} µm`,tone:'ore' },
    { id:'grind', x:445,y:210,en:'GRIND',es:'MOLIENDA',fact:`P80 ${fmt(params.grind_p80_um)} µm`,tone:'ore' },
    { id:'magnetic', x:625,y:210,en:'LIMS',es:'MAGNÉTICO',fact:`${fmt(m.magnetic_recovery_pct ?? 0,1)}% ${es ? 'recup.' : 'recovery'}`,tone:'water' },
    { id:'product', x:825,y:112,en:'CONCENTRATE',es:'CONCENTRADO',fact:`${fmt(concentrate,1)} t/h`,tone:'product' },
    { id:'tail', x:825,y:315,en:'REJECT',es:'RECHAZO',fact:`${fmt(feed-concentrate,1)} t/h`,tone:'tail' },
  ] : family === 'gravity' ? [
    { id:'feed', x:65,y:210,en:'FEED',es:'ALIMENTACIÓN',fact:`${fmt(feed)} t/h`,tone:'ore' },
    { id:'crush', x:190,y:210,en:'CRUSH',es:'TRITURACIÓN',fact:`P80 ${fmt(m.crusher_p80_um)} µm`,tone:'ore' },
    { id:'grind', x:315,y:210,en:'GRIND',es:'MOLIENDA',fact:`P80 ${fmt(params.grind_p80_um)} µm`,tone:'ore' },
    { id:'classify', x:440,y:210,en:'CLASSIFY',es:'CLASIFICAR',fact:`${fmt(overflow)} t/h ${es ? 'finos' : 'overflow'}`,tone:'water' },
    { id:'gravity', x:615,y:110,en:'GRAVITY',es:'GRAVEDAD',fact:`${fmt(gravity,1)} t/h ${es ? 'producto' : 'product'}`,tone:'product' },
    { id:'float', x:615,y:305,en:'ROUGHER',es:'ROUGHER',fact:`${fmt(m.flotation_recovery_pct,1)}%`,tone:'water' },
    { id:'product', x:835,y:110,en:'CONCENTRATE',es:'CONCENTRADO',fact:`${fmt(concentrate,1)} t/h`,tone:'product' },
    { id:'tail', x:835,y:305,en:'TAILINGS',es:'RELAVES',fact:`${fmt(feed-concentrate,1)} t/h`,tone:'tail' },
  ] : [
    { id:'feed', x:90,y:210,en:'FEED',es:'ALIMENTACIÓN',fact:`${fmt(feed)} t/h · ${fmt(params.feed_grade_pct,2)}%`,tone:'ore' },
    { id:'crush', x:235,y:210,en:'CRUSH',es:'TRITURACIÓN',fact:`P80 ${fmt(m.crusher_p80_um)} µm`,tone:'ore' },
    { id:'grind', x:380,y:210,en:'GRIND',es:'MOLIENDA',fact:`P80 ${fmt(params.grind_p80_um)} µm`,tone:'ore' },
    { id:'classify', x:525,y:210,en:family==='deslime'?'DESLIME':'CLASSIFY',es:family==='deslime'?'DESLAMAR':'CLASIFICAR',fact:`${fmt(toRougher)} t/h ${es ? 'a rougher' : 'to rougher'}`,tone:'water' },
    { id:'float', x:680,y:210,en:'ROUGHER',es:'ROUGHER',fact:`${fmt(m.recovery_pct,1)}% ${es ? 'global' : 'overall'}`,tone:'water' },
    { id:'product', x:835,y:110,en:'CONCENTRATE',es:'CONCENTRADO',fact:`${fmt(concentrate,1)} t/h · ${fmt(m.concentrate_grade_pct,2)}%`,tone:'product' },
    { id:'tail', x:835,y:310,en:family==='deslime'?'SLIMES + TAIL':'TAILINGS',es:family==='deslime'?'LAMAS + COLAS':'RELAVES',fact:`${fmt(feed-concentrate,1)} t/h`,tone:'tail' },
  ];
  const edges: Edge[] = family === 'magnetic' ? [
    {from:'feed',to:'crush',mass:feed,path:'M129 210H236',label:`${fmt(feed)} t/h`,lx:184,ly:184},
    {from:'crush',to:'grind',mass:feed,path:'M304 210H411'},
    {from:'grind',to:'magnetic',mass:feed,path:'M479 210H591'},
    {from:'magnetic',to:'product',mass:concentrate,path:'M659 194C730 194 755 110 801 110',label:`${fmt(concentrate,1)} t/h`,lx:739,ly:138},
    {from:'magnetic',to:'tail',mass:feed-concentrate,path:'M659 226C730 226 755 310 801 310'},
  ] : family === 'gravity' ? [
    {from:'feed',to:'crush',mass:feed,path:'M99 210H156',label:`${fmt(feed)} t/h`,lx:128,ly:183},
    {from:'crush',to:'grind',mass:feed,path:'M224 210H281'},
    {from:'grind',to:'classify',mass:feed,path:'M349 210H406'},
    {from:'classify',to:'gravity',mass:underflow,path:'M474 195C535 192 545 110 581 110',label:`${fmt(underflow)} t/h`,lx:535,ly:134},
    {from:'classify',to:'float',mass:overflow,path:'M474 225C535 230 545 305 581 305',label:`${fmt(overflow)} t/h`,lx:532,ly:285},
    {from:'gravity',to:'product',mass:gravity,path:'M649 110H801'},
    {from:'float',to:'product',mass:rougherProduct,path:'M649 291C744 281 729 145 801 126'},
    {from:'gravity',to:'tail',mass:underflow-gravity,path:'M649 125C748 145 729 275 801 291'},
    {from:'float',to:'tail',mass:overflow-rougherProduct,path:'M649 305H801'},
  ] : [
    {from:'feed',to:'crush',mass:feed,path:'M124 210H201',label:`${fmt(feed)} t/h`,lx:163,ly:184},
    {from:'crush',to:'grind',mass:feed,path:'M269 210H346'},
    {from:'grind',to:'classify',mass:feed,path:'M414 210H491'},
    {from:'classify',to:'float',mass:toRougher,path:'M559 210H646',label:`${fmt(toRougher)} t/h`,lx:602,ly:184},
    {from:'classify',to:'tail',mass:feed-toRougher,path:'M525 244V350H780L801 325'},
    {from:'float',to:'product',mass:concentrate,path:'M707 191C760 168 766 112 801 112',label:`${fmt(concentrate,1)} t/h`,lx:750,ly:137},
    {from:'float',to:'tail',mass:toRougher-concentrate,path:'M710 228C760 248 762 310 801 310'},
  ];
  return <div className="of-topology" aria-label={es ? 'Circuito y caudales de masa' : 'Circuit and mass flow'}>
    <svg viewBox="0 0 920 430" preserveAspectRatio="xMidYMid meet" role="img" aria-label={es ? 'Diagrama de proceso con balances de una pasada' : 'Process diagram with one-pass mass balances'}>
      <defs><pattern id="of-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="var(--of-gridline)" strokeWidth="1" /></pattern></defs>
      <rect width="920" height="430" fill="url(#of-grid)" />
      <text x="26" y="38" className="of-svg-overline">{es ? 'BALANCE DE SÓLIDOS / UNA PASADA' : 'SOLIDS BALANCE / ONE PASS'}</text>
      <text x="892" y="38" textAnchor="end" className="of-svg-overline">{family.toUpperCase()}</text>
      {edges.map((edge,i) => <g key={`${edge.from}-${edge.to}-${i}`}>
        <path d={edge.path} className={`of-stream ${edge.to === 'product' ? 'of-stream-product' : edge.to === 'tail' ? 'of-stream-tail' : 'of-stream-ore'}`} strokeWidth={Math.max(2.5,2.5+8*Math.max(0,edge.mass)/Math.max(feed,1))} />
        {edge.label && <text x={edge.lx} y={edge.ly} className="of-stream-label" textAnchor="middle">{edge.label}</text>}
      </g>)}
      {nodes.map((node,i) => <g key={node.id} role="button" tabIndex={0} aria-label={`${es ? node.es : node.en}: ${node.fact}`} aria-pressed={node.id===active} className={`of-unit of-unit-${node.tone} ${node.id===active?'is-active':''}`} onClick={() => onSelect(node.id)} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') {e.preventDefault();onSelect(node.id);} }}>
        <circle cx={node.x} cy={node.y} r="35" className="of-unit-ring" />
        <circle cx={node.x} cy={node.y} r="27" className="of-unit-core" />
        <text x={node.x} y={node.y+4} textAnchor="middle" className="of-unit-index">{String(i+1).padStart(2,'0')}</text>
        <text x={node.x} y={node.y+62} textAnchor="middle" className="of-unit-name">{es ? node.es : node.en}</text>
        <text x={node.x} y={node.y+78} textAnchor="middle" className="of-unit-value">{node.fact}</text>
      </g>)}
      <text x="26" y="407" className="of-svg-note">{es ? 'Seleccione una operación. Ancho de línea ∝ caudal de sólidos.' : 'Select an operation. Line width ∝ solids flow.'}</text>
    </svg>
    <div className="of-topology-mobile">{nodes.map((node,i) => <button key={node.id} type="button" className={active===node.id?'active':''} onClick={() => onSelect(node.id)}><b>{String(i+1).padStart(2,'0')}</b><span>{es ? node.es : node.en}</span><strong>{node.fact}</strong></button>)}</div>
  </div>;
}
