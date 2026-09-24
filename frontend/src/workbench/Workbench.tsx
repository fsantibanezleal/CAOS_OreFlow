import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useShellLang } from "@fasl-work/caos-app-shell";
import { loadBenchmark, loadCase, loadIndex } from "../api/artifacts";
import type {
  Benchmark,
  CaseArtifact,
  CaseIndex,
  Params,
  Variant,
} from "../lib/contract.types";
import { alternativeKinetics, simulateLive } from "../live/engine";
import { Chart } from "../components/Charts";
import CircuitDiagram from "../components/CircuitDiagram";
import DecisionSurface from "../components/DecisionSurface";
import MethodVisual from "../components/MethodVisual";
import { localizedCase, localizedVariant } from "../lib/locale";

type Stage =
  | "feed"
  | "crush"
  | "grind"
  | "classify"
  | "float"
  | "product"
  | "tail";
type View =
  | "circuit"
  | "response"
  | "surface"
  | "methods"
  | "compare"
  | "controls";
type Group = "size" | "separation" | "flotation";
const fmt = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "n/a" : n.toFixed(digits);
const controls: Record<
  string,
  {
    en: string;
    es: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    group: Group;
  }
> = {
  feed_tph: {
    en: "Feed rate",
    es: "Alimentación",
    unit: "t/h",
    min: 100,
    max: 1800,
    step: 10,
    group: "size",
  },
  grind_p80_um: {
    en: "Grind P80",
    es: "P80 molienda",
    unit: "µm",
    min: 35,
    max: 500,
    step: 5,
    group: "size",
  },
  classifier_cut_um: {
    en: "Classifier cut",
    es: "Corte de clasificación",
    unit: "µm",
    min: 25,
    max: 400,
    step: 5,
    group: "separation",
  },
  water_m3_t: {
    en: "Water intensity",
    es: "Intensidad de agua",
    unit: "m³/t",
    min: 0.5,
    max: 5,
    step: 0.1,
    group: "separation",
  },
  flotation_time_min: {
    en: "Rougher residence",
    es: "Residencia rougher",
    unit: "min",
    min: 4,
    max: 55,
    step: 1,
    group: "flotation",
  },
  reagent_gpt: {
    en: "Collector dose",
    es: "Dosis colector",
    unit: "g/t",
    min: 20,
    max: 600,
    step: 5,
    group: "flotation",
  },
  air_rate_m3_min: {
    en: "Air rate",
    es: "Caudal de aire",
    unit: "m³/min",
    min: 0.2,
    max: 6,
    step: 0.1,
    group: "flotation",
  },
};
const views: Array<{ id: View; en: string; es: string }> = [
  { id: "circuit", en: "Circuit", es: "Circuito" },
  { id: "response", en: "Response", es: "Respuesta" },
  { id: "surface", en: "Decision surface", es: "Superficie de decisión" },
  { id: "methods", en: "Methods", es: "Métodos" },
  { id: "compare", en: "Compare", es: "Comparar" },
  { id: "controls", en: "Controls", es: "Controles" },
];
const stages: Record<
  Stage,
  { en: string; es: string; detail: readonly [string, string]; unit: string }
> = {
  feed: {
    en: "Feed",
    es: "Alimentación",
    detail: [
      "Scenario solids flow and head grade",
      "Caudal de sólidos y ley de alimentación del escenario",
    ],
    unit: "t/h",
  },
  crush: {
    en: "Crushing",
    es: "Trituración",
    detail: [
      "Estimated crusher product P80",
      "P80 estimado del producto de trituración",
    ],
    unit: "µm",
  },
  grind: {
    en: "Grinding",
    es: "Molienda",
    detail: [
      "Target mill product P80",
      "P80 objetivo del producto de molienda",
    ],
    unit: "µm",
  },
  classify: {
    en: "Classification",
    es: "Clasificación",
    detail: [
      "One-pass solids fraction to overflow",
      "Fracción de sólidos hacia overflow en una pasada",
    ],
    unit: "%",
  },
  float: {
    en: "Rougher",
    es: "Rougher",
    detail: [
      "Overall valuable mineral recovery",
      "Recuperación global del mineral valioso",
    ],
    unit: "%",
  },
  product: {
    en: "Concentrate",
    es: "Concentrado",
    detail: ["Concentrate solids flow", "Caudal de sólidos del concentrado"],
    unit: "t/h",
  },
  tail: {
    en: "Tailings",
    es: "Relaves",
    detail: ["Remaining solids flow", "Caudal de sólidos restante"],
    unit: "t/h",
  },
};
const methodContext: Record<string, string> = {
  rittinger: "Surface-area scaling with an authored research coefficient.",
  kick: "Coarse reduction-ratio scaling; compare within this law.",
  bond: "Work-index energy law using the case hardness.",
  whiten: "Crusher product-size proxy; geometry is not fitted.",
  pbm: "Compact distribution proxy, not a fitted breakage kernel.",
  partition: "One-pass solids split calculated from size-bin masses.",
  plitt: "Cut-size proxy with water, density and feed factors.",
  first_order: "Single-population rougher kinetic recovery.",
  kelsall: "Fast/slow kinetic comparison.",
  compressed_exponential: "Alternative kinetic shape.",
  mass_balance: "One-stage conservation check.",
  constrained_opt: "Weighted bounded search, not plant economics.",
  robust_mc: "Seeded perturbation, not calibrated uncertainty.",
  ridge: "Simulator-trained linear surrogate.",
  random_forest: "Simulator-trained nonlinear surrogate.",
  hist_gradient_boosting: "Simulator-trained boosted surrogate.",
  gaussian_process: "Simulator-trained local surrogate.",
  mlp: "Offline-trained neural surrogate.",
  autoencoder: "Feature reconstruction diagnostic.",
};
const methodSpanish: Record<string, [string, string]> = {
  rittinger: [
    "Ley de superficie de Rittinger",
    "Escalamiento energético por superficie creada; coeficiente ilustrativo.",
  ],
  kick: [
    "Ley de semejanza de Kick",
    "Escalamiento energético por razón de reducción gruesa.",
  ],
  bond: [
    "Ley del índice de trabajo de Bond",
    "Energía estimada con la dureza definida para este caso.",
  ],
  whiten: [
    "Proxy de trituradora estilo Whiten",
    "Tamaño de producto estimado sin geometría de equipo calibrada.",
  ],
  pbm: [
    "Proxy de distribución de molienda",
    "Distribución acumulativa, no un kernel de ruptura calibrado.",
  ],
  partition: [
    "Partición logística",
    "Fracción de sólidos que pasa a overflow, calculada por clases de tamaño.",
  ],
  plitt: [
    "Proxy de corte estilo Plitt",
    "Corte con factores de agua, densidad y caudal de alimentación.",
  ],
  first_order: [
    "Cinética de primer orden",
    "Recuperación global con una población cinética.",
  ],
  kelsall: [
    "Cinética rápida/lenta de Kelsall",
    "Comparación de dos poblaciones cinéticas.",
  ],
  compressed_exponential: [
    "Cinética exponencial comprimida",
    "Forma cinética alternativa para comparar trayectorias.",
  ],
  mass_balance: [
    "Balance de masa del circuito",
    "Cierre algebraico de una etapa; no validación de planta.",
  ],
  constrained_opt: [
    "Búsqueda acotada en grilla",
    "Objetivo ponderado, no economía ni óptimo de planta.",
  ],
  robust_mc: [
    "Ensamble de perturbaciones",
    "Variación sembrada de parámetros, no incertidumbre calibrada.",
  ],
  ridge: [
    "Sustituto ridge",
    "Modelo lineal entrenado con salidas del simulador.",
  ],
  random_forest: [
    "Sustituto bosque aleatorio",
    "Modelo no lineal entrenado con el simulador.",
  ],
  hist_gradient_boosting: [
    "Sustituto boosting",
    "Modelo aditivo entrenado con el simulador.",
  ],
  gaussian_process: [
    "Sustituto proceso gaussiano",
    "Modelo local entrenado con el simulador.",
  ],
  mlp: [
    "Sustituto neuronal MLP",
    "Red entrenada fuera del navegador con salidas del simulador.",
  ],
  autoencoder: [
    "Diagnóstico de reconstrucción",
    "Error de reconstrucción de variables; no probabilidad de falla.",
  ],
};
const domainSpanish: Record<string, string> = {
  comminution: 'CONMINUCIÓN', grinding: 'MOLIENDA', classification: 'CLASIFICACIÓN', flotation: 'FLOTACIÓN', circuit: 'CIRCUITO', surrogate: 'SUSTITUTO', diagnostics: 'DIAGNÓSTICO',
};
const tierSpanish: Record<string, string> = {
  classical: 'CLÁSICO', integration: 'INTEGRACIÓN', optimization: 'OPTIMIZACIÓN', uncertainty: 'PERTURBACIÓN', learned: 'APRENDIDO', frontier: 'EXPLORATORIO',
};

export default function Workbench() {
  const es = useShellLang() === "es";
  const [index, setIndex] = useState<CaseIndex | null>(null);
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [caseData, setCaseData] = useState<CaseArtifact | null>(null);
  const [caseId, setCaseId] = useState("");
  const [variantId, setVariantId] = useState("nominal");
  const [params, setParams] = useState<Params | null>(null);
  const [view, setView] = useState<View>("circuit");
  const [group, setGroup] = useState<Group>("size");
  const [stageId, setStageId] = useState<Stage>("classify");
  const [response, setResponse] = useState<"size" | "kinetics">("size");
  const [methodId, setMethodId] = useState("partition");
  const [compareMetric, setCompareMetric] = useState<
    | "recovery_pct"
    | "concentrate_grade_pct"
    | "specific_energy_kwh_t"
    | "water_use_m3_h"
  >("recovery_pct");
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([loadIndex(), loadBenchmark()])
      .then(([ix, b]) => {
        setIndex(ix);
        setBenchmark(b);
        setCaseId(ix.cases[0]?.case_id ?? "");
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!caseId) return;
    let valid = true;
    loadCase(caseId)
      .then((data) => {
        if (!valid) return;
        setCaseData(data);
        setVariantId(data.variants[0]?.id ?? "");
        setParams(data.variants[0]?.params ?? null);
      })
      .catch((e) => {
        if (valid) setError(String(e));
      });
    return () => {
      valid = false;
    };
  }, [caseId]);
  const variant: Variant | undefined = caseData?.variants.find(
    (v) => v.id === variantId,
  );
  const dirty = Boolean(
    variant &&
      params &&
      Object.keys(controls).some(
        (k) => Math.abs((params[k] ?? 0) - (variant.params[k] ?? 0)) > 1e-8,
      ),
  );
  const live = useMemo(
    () => (params && caseId ? simulateLive(params, caseId) : null),
    [params, caseId],
  );
  const shown = dirty ? live : variant?.trace;
  const categories = useMemo(() => {
    const g: Record<string, CaseIndex["cases"]> = {};
    index?.cases.forEach((c) => (g[c.category] ??= []).push(c));
    return g;
  }, [index]);
  const methodGroups = useMemo(() => {
    const g: Record<string, Variant["method_outputs"]> = {};
    variant?.method_outputs.forEach((m) => (g[m.domain] ??= []).push(m));
    return g;
  }, [variant]);
  const method = variant?.method_outputs.find((m) => m.id === methodId);
  const liveMethods: Record<
    string,
    { value: number | undefined; unit: string }
  > = {
    rittinger: { value: live?.metrics.energy_rittinger_kwh_t, unit: "kWh/t" },
    kick: { value: live?.metrics.energy_kick_kwh_t, unit: "kWh/t" },
    bond: { value: live?.metrics.energy_bond_kwh_t, unit: "kWh/t" },
    whiten: { value: live?.metrics.crusher_p80_um, unit: "µm" },
    pbm: { value: params?.grind_p80_um, unit: "µm" },
    partition: {
      value:
        live?.metrics.overflow_fraction === undefined
          ? undefined
          : live.metrics.overflow_fraction * 100,
      unit: "%",
    },
    plitt: { value: live?.metrics.cyclone_d50_um, unit: "µm" },
    first_order: { value: live?.metrics.recovery_pct, unit: "%" },
    kelsall: {
      value:
        live && params
          ? alternativeKinetics(
              params,
              live.metrics.overflow_fraction,
              "kelsall",
            ).at(-1)! * 100
          : undefined,
      unit: "%",
    },
    compressed_exponential: {
      value:
        live && params
          ? alternativeKinetics(
              params,
              live.metrics.overflow_fraction,
              "compressed_exponential",
            ).at(-1)! * 100
          : undefined,
      unit: "%",
    },
    mass_balance: { value: live?.metrics.metal_balance_pct, unit: "%" },
  };
  const methodLive = dirty && methodId in liveMethods;
  const methodValue = methodLive ? liveMethods[methodId].value : method?.value;
  const methodUnit = methodLive ? liveMethods[methodId].unit : method?.unit;
  const selectVariant = (id: string) => {
    const next = caseData?.variants.find((v) => v.id === id);
    if (next) {
      setVariantId(id);
      setParams(next.params);
    }
  };
  const changeParam = (key: string, value: number) =>
    setParams((p) => (p ? { ...p, [key]: value } : p));
  const stage = stages[stageId];
  const stageValue =
    stageId === "feed"
      ? params?.feed_tph
      : stageId === "crush"
        ? shown?.metrics.crusher_p80_um
        : stageId === "grind"
          ? params?.grind_p80_um
          : stageId === "classify"
            ? (shown?.metrics.overflow_fraction ?? 0) * 100
            : stageId === "float"
              ? shown?.metrics.recovery_pct
              : stageId === "product"
                ? shown?.metrics.concentrate_tph
                : (params?.feed_tph ?? 0) -
                  (shown?.metrics.concentrate_tph ?? 0);
  const readouts: Array<[string, number, string, number]> = group === "size"
    ? [
        [es ? "Energía específica" : "Specific energy", shown?.metrics.specific_energy_kwh_t ?? 0, "kWh/t", 1],
        [es ? "P80 trituración" : "Crusher P80", shown?.metrics.crusher_p80_um ?? 0, "µm", 0],
        [es ? "Concentrado" : "Concentrate", shown?.metrics.concentrate_tph ?? 0, "t/h", 1],
      ]
    : group === "separation"
      ? [
          [es ? "Fracción a finos" : "Overflow fraction", (shown?.metrics.overflow_fraction ?? 0) * 100, "%", 1],
          [es ? "Corte efectivo d50" : "Effective cut d50", shown?.metrics.cyclone_d50_um ?? 0, "µm", 1],
          [es ? "Sólidos al rougher" : "Solids to rougher", (shown?.metrics.overflow_fraction ?? 0) * (params?.feed_tph ?? 0), "t/h", 0],
        ]
      : [
          [es ? "Recuperación global" : "Overall recovery", shown?.metrics.recovery_pct ?? 0, "%", 1],
          [es ? "Ley concentrado" : "Concentrate grade", shown?.metrics.concentrate_grade_pct ?? 0, "%", 2],
          [es ? "Concentrado" : "Concentrate", shown?.metrics.concentrate_tph ?? 0, "t/h", 1],
        ];
  const rail = (
    <aside className="of-controls-panel">
      <div className="of-controls-head">
        <div>
          <span className="of-kicker">
            {es ? "PARÁMETROS DEL ESCENARIO" : "SCENARIO PARAMETERS"}
          </span>
          <h2>{es ? "Punto de operación" : "Operating point"}</h2>
        </div>
        <button
          type="button"
          className="of-text-button"
          disabled={!dirty}
          onClick={() => variant && setParams(variant.params)}
        >
          {es ? "Restaurar" : "Reset"}
        </button>
      </div>
      <div className="of-control-groups" role="tablist">
        {(["size", "separation", "flotation"] as Group[]).map((g) => (
          <button
            type="button"
            role="tab"
            aria-selected={group === g}
            className={group === g ? "active" : ""}
            key={g}
            onClick={() => setGroup(g)}
          >
            {g === "size"
              ? es
                ? "Masa / tamaño"
                : "Mass / size"
              : g === "separation"
                ? es
                  ? "Clasificación"
                  : "Classification"
                : es
                  ? "Flotación"
                  : "Flotation"}
          </button>
        ))}
      </div>
      <div className="of-control-list">
        {Object.entries(controls)
          .filter(([, c]) => c.group === group)
          .map(([key, c]) => (
            <label className="of-control" key={key}>
              <span>
                <b>{es ? c.es : c.en}</b>
                <output>
                  {fmt(params?.[key], c.step < 1 ? 1 : 0)}{" "}
                  <small>{c.unit}</small>
                </output>
              </span>
              <input
                aria-label={es ? c.es : c.en}
                type="range"
                min={c.min}
                max={c.max}
                step={c.step}
                value={params?.[key] ?? c.min}
                onChange={(e) => changeParam(key, Number(e.target.value))}
              />
            </label>
          ))}
      </div>
      <div className="of-control-readouts" aria-label={es ? "Resultados vinculados" : "Linked results"}>
        <span className="of-kicker">{es ? "RESPUESTA VINCULADA" : "LINKED RESPONSE"}</span>
        {readouts.map(([label, value, unit, digits]) => (
          <div key={label}><span>{label}</span><strong>{fmt(value, digits)} <small>{unit}</small></strong></div>
        ))}
      </div>
      <p className="of-controls-explain">
        {group === "size"
          ? es
            ? "Caudal controla masa; P80 controla tamaño y energía."
            : "Rate controls mass; P80 controls size and energy."
          : group === "separation"
            ? es
              ? "La partición actúa en cada clase de tamaño."
              : "Partition acts on each size class."
            : es
              ? "Tiempo, colector y aire controlan la cinética del rougher."
              : "Time, collector and air control rougher kinetics."}
      </p>
      <div className="of-rail-note">
        {dirty
          ? es
            ? "Motor local · ilustrativo"
            : "Local engine · illustrative"
          : es
            ? "Artefacto precomputado"
            : "Precomputed artifact"}
      </div>
    </aside>
  );

  return (
    <div className="of-page of-workbench">
      <div className="of-workbench-toolbar">
        <div className="of-workbench-identity">
          <span className="of-kicker">
            OREFLOW / {es ? "PROCESAMIENTO MINERAL" : "MINERAL PROCESSING"}
          </span>
          <strong>
            {caseData
              ? localizedCase(caseData.case_id, caseData.title, es)
              : es
                ? "Cargando…"
                : "Loading…"}
          </strong>
        </div>
        <label>
          {es ? "Caso" : "Case"}
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            {Object.entries(categories).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map((item) => (
                  <option key={item.case_id} value={item.case_id}>
                    {localizedCase(item.case_id, item.title, es)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          {es ? "Variante" : "Variant"}
          <select
            value={variantId}
            onChange={(e) => selectVariant(e.target.value)}
          >
            {caseData?.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {localizedVariant(v.id, v.label, es)}
              </option>
            ))}
          </select>
        </label>
        <span className={`of-source-badge ${dirty ? "live" : ""}`}>
          {dirty
            ? es
              ? "CÁLCULO LOCAL"
              : "LOCAL CALCULATION"
            : es
              ? "REPRODUCCIÓN"
              : "REPLAY"}
        </span>
      </div>
      <div className="of-view-tabs" role="tablist">
        {views.map((item) => (
          <button
            type="button"
            key={item.id}
            role="tab"
            aria-selected={view === item.id}
            className={`${view === item.id ? "active" : ""} ${item.id === "controls" ? "of-mobile-control-tab" : ""}`}
            onClick={() => setView(item.id)}
          >
            {es ? item.es : item.en}
          </button>
        ))}
      </div>
      {error ? (
        <div className="of-error" role="alert">
          {error}
        </div>
      ) : !shown || !params ? (
        <div className="of-loading" role="status">
          {es ? "Cargando circuito…" : "Loading circuit…"}
        </div>
      ) : (
        <div className="of-view-area" role="tabpanel">
          {view === "circuit" && (
            <div className="of-circuit-layout">
              <main className="of-circuit-main">
                <div className="of-viz-head">
                  <div>
                    <span className="of-kicker">
                      {es ? "BALANCE DE UNA PASADA" : "ONE-PASS BALANCE"}
                    </span>
                    <h2>
                      {es
                        ? "Flujos y operaciones"
                        : "Streams and unit operations"}
                    </h2>
                  </div>
                  <span className="of-boundary">
                    {es ? "ESCENARIO ILUSTRATIVO" : "ILLUSTRATIVE SCENARIO"}
                  </span>
                </div>
                <CircuitDiagram
                  active={stageId}
                  onSelect={setStageId}
                  metrics={shown.metrics}
                  params={params}
                  es={es}
                />
                <div className="of-stage-inspector">
                  <div>
                    <span className="of-kicker">
                      {es ? "OPERACIÓN SELECCIONADA" : "SELECTED OPERATION"}
                    </span>
                    <h3>{es ? stage.es : stage.en}</h3>
                    <p>{stage.detail[es ? 1 : 0]}</p>
                  </div>
                  <strong>
                    {fmt(
                      stageValue,
                      ["float", "classify", "product"].includes(stageId)
                        ? 1
                        : 0,
                    )}{" "}
                    <small>{stage.unit}</small>
                  </strong>
                </div>
              </main>
              {rail}
            </div>
          )}
          {view === "response" && (
            <div className="of-response-layout">
              <div className="of-response-main">
                <div className="of-viz-head">
                  <div>
                    <span className="of-kicker">
                      {es ? "RESPUESTA DEL CIRCUITO" : "CIRCUIT RESPONSE"}
                    </span>
                    <h2>
                      {es
                        ? "Distribuciones y cinética"
                        : "Distributions and kinetics"}
                    </h2>
                  </div>
                  <div className="of-segmented">
                    <button
                      className={response === "size" ? "active" : ""}
                      onClick={() => setResponse("size")}
                    >
                      {es ? "Tamaño" : "Size"}
                    </button>
                    <button
                      className={response === "kinetics" ? "active" : ""}
                      onClick={() => setResponse("kinetics")}
                    >
                      {es ? "Cinética" : "Kinetics"}
                    </button>
                  </div>
                </div>
                {response === "size" ? (
                  <Chart
                    title={
                      es
                        ? "Pasante acumulado por operación"
                        : "Cumulative passing by operation"
                    }
                    subtitle={
                      es
                        ? "Overflow normalizado por masa del flujo"
                        : "Overflow normalized by stream mass"
                    }
                    height={380}
                    labels={shown.size_um.map((v) => `${v.toFixed(0)} µm`)}
                    series={[
                      {
                        name: es ? "Alimentación" : "Feed",
                        color: "var(--color-fg-subtle)",
                        values: shown.feed_psd,
                      },
                      {
                        name: es ? "Triturado" : "Crushed",
                        color: "var(--color-warn)",
                        values: shown.crushed_psd,
                      },
                      {
                        name: es ? "Molido" : "Ground",
                        color: "var(--color-accent)",
                        values: shown.ground_psd,
                      },
                      {
                        name: es ? "Finos" : "Overflow",
                        color: "var(--color-accent-2)",
                        values: shown.overflow_psd,
                      },
                    ]}
                    format={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                ) : (
                  <Chart
                    title={
                      es
                        ? "Recuperación global vs residencia"
                        : "Overall recovery vs residence"
                    }
                    subtitle={
                      es
                        ? "Incluye partición de sólidos al rougher"
                        : "Includes solids partition to rougher"
                    }
                    height={380}
                    labels={shown.flotation_recovery.map(
                      (_, i) =>
                        `${((i / 95) * params.flotation_time_min).toFixed(1)} min`,
                    )}
                    series={[
                      {
                        name: es ? "Recuperación" : "Recovery",
                        color: "var(--color-accent)",
                        values: shown.flotation_recovery.map((v) => v * 100),
                      },
                    ]}
                    format={(v) => `${v.toFixed(1)}%`}
                  />
                )}
              </div>
              <aside className="of-response-metrics">
                <span className="of-kicker">
                  {es ? "ESTADO ACTUAL" : "CURRENT STATE"}
                </span>
                {[
                  [
                    es ? "Recuperación global" : "Overall recovery",
                    shown.metrics.recovery_pct,
                    "%",
                    1,
                  ],
                  [
                    es ? "Ley concentrado" : "Concentrate grade",
                    shown.metrics.concentrate_grade_pct,
                    "%",
                    2,
                  ],
                  [
                    es ? "Energía específica" : "Specific energy",
                    shown.metrics.specific_energy_kwh_t,
                    "kWh/t",
                    1,
                  ],
                  [
                    es ? "Overflow de sólidos" : "Solids overflow",
                    shown.metrics.overflow_fraction * 100,
                    "%",
                    1,
                  ],
                  [
                    es ? "Agua de planta" : "Plant water",
                    shown.metrics.water_use_m3_h,
                    "m³/h",
                    0,
                  ],
                ].map(([label, value, unit, digits]) => (
                  <div className="of-result-row" key={String(label)}>
                    <span>{label}</span>
                    <strong>
                      {fmt(Number(value), Number(digits))} <small>{unit}</small>
                    </strong>
                  </div>
                ))}
                <p className="of-disclaimer">
                  {es
                    ? "Modelo declarado; no es medición de planta."
                    : "Declared model, not a plant measurement."}
                </p>
              </aside>
            </div>
          )}
          {view === "surface" && (
            <DecisionSurface
              params={params}
              caseId={caseId}
              es={es}
              onChoose={(grind, reagent) =>
                setParams((p) =>
                  p ? { ...p, grind_p80_um: grind, reagent_gpt: reagent } : p,
                )
              }
            />
          )}
          {view === "methods" && (
            <div className="of-method-layout">
              <div className="of-method-picker">
                <span className="of-kicker">
                  {es ? "MÉTODOS DEL ARTEFACTO" : "ARTIFACT METHODS"}
                </span>
                <label>
                  {es ? "Seleccione método" : "Select method"}
                  <select
                    value={methodId}
                    onChange={(e) => setMethodId(e.target.value)}
                  >
                    {Object.entries(methodGroups).map(([domain, methods]) => (
                      <optgroup key={domain} label={domain}>
                        {methods.map((m) => (
                          <option key={m.id} value={m.id}>
                            {es ? (methodSpanish[m.id]?.[0] ?? m.name) : m.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <p>
                  {es
                    ? "Cada valor conserva unidad y procedencia. No se comparan escalas incompatibles."
                    : "Each value retains its unit and provenance. Incompatible scales are not compared."}
                </p>
                <Link to="/methodology">
                  {es
                    ? "Definiciones y supuestos"
                    : "Definitions and assumptions"}{" "}
                  ↗
                </Link>
              </div>
              <div className="of-method-detail">
                <span className="of-kicker">
                  {method ? (es ? domainSpanish[method.domain] ?? method.domain.toUpperCase() : method.domain.toUpperCase()) : (es ? 'MÉTODO' : 'METHOD')} /{" "}
                  {method ? (es ? tierSpanish[method.tier] ?? method.tier.toUpperCase() : method.tier.toUpperCase()) : ''}
                </span>
                <h2>
                  {es
                    ? (methodSpanish[methodId]?.[0] ?? method?.name)
                    : (method?.name ?? "n/a")}
                </h2>
                <p>
                  {es
                    ? methodSpanish[methodId]?.[1]
                    : (methodContext[methodId] ?? "See method definition.")}
                </p>
                <div className="of-method-visual">
                  <MethodVisual
                    key={methodId}
                    methodId={methodId}
                    trace={shown}
                    params={params}
                    caseData={caseData!}
                    es={es}
                  />
                </div>
                <div className="of-method-value">
                  <span>
                    {methodLive
                      ? es
                        ? "RECALCULADO EN NAVEGADOR"
                        : "RECALCULATED IN BROWSER"
                      : dirty
                        ? es
                          ? "ARTEFACTO ORIGINAL · DESACTUALIZADO"
                          : "ORIGINAL ARTIFACT · STALE"
                        : es
                          ? "ARTEFACTO PRECOMPUTADO"
                          : "PRECOMPUTED ARTIFACT"}
                  </span>
                  <strong>
                    {fmt(methodValue, 2)} <small>{methodUnit}</small>
                  </strong>
                </div>
                {dirty && !methodLive && (
                  <div className="of-method-warning">
                    {es
                      ? "Este método no se ejecuta al mover controles. El valor pertenece a la variante original."
                      : "This method does not rerun with controls. The value belongs to the original variant."}
                  </div>
                )}
                <div className="of-method-links">
                  <Link to="/implementation">Pipeline ↗</Link>
                  <Link to="/benchmark">
                    {es ? "Evaluación" : "Evaluation"} ↗
                  </Link>
                </div>
              </div>
            </div>
          )}
          {view === "compare" && (
            <div className="of-compare-layout">
              <div className="of-viz-head">
                <div>
                  <span className="of-kicker">
                    {es
                      ? "SEIS VARIANTES / MISMO CASO"
                      : "SIX VARIANTS / SAME CASE"}
                  </span>
                  <h2>
                    {es ? "Comparación de escenarios" : "Scenario comparison"}
                  </h2>
                </div>
                <label className="of-metric-select">
                  {es ? "Métrica" : "Metric"}
                  <select
                    value={compareMetric}
                    onChange={(e) =>
                      setCompareMetric(e.target.value as typeof compareMetric)
                    }
                  >
                    <option value="recovery_pct">
                      {es ? "Recuperación" : "Recovery"} (%)
                    </option>
                    <option value="concentrate_grade_pct">
                      {es ? "Ley" : "Grade"} (%)
                    </option>
                    <option value="specific_energy_kwh_t">
                      {es ? "Energía" : "Energy"} (kWh/t)
                    </option>
                    <option value="water_use_m3_h">
                      {es ? "Agua" : "Water"} (m³/h)
                    </option>
                  </select>
                </label>
              </div>
              <div className="of-comparison-list">
                {caseData?.variants.map((v) => {
                  const value = v.metrics[compareMetric] ?? 0;
                  const max = Math.max(
                    ...caseData.variants.map(
                      (item) => item.metrics[compareMetric] ?? 0,
                    ),
                    1,
                  );
                  return (
                    <button
                      type="button"
                      className={`of-variant-row ${v.id === variantId ? "active" : ""}`}
                      key={v.id}
                      onClick={() => selectVariant(v.id)}
                    >
                      <span>{localizedVariant(v.id, v.label, es)}</span>
                      <i>
                        <b
                          style={{
                            width: `${Math.max(1, (value / max) * 100)}%`,
                          }}
                        />
                      </i>
                      <strong>
                        {fmt(value, compareMetric === "water_use_m3_h" ? 0 : 1)}
                      </strong>
                    </button>
                  );
                })}
              </div>
              <p className="of-disclaimer">
                {es
                  ? "Mismo simulador y caso; no son observaciones de planta. Seleccione una fila para cargarla."
                  : "Same simulator and case, not plant observations. Select a row to load it."}
              </p>
              <Link to="/experiments">
                {es ? "Protocolo experimental" : "Experimental protocol"} ↗
              </Link>
            </div>
          )}
          {view === "controls" && (
            <div className="of-mobile-controls">{rail}</div>
          )}
        </div>
      )}
      <div className="of-workbench-foot">
        <span>
          {index?.n_cases ?? 0} {es ? "casos" : "cases"} ·{" "}
          {benchmark?.variant_count ?? 0} {es ? "variantes" : "variants"}
        </span>
        <span>
          {es
            ? "Escenarios de autor · no calibrado para planta"
            : "Authored scenarios · not plant-calibrated"}
        </span>
      </div>
    </div>
  );
}
