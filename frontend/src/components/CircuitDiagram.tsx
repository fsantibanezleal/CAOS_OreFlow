import { useState } from "react";
import { Chart, type Series } from "./Charts";
import PartitionField from "./PartitionField";
import TopologyMap from "./TopologyMap";
import type { Params, Trace } from "../lib/contract.types";

type Stage = "feed" | "crush" | "grind" | "classify" | "gravity" | "magnetic" | "float" | "product" | "tail";
type Props = {
  active: Stage;
  onSelect: (stage: Stage) => void;
  trace: Trace;
  params: Params;
  es: boolean;
  live: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  onStep: (direction: -1 | 1) => void;
};

const stages: Array<{ id: Stage; en: string; es: string }> = [
  { id: "feed", en: "Feed", es: "Alimentación" },
  { id: "crush", en: "Crush", es: "Trituración" },
  { id: "grind", en: "Grind", es: "Molienda" },
  { id: "classify", en: "Classify", es: "Clasificación" },
  { id: "float", en: "Flotation", es: "Flotación" },
  { id: "product", en: "Products", es: "Productos" },
];
const gravityStages: typeof stages = [
  { id: "crush", en: "Crush", es: "Trituración" },
  { id: "grind", en: "Grind", es: "Molienda" },
  { id: "classify", en: "Classify", es: "Clasificación" },
  { id: "gravity", en: "Gravity", es: "Gravedad" },
  { id: "float", en: "Flotation", es: "Flotación" },
  { id: "product", en: "Products", es: "Productos" },
];
const magneticStages: typeof stages = [
  { id: "feed", en: "Ore feed", es: "Mineral" },
  { id: "crush", en: "Crush", es: "Trituración" },
  { id: "grind", en: "Grind", es: "Molienda" },
  { id: "magnetic", en: "Magnetic separation", es: "Separación magnética" },
  { id: "product", en: "Products", es: "Productos" },
];
const deslimeStages: typeof stages = stages.map(stage => stage.id === "classify" ? { id: "classify", en: "Deslime", es: "Deslamado" } : stage);

const number = (value: number, digits = 1) =>
  Number.isFinite(value) ? value.toFixed(digits) : "n/a";

function MassBar({
  label,
  value,
  total,
  unit,
  emphasis = false,
}: {
  label: string;
  value: number;
  total: number;
  unit: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`of-balance-row ${emphasis ? "is-emphasis" : ""}`}>
      <div><span>{label}</span><strong>{number(value)} <small>{unit}</small></strong></div>
      <div className="of-balance-track"><i style={{ width: `${Math.max(0, Math.min(100, 100 * value / Math.max(total, 1e-8)))}%` }} /></div>
    </div>
  );
}

export default function CircuitDiagram({
  active,
  onSelect,
  trace,
  params,
  es,
  live,
  playing,
  onTogglePlay,
  onStep,
}: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const m = trace.metrics;
  const hasGravity = (m.gravity_recovery_pct ?? 0) > 0;
  const hasMagnetic = (m.magnetic_recovery_pct ?? 0) > 0;
  const hasDeslime = trace.case_id.split(":")[0] === "phosphate_clay";
  const visibleStages = hasMagnetic ? magneticStages : hasGravity ? gravityStages : hasDeslime ? deslimeStages : stages;
  const feed = params.feed_tph;
  const overflow = feed * (m.overflow_fraction ?? 0);
  const underflow = Math.max(0, feed - overflow);
  const concentrate = Math.max(0, m.concentrate_tph ?? 0);
  const gravityProduct = Math.max(0, m.gravity_product_tph ?? 0);
  const rougherProduct = hasMagnetic ? 0 : Math.max(0, concentrate - gravityProduct);
  const gravityReject = Math.max(0, underflow - gravityProduct);
  const rougherTail = Math.max(0, (hasDeslime ? underflow : overflow) - rougherProduct);
  const slimes = hasDeslime ? overflow : 0;
  const tailings = hasMagnetic ? feed - concentrate : hasDeslime ? slimes + rougherTail : gravityReject + rougherTail;
  const feedMetal = feed * params.feed_grade_pct / 100;
  const concentrateMetal = concentrate * (m.concentrate_grade_pct ?? 0) / 100;
  const tailMetal = Math.max(0, feedMetal - concentrateMetal);
  const productView = active === "product" || active === "tail";

  const details: Record<Stage, { en: string; es: string; value: number; unit: string; digits?: number }> = {
    feed: {
      en: "Feed solids and head grade define the mass and valuable-metal basis.",
      es: "Los sólidos y la ley de alimentación definen la base de masa y metal valioso.",
      value: feed,
      unit: "t/h",
    },
    crush: {
      en: "The crusher product size is estimated from the feed and reduction setting.",
      es: "El tamaño de descarga se estima a partir de la alimentación y la reducción.",
      value: m.crusher_p80_um,
      unit: "µm",
      digits: 0,
    },
    grind: {
      en: "The target grind changes the full size distribution and specific energy.",
      es: "La molienda objetivo cambia la distribución de tamaños y la energía específica.",
      value: params.grind_p80_um,
      unit: "µm",
      digits: 0,
    },
    classify: {
      en: hasDeslime ? "Overflow carries clay slimes to reject; retained underflow feeds the phosphate rougher." : "Size-bin partition sends a fraction of solids to the rougher.",
      es: hasDeslime ? "El overflow retira lamas; el underflow retenido alimenta el rougher de fosfato." : "La partición por tamaño envía una fracción de sólidos al rougher.",
      value: 100 * (hasDeslime ? 1 - m.overflow_fraction : m.overflow_fraction),
      unit: "%",
    },
    gravity: {
      en: "Classifier underflow enters an authored size-window gravity branch; no GRG assay was fitted.",
      es: "Los gruesos entran a una rama gravimétrica con ventana granulométrica supuesta; sin ensayo GRG ajustado.",
      value: m.gravity_recovery_pct ?? 0,
      unit: "%",
    },
    magnetic: {
      en: "Ground ore enters a low-intensity magnetic-separation size-response proxy; field strength and liberation are not calibrated.",
      es: "El mineral molido entra a un proxy de separación magnética por tamaño; campo y liberación no están calibrados.",
      value: m.magnetic_recovery_pct ?? 0,
      unit: "%",
    },
    float: {
      en: hasDeslime ? "The rougher treats retained underflow; overflow is a separate slimes reject." : hasGravity ? "The rougher treats classifier overflow; gravity recovery is a separate branch." : "Overall recovery includes solids partition and conditional rougher kinetics.",
      es: hasDeslime ? "El rougher trata los gruesos retenidos; los finos son rechazo de lamas." : hasGravity ? "El rougher trata finos del clasificador; la recuperación gravimétrica es una rama separada." : "La recuperación global incluye partición de sólidos y cinética condicional del rougher.",
      value: hasGravity ? m.flotation_recovery_pct : m.recovery_pct,
      unit: "%",
    },
    product: {
      en: hasMagnetic ? "Magnetic concentrate and nonmagnetic tails close the one-pass balance." : hasGravity ? "Gravity and rougher products combine; both reject streams close the one-pass balance." : "Concentrate and tailings close the one-pass solids balance.",
      es: hasMagnetic ? "El concentrado magnético y el rechazo cierran el balance de una pasada." : hasGravity ? "Los productos gravimétrico y rougher se combinan; ambos rechazos cierran el balance." : "Concentrado y relaves cierran el balance de una pasada.",
      value: concentrate,
      unit: "t/h",
    },
    tail: {
      en: hasMagnetic ? "Nonmagnetic tailings are the feed less magnetic concentrate." : hasDeslime ? "Tailings combine discarded slimes and rougher reject." : "Tailings combine classifier underflow and rougher reject.",
      es: hasMagnetic ? "El rechazo no magnético es la alimentación menos el concentrado magnético." : hasDeslime ? "Los relaves combinan lamas descartadas y rechazo rougher." : "Los relaves combinan gruesos del clasificador y rechazo del rougher.",
      value: tailings,
      unit: "t/h",
    },
  };
  const detail = details[active];
  const sizeLabels = trace.size_um.map(size => `${number(size, 0)} µm`);
  let plotTitle = es ? "Distribución granulométrica" : "Particle-size distribution";
  let plotSubtitle = es ? "Pasante acumulado por tamaño" : "Cumulative passing by size";
  let series: Series[] = [];
  let labels = sizeLabels;
  let format = (value: number) => `${number(100 * value, 0)}%`;
  if (active === "feed") {
    series = [{ name: es ? "Alimentación" : "Feed", color: "var(--color-accent)", values: trace.feed_psd }];
  } else if (active === "crush") {
    series = [
      { name: es ? "Alimentación" : "Feed", color: "var(--color-fg-subtle)", values: trace.feed_psd },
      { name: es ? "Triturado" : "Crushed", color: "var(--color-accent)", values: trace.crushed_psd },
    ];
  } else if (active === "grind") {
    series = [
      { name: es ? "Triturado" : "Crushed", color: "var(--color-fg-subtle)", values: trace.crushed_psd },
      { name: es ? "Molido" : "Ground", color: "var(--color-accent)", values: trace.ground_psd },
    ];
  } else if (active === "classify") {
    plotSubtitle = hasDeslime ? (es ? "Finos retirados como lamas; gruesos retenidos" : "Overflow discarded as slimes; underflow retained") : (es ? "Finos normalizados por masa de la corriente" : "Overflow normalized by its stream mass");
    series = [
      { name: es ? "Molido" : "Ground", color: "var(--color-fg-subtle)", values: trace.ground_psd },
      { name: es ? "Finos" : "Overflow", color: "var(--color-accent)", values: trace.overflow_psd },
    ];
  } else if (active === "float") {
    plotTitle = es ? "Cinética de flotación" : "Flotation kinetics";
    plotSubtitle = hasGravity ? (es ? "Recuperación rougher adicional; la gravedad aporta la línea base" : "Additional rougher recovery; gravity contributes the baseline") : (es ? "Recuperación global frente al tiempo de residencia" : "Overall recovery versus residence time");
    labels = trace.flotation_recovery.map((_, i) => `${number(i * params.flotation_time_min / Math.max(trace.flotation_recovery.length - 1, 1), 1)} min`);
    series = [{ name: es ? "Recuperación" : "Recovery", color: "var(--color-accent)", values: trace.flotation_recovery }];
    format = (value: number) => `${number(100 * value, 1)}%`;
  } else if (active === "gravity") {
    plotTitle = es ? "Ventana de recuperación gravimétrica" : "Gravity-recovery size window";
    plotSubtitle = es ? "Fracción condicional supuesta de oro libre en gruesos; no calibrada" : "Authored conditional free-gold fraction in underflow; not calibrated";
    series = [{ name: es ? "Respuesta GRG" : "GRG response", color: "var(--color-accent)", values: trace.size_um.map(size => 0.82 * (1 - Math.exp(-size / 45)) * Math.exp(-size / 700)) }];
  } else if (active === "magnetic") {
    plotTitle = es ? "Captura magnética por tamaño" : "Magnetic capture by size";
    plotSubtitle = es ? "Ventana supuesta de captura; sin ajuste de susceptibilidad ni campo" : "Authored capture window; no susceptibility or field fit";
    series = [{ name: es ? "Captura LIMS" : "LIMS capture", color: "var(--color-accent)", values: trace.size_um.map(size => 0.91 * (1 - Math.exp(-size / 25)) * Math.exp(-size / 1800)) }];
  }

  return (
    <section className="of-process-studio" data-testid="circuit-visual">
      <div className="of-walkthrough" aria-label={es ? "Recorrido del circuito" : "Circuit walkthrough"}>
        <div><span className="of-kicker">{es ? "RECORRIDO DEL CIRCUITO" : "CIRCUIT WALKTHROUGH"}</span><strong>{Math.max(1, visibleStages.findIndex(stage => stage.id === active) + 1)} / {visibleStages.length}</strong></div>
        <div className="of-walkthrough-actions">
          <button type="button" onClick={() => onStep(-1)} aria-label={es ? "Etapa anterior" : "Previous stage"}>←</button>
          <button type="button" onClick={onTogglePlay}>{playing ? (es ? "Pausar" : "Pause") : (es ? "Reproducir" : "Play")}</button>
          <button type="button" onClick={() => onStep(1)} aria-label={es ? "Etapa siguiente" : "Next stage"}>→</button>
        </div>
        <small>{es ? "Secuencia de operaciones; no representa tiempo físico." : "Operation sequence; not physical time."}</small>
      </div>
      <div className="of-process-tabs" role="tablist" aria-label={es ? "Operaciones del circuito" : "Circuit operations"}>
        {visibleStages.map((stage, i) => (
          <button
            key={stage.id}
            type="button"
            role="tab"
            aria-selected={active === stage.id || (stage.id === "product" && active === "tail")}
            className={active === stage.id || (stage.id === "product" && active === "tail") ? "active" : ""}
            onClick={() => onSelect(stage.id)}
          >
            <small>{String(i + 1).padStart(2, "0")}</small>
            <span>{es ? stage.es : stage.en}</span>
            {i < visibleStages.length - 1 && <b aria-hidden="true">→</b>}
          </button>
        ))}
      </div>
      <div className="of-process-body" role="tabpanel">
        <div className={`of-process-analysis ${showDetail ? 'is-detail' : ''}`}>
          <TopologyMap trace={trace} params={params} active={active} es={es} onSelect={stage => onSelect(stage as Stage)} />
          <div className="of-process-heading">
            <div>
              <span className="of-kicker">{live ? (es ? "CÁLCULO LOCAL" : "LOCAL CALCULATION") : (es ? "ESCENARIO PRECOMPUTADO" : "PRECOMPUTED SCENARIO")}</span>
              <h2>{productView ? (es ? "Balance de productos" : "Product balance") : (es ? visibleStages.find(stage => stage.id === active)?.es : visibleStages.find(stage => stage.id === active)?.en)}</h2>
              <p>{es ? detail.es : detail.en}</p>
            </div>
            <div className="of-process-heading-actions"><output>{number(detail.value, detail.digits ?? 1)} <small>{detail.unit}</small></output><button type="button" onClick={() => setShowDetail(value => !value)}>{showDetail ? (es ? 'Ver circuito' : 'View circuit') : (es ? 'Inspeccionar respuesta' : 'Inspect response')}</button></div>
          </div>
          {productView ? (
            <div className="of-product-balance">
              <div className="of-product-chooser" role="group" aria-label={es ? "Corriente de producto" : "Product stream"}>
                <button type="button" className={active === "product" ? "active" : ""} onClick={() => onSelect("product")}>{es ? "Concentrado" : "Concentrate"}</button>
                <button type="button" className={active === "tail" ? "active" : ""} onClick={() => onSelect("tail")}>{es ? "Relaves" : "Tailings"}</button>
                <span>{es ? "Metal valioso contenido · t/h" : "Contained valuable metal · t/h"}</span>
              </div>
              <div className="of-metal-balance">
                <MassBar label={es ? "Alimentación" : "Feed"} value={feedMetal} total={feedMetal} unit="t/h" />
                {hasGravity && <MassBar label={es ? "Gravedad" : "Gravity"} value={feedMetal * m.gravity_recovery_pct / 100} total={feedMetal} unit="t/h" />}
                {hasMagnetic && <MassBar label={es ? "Separación magnética" : "Magnetic separation"} value={feedMetal * m.magnetic_recovery_pct / 100} total={feedMetal} unit="t/h" />}
                {hasGravity && <MassBar label={es ? "Rougher" : "Rougher"} value={feedMetal * m.flotation_recovery_pct / 100} total={feedMetal} unit="t/h" />}
                <MassBar label={es ? "Concentrado" : "Concentrate"} value={concentrateMetal} total={feedMetal} unit="t/h" emphasis={active === "product"} />
                <MassBar label={es ? "Relaves" : "Tailings"} value={tailMetal} total={feedMetal} unit="t/h" emphasis={active === "tail"} />
              </div>
            </div>
          ) : active === "classify" ? (
            <PartitionField trace={trace} es={es} deslime={hasDeslime} />
          ) : (
            <div className="of-process-plot">
              <Chart title={plotTitle} subtitle={plotSubtitle} labels={labels} series={series} height={110} format={format} />
            </div>
          )}
        </div>
        <aside className="of-process-ledger" aria-label={es ? "Balance de masa" : "Mass balance"}>
          <div className="of-ledger-title">
            <span className="of-kicker">{es ? "BASE DE SÓLIDOS" : "SOLIDS BASIS"}</span>
            <strong>{number(feed, 0)} t/h</strong>
          </div>
          {!hasMagnetic && <MassBar label={hasDeslime ? (es ? "Lamas descartadas" : "Discarded slimes") : (es ? "Finos al rougher" : "To rougher")} value={overflow} total={feed} unit="t/h" emphasis={active === "classify"} />}
          {!hasMagnetic && <MassBar label={hasDeslime ? (es ? "Gruesos al rougher" : "Underflow to rougher") : (es ? "Gruesos" : "Classifier underflow")} value={underflow} total={feed} unit="t/h" />}
          {hasMagnetic && <MassBar label={es ? "A separación magnética" : "To magnetic separation"} value={feed} total={feed} unit="t/h" emphasis={active === "magnetic"} />}
          {hasGravity && <MassBar label={es ? "Producto gravimétrico" : "Gravity product"} value={gravityProduct} total={feed} unit="t/h" emphasis={active === "gravity"} />}
          {hasGravity && <MassBar label={es ? "Producto rougher" : "Rougher product"} value={rougherProduct} total={feed} unit="t/h" emphasis={active === "float"} />}
          <MassBar label={es ? "Concentrado" : "Concentrate"} value={concentrate} total={feed} unit="t/h" emphasis={active === "product"} />
          <MassBar label={hasMagnetic ? (es ? "Rechazo no magnético" : "Nonmagnetic reject") : (es ? "Rechazo rougher" : "Rougher reject")} value={hasMagnetic ? tailings : rougherTail} total={feed} unit="t/h" />
          <div className="of-ledger-closure">
            <span>{es ? "Cierre de masa" : "Mass closure"}</span>
            <strong>{number(feed - concentrate - tailings, 3)} t/h</strong>
          </div>
          <p>{es ? "Escenario ilustrativo · una pasada · sin carga circulante." : "Illustrative scenario · one pass · no circulating load."}</p>
        </aside>
      </div>
    </section>
  );
}
