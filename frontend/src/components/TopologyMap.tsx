import type { Params, Trace } from "../lib/contract.types";

type Node = { id: string; x: number; y: number; en: string; es: string };
type Edge = { from: string; to: string; mass: number; stage: string; bend?: "up" | "down" };

export default function TopologyMap({ trace, params, active, es, onSelect }: {
  trace: Trace; params: Params; active: string; es: boolean; onSelect: (stage: string) => void;
}) {
  const family = trace.case_id.split(":")[0] === "iron_magnetite_fine" ? "magnetic" : trace.case_id.split(":")[0] === "gold_free_milling" ? "gravity" : trace.case_id.split(":")[0] === "phosphate_clay" ? "deslime" : "rougher";
  const feed = params.feed_tph;
  const overflow = feed * trace.metrics.overflow_fraction;
  const concentrate = trace.metrics.concentrate_tph;
  const gravityProduct = trace.metrics.gravity_product_tph ?? 0;
  const rougherProduct = concentrate - gravityProduct;
  let nodes: Node[];
  let edges: Edge[];
  if (family === "gravity") {
    nodes = [
      { id: "feed", x: 48, y: 67, en: "ORE", es: "MINERAL" },
      { id: "crush", x: 167, y: 67, en: "CRUSH", es: "TRITURAR" },
      { id: "grind", x: 287, y: 67, en: "GRIND", es: "MOLER" },
      { id: "classify", x: 437, y: 67, en: "CLASSIFY", es: "CLASIFICAR" },
      { id: "gravity", x: 615, y: 24, en: "GRAVITY", es: "GRAVEDAD" },
      { id: "float", x: 615, y: 108, en: "ROUGHER", es: "ROUGHER" },
      { id: "product", x: 839, y: 45, en: "PRODUCTS", es: "PRODUCTOS" },
      { id: "tail", x: 839, y: 112, en: "TAILINGS", es: "RELAVES" },
    ];
    edges = [
      { from: "feed", to: "crush", mass: feed, stage: "crush" },
      { from: "crush", to: "grind", mass: feed, stage: "grind" },
      { from: "grind", to: "classify", mass: feed, stage: "classify" },
      { from: "classify", to: "gravity", mass: feed - overflow, stage: "gravity", bend: "up" },
      { from: "classify", to: "float", mass: overflow, stage: "float", bend: "down" },
      { from: "gravity", to: "product", mass: gravityProduct, stage: "product", bend: "down" },
      { from: "float", to: "product", mass: rougherProduct, stage: "product", bend: "up" },
      { from: "gravity", to: "tail", mass: feed - overflow - gravityProduct, stage: "tail", bend: "down" },
      { from: "float", to: "tail", mass: overflow - rougherProduct, stage: "tail" },
    ];
  } else if (family === "magnetic") {
    nodes = [
      { id: "feed", x: 50, y: 67, en: "ORE", es: "MINERAL" },
      { id: "crush", x: 235, y: 67, en: "CRUSH", es: "TRITURAR" },
      { id: "grind", x: 425, y: 67, en: "GRIND", es: "MOLER" },
      { id: "magnetic", x: 620, y: 67, en: "LIMS", es: "LIMS" },
      { id: "product", x: 839, y: 30, en: "MAGNETIC", es: "MAGNÉTICO" },
      { id: "tail", x: 839, y: 109, en: "REJECT", es: "RECHAZO" },
    ];
    edges = [
      { from: "feed", to: "crush", mass: feed, stage: "crush" },
      { from: "crush", to: "grind", mass: feed, stage: "grind" },
      { from: "grind", to: "magnetic", mass: feed, stage: "magnetic" },
      { from: "magnetic", to: "product", mass: concentrate, stage: "product", bend: "up" },
      { from: "magnetic", to: "tail", mass: feed - concentrate, stage: "tail", bend: "down" },
    ];
  } else {
    nodes = [
      { id: "feed", x: 47, y: 63, en: "ORE", es: "MINERAL" },
      { id: "crush", x: 205, y: 63, en: "CRUSH", es: "TRITURAR" },
      { id: "grind", x: 360, y: 63, en: "GRIND", es: "MOLER" },
      { id: "classify", x: 522, y: 63, en: family === "deslime" ? "DESLIME" : "CLASSIFY", es: family === "deslime" ? "DESLAMAR" : "CLASIFICAR" },
      { id: "float", x: 690, y: 63, en: "ROUGHER", es: "ROUGHER" },
      { id: "product", x: 848, y: 28, en: "PRODUCT", es: "PRODUCTO" },
      { id: "tail", x: 848, y: 108, en: family === "deslime" ? "SLIMES + TAIL" : "TAILINGS", es: family === "deslime" ? "LAMAS + COLAS" : "RELAVES" },
    ];
    const toRougher = family === "deslime" ? feed - overflow : overflow;
    edges = [
      { from: "feed", to: "crush", mass: feed, stage: "crush" },
      { from: "crush", to: "grind", mass: feed, stage: "grind" },
      { from: "grind", to: "classify", mass: feed, stage: "classify" },
      { from: "classify", to: "float", mass: toRougher, stage: "float" },
      { from: "classify", to: "tail", mass: feed - toRougher, stage: "tail", bend: "down" },
      { from: "float", to: "product", mass: concentrate, stage: "product", bend: "up" },
      { from: "float", to: "tail", mass: toRougher - concentrate, stage: "tail", bend: "down" },
    ];
  }
  const byId = Object.fromEntries(nodes.map(node => [node.id, node]));
  const path = (edge: Edge) => {
    const a = byId[edge.from]; const b = byId[edge.to];
    const start = a.x + 48; const end = b.x - 48;
    return edge.bend ? `M ${start} ${a.y} C ${start + 70} ${a.y}, ${end - 70} ${b.y}, ${end} ${b.y}` : `M ${start} ${a.y} L ${end} ${b.y}`;
  };
  return <div className="of-topology" aria-label={es ? "Topología y caudales del circuito" : "Circuit topology and mass flows"}>
    <svg viewBox="0 0 920 138" preserveAspectRatio="none" role="img" aria-label={es ? "Ramas y caudales; no representa tiempo físico" : "Branches and mass flows; not physical time"}>
      {edges.map((edge, i) => <g key={`${edge.from}-${edge.to}-${i}`}>
        <path d={path(edge)} fill="none" stroke="var(--color-border)" strokeWidth={Math.max(2, 1 + 7 * edge.mass / Math.max(feed, 1))} strokeLinecap="round" />
        <path className={`of-flow-path ${active === edge.stage ? 'active' : ''}`} d={path(edge)} fill="none" stroke="var(--color-accent)" strokeWidth={Math.max(1.5, 0.8 + 5 * edge.mass / Math.max(feed, 1))} strokeLinecap="round" strokeDasharray="8 12" />
        <title>{`${edge.mass.toFixed(1)} t/h`}</title>
      </g>)}
      {nodes.map(node => <g key={node.id} className={`of-topology-node ${active === node.id ? 'active' : ''}`} role="button" tabIndex={0} aria-label={`${es ? node.es : node.en} ${node.id === "product" ? `${concentrate.toFixed(1)} t/h` : node.id === "feed" ? `${feed.toFixed(1)} t/h` : ""}`} onClick={() => onSelect(node.id)} onKeyDown={event => { if (event.key === 'Enter') onSelect(node.id); }}>
        <rect x={node.x - 49} y={node.y - 16} width="98" height="32" rx="4" />
        <text x={node.x} y={node.y + 4} textAnchor="middle">{es ? node.es : node.en}</text>
      </g>)}
    </svg>
    <span>{es ? "Ancho = caudal relativo · ramas calculadas" : "Width = relative solids flow · calculated branches"}</span>
  </div>;
}
