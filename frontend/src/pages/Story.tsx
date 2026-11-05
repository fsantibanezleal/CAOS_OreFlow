import { LinkedViewProvider, SceneCallouts, StoryFrame, useLinkedView, useLinkedCursor, useShellLang, type SceneCalloutDef, type StoryStep } from '@fasl-work/caos-app-shell';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import type { TopologyUnit } from '../engine/circuit';
import type { Trace } from '../engine/trace';
import { metricLabel, mineralName } from '../lib/i18n';
import type { Lang } from '../lib/format';
import { changedInputs, useWorkbench } from '../workbench/state';
import { useCaseState, useLoaded } from '../workbench/Workbench';
import type { SelectionOrigin } from '@fasl-work/caos-app-shell';
import { CircuitView } from '../workbench/views/CircuitView';
import { GrindingView } from '../workbench/views/GrindingView';
import { MethodsView } from '../workbench/views/MethodsView';
import { CompareView } from '../workbench/views/CompareView';
import { ResponseView } from '../workbench/views/ResponseView';
import { SourceStatement } from '../workbench/views/SourceViews';
import { unitName } from '../workbench/FlowsheetDiagram';
import { formatSignificant, formatWithUnit } from '../lib/format';
import './story.css';

const COPY = {
  circuit: { en: 'Trace the circuit', es: 'Seguir el circuito' },
  grinding: { en: 'Inspect size response', es: 'Inspeccionar respuesta granulométrica' },
  methods: { en: 'Evaluate the method', es: 'Evaluar el método' },
  compare: { en: 'Compare the decision', es: 'Comparar la decisión' },
  exit: { en: 'Return to the workbench', es: 'Volver al banco de trabajo' },
  linked: { en: 'Selected operation and evidence', es: 'Operación y evidencia seleccionadas' },
  cursor: { en: 'Circuit operation', es: 'Operación del circuito' },
  unavailable: { en: 'This story requires a simulated case or ore sample. Plant-hour records remain observational.', es: 'Este recorrido requiere un caso simulado o una muestra de mineral. Los registros horarios de planta son observacionales.' },
  loading: { en: 'Loading the selected case and current engine trace…', es: 'Cargando el caso seleccionado y la traza actual del motor…' },
};
const STORY_STEPS = ['circuit', 'grinding', 'methods', 'compare'] as const;
type StoryId = typeof STORY_STEPS[number];

type Props = { from: string };
function StoryContent({ from }: Props) {
  const lang = useShellLang() as Lang;
  const { step: requested = 'circuit' } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loaded, failure } = useLoaded();
  const state = useCaseState(loaded, params);
  const { caseId, variantId, base, point, selectedUnit, source, sampleId, selectUnit } = useWorkbench();
  const [inspection, setInspection] = useState<string | null>(null);
  const selectedId = useLinkedView(s => s.selectedId);
  const select = useLinkedView(s => s.select);
  const sharedCursor = useLinkedView(s => s.cursor);
  const linkedCursor = useLinkedCursor();
  const scrubCursor = useLinkedView(s => s.scrub);
  const { artifact, variant, trace, accepted, computing, rejected, errors } = state;
  const active = STORY_STEPS.includes(requested as StoryId) ? requested as StoryId : 'circuit';
  useEffect(() => setInspection(null), [active]);
  const contract = loaded?.contract;
  const primary = contract && caseId ? contract.cases[caseId]?.primary : null;
  const units = useMemo(() => trace ? (trace.topology as unknown as TopologyUnit[]).filter(u => !u.unit.endsWith('_junction') && u.unit !== 'underflow_return') : [], [trace]);
  const index = Math.max(0, Math.min(units.length - 1, Number(sharedCursor ?? 0)));
  const activeUnit = units[index] ?? null;
  const sourceTitle = { en: `Live worker trace · ${caseId} · ${variantId}`, es: `Traza activa del trabajador · ${caseId} · ${variantId}` };
  useEffect(() => {
    if (!units.length || selectedId || selectedUnit) return;
    const first = units[0]!.unit;
    select(first, 'external');
    selectUnit(first);
    scrubCursor(0);
  }, [units, selectedId, selectedUnit, select, selectUnit, scrubCursor]);

  if (failure) return <main className="page-body wide" role="alert"><h1>OreFlow</h1><p>{failure}</p></main>;
  if (!loaded || !artifact || !variant || !trace || !accepted || !primary) return <main className="page-body wide oreflow-story-loading" data-state={rejected ? 'rejected' : 'loading'}><h1>{COPY.circuit[lang]}</h1><p role={rejected ? 'alert' : 'status'}>{rejected ? errors.map(e => e.code).join(', ') : computing ? COPY.loading[lang] : COPY.loading[lang]}</p></main>;
  if (source === 'hour') return <main className="page-body wide oreflow-story-loading" data-state="unavailable"><h1>{COPY.circuit[lang]}</h1><p>{COPY.unavailable[lang]}</p></main>;

  const metric = (key: string, unitFallback: string) => {
    const value = trace.metrics[key];
    return { value: Number.isFinite(value) ? formatSignificant(value!, lang, 4) : '—', unit: trace.metric_units[key] || unitFallback, raw: value };
  };
  const p80 = metric('p80_um', 'µm');
  const recovery = metric('recovery_pct', '%');
  const energy = metric('specific_energy_total_kwh_t', 'kWh/t');
  const grade = metric('concentrate_grade', '%');
  const evaluations = Number(variant.methods.optimization?.evaluations ?? 0);
  const flags = new Set(trace.flags.map(f => f.code));
  const defs: SceneCalloutDef[] = [
    { id: 'p80', eyebrow: { en: 'PRODUCT P80', es: 'P80 DEL PRODUCTO' }, value: p80.value, unit: p80.unit, state: flags.has('target_unreachable') ? 'warning' : 'normal', anchor: { x: .23, y: .58 }, source: sourceTitle },
    { id: 'recovery', eyebrow: { en: 'OVERALL RECOVERY', es: 'RECUPERACIÓN TOTAL' }, value: recovery.value, unit: recovery.unit, state: flags.has('power_limited') ? 'warning' : 'normal', anchor: { x: .52, y: .43 }, source: sourceTitle },
    { id: 'energy', eyebrow: { en: 'SPECIFIC ENERGY', es: 'ENERGÍA ESPECÍFICA' }, value: energy.value, unit: energy.unit, state: 'selected', anchor: { x: .8, y: .6 }, source: sourceTitle },
  ];
  const headlines: Record<StoryId, { en: string; es: string }> = {
    circuit: { en: `${units.length} units balance ${formatSignificant(trace.metrics.throughput_tph, lang, 4)} t/h feed`, es: `${units.length} unidades balancean ${formatSignificant(trace.metrics.throughput_tph, lang, 4)} t/h de alimentación` },
    grinding: { en: `P80 ${p80.value} ${p80.unit} meets ${formatSignificant(trace.metrics.target_p80_um, lang, 4)} µm target`, es: `P80 ${p80.value} ${p80.unit} alcanza el objetivo de ${formatSignificant(trace.metrics.target_p80_um, lang, 4)} µm` },
    methods: source === 'case'
      ? { en: `${evaluations} exact-engine evaluations qualify optimization`, es: `${evaluations} evaluaciones del motor exacto califican la optimización` }
      : { en: `${p80.value} ${p80.unit} sample grind; optimization unavailable`, es: `Molienda de muestra ${p80.value} ${p80.unit}; optimización no disponible` },
    compare: { en: `${recovery.value}% recovery; ${grade.value}% concentrate grade`, es: `${recovery.value}% de recuperación; ${grade.value}% de ley de concentrado` },
  };
  const views: Record<StoryId, React.ReactNode> = {
    circuit: <CircuitView trace={trace} primary={primary} lang={lang} selected={selectedUnit} onSelect={unit => { setInspection(null); selectUnit(unit); if (unit) { select(unit, 'scene'); const i = units.findIndex(u => u.unit === unit); if (i >= 0) linkedCursor.scrub(i); } else select(null, 'scene'); }} linkedSelection linkedCursorPosition={index} />,
    grinding: <GrindingView trace={trace} ore={artifact.definition.ore} lang={lang} onCursor={setInspection} />,
    methods: source === 'case' ? <MethodsView contract={contract!} artifact={artifact} variant={variant} point={accepted} trace={trace} modified={Object.keys(changedInputs(base, point)).length > 0} lang={lang} onCursor={setInspection} /> : <SourceStatement kind="sample-methods" lang={lang} />,
    compare: source === 'case' ? <CompareView contract={contract!} artifact={artifact} index={loaded!.index} benchmark={loaded!.benchmark} variantId={variantId} lang={lang} onCursor={setInspection} /> : <ResponseView contract={contract!} artifact={artifact} optimization={variant.methods.optimization} point={accepted} lang={lang} onCursor={setInspection} />,
  };
  const unitData = activeUnit ? (trace.topology as unknown as TopologyUnit[]).find(u => u.unit === activeUnit.unit) : null;
  const streamMap = trace.streams as Record<string, { solids_tph?: number; water_tph?: number; grades?: Record<string, number> }>;
  const primaryName = mineralName(primary.species, lang);
  const selectPanelUnit = (unit: string, origin: SelectionOrigin) => {
    select(unit, origin);
    selectUnit(unit);
    const i = units.findIndex(u => u.unit === unit);
    if (i >= 0) linkedCursor.scrub(i);
  };
  const panel = <section className="oreflow-story-panel-content" aria-label={COPY.linked[lang]}>
    <div className="oreflow-story-result-grid">
      <div><span>{metricLabel('recovery_pct', lang)}</span><strong>{recovery.value} <small>{recovery.unit}</small></strong></div>
      <div><span>{metricLabel('concentrate_grade', lang)}</span><strong>{grade.value} <small>{grade.unit}</small></strong></div>
      <div><span>{metricLabel('specific_energy_total_kwh_t', lang)}</span><strong>{energy.value} <small>{energy.unit}</small></strong></div>
    </div>
    {active === 'circuit' && <div className="oreflow-story-unit-list"><h2>{COPY.linked[lang]}</h2>{units.map(u => <button key={u.unit} type="button" data-linked-id={u.unit} data-linked-view="panel" data-linked-selected={selectedId === u.unit ? 'true' : 'false'} aria-pressed={selectedId === u.unit} onClick={() => selectPanelUnit(u.unit, 'panel')}>{unitName(u.unit, lang)} <span>{formatSignificant((trace.balance as { units: Record<string, number> }).units[u.unit], lang, 2)}</span></button>)}</div>}
    {active === 'circuit' && unitData && <div className="oreflow-story-unit-detail"><h3>{unitName(unitData.unit, lang)}</h3><p>{lang === 'es' ? 'Cierre relativo' : 'Relative closure'}: <strong>{formatSignificant((trace.balance as { units: Record<string, number> }).units[unitData.unit], lang, 3)}</strong></p><h4>{lang === 'es' ? 'Alimentaciones' : 'Inputs'}</h4><ul>{unitData.inputs.map(name => <li key={name}>{name} · {formatWithUnit(streamMap[name]?.solids_tph, 't/h', lang)}</li>)}</ul><h4>{lang === 'es' ? 'Productos' : 'Outputs'}</h4><ul>{unitData.outputs.map(name => <li key={name}>{name} · {formatWithUnit(streamMap[name]?.solids_tph, 't/h', lang)} · {primaryName} {formatWithUnit(streamMap[name]?.grades?.[primary.species], primary.unit, lang)}</li>)}</ul></div>}
    {active !== 'circuit' && <p className="oreflow-story-explanation">{active === 'grinding' ? (lang === 'es' ? 'La distribución de tamaño, la partición del ciclón y la liberación se calculan a partir del mismo estado del circuito.' : 'Size distribution, cyclone partition and liberation are calculated from the same circuit state.') : active === 'methods' ? (lang === 'es' ? 'Inspeccione el recorrido del optimizador, su incumbente y la evaluación del motor exacto.' : 'Inspect the optimizer path, incumbent and exact-engine evaluation.') : (lang === 'es' ? 'La decisión mantiene unidades y escenarios comparables; los datos son resultados del modelo, no mediciones de planta.' : 'The decision keeps units and scenarios comparable; these are model results, not plant measurements.')}</p>}
    {active === 'circuit' && <label className="oreflow-story-cursor">{COPY.cursor[lang]} · {index + 1}/{Math.max(1, units.length)}<input type="range" min={0} max={Math.max(1, units.length - 1)} step={1} {...linkedCursor.inputProps} onChange={event => { const next = Number(event.currentTarget.value); linkedCursor.scrub(next); const unit = units[next]; if (unit) selectPanelUnit(unit.unit, 'external'); }} /></label>}
    {inspection && <p className="oreflow-story-inspection" role="status">{inspection}</p>}
    <span className="oreflow-story-provenance">{sourceTitle[lang]} · {lang === 'es' ? 'resultado del simulador, no dato de planta' : 'simulator result, not plant data'}</span>
  </section>;
  const title = artifact.title[lang];
  const hrefParams = new URLSearchParams(params);
  hrefParams.set('from', from);
  const steps: StoryStep[] = STORY_STEPS.map((id, i) => ({
    id, number: (i + 1) as 1 | 2 | 3 | 4,
    verb: COPY[id], headline: headlines[id],
    summary: { en: `${title} · ${variant.label.en} · computed from the selected OreFlow state.`, es: `${title} · ${variant.label.es} · calculado desde el estado seleccionado de OreFlow.` },
    href: `/story/${id}?${hrefParams.toString()}`, accent: (i + 1) as 1 | 2 | 3 | 4 | 5,
    stage: <div className="oreflow-story-visual"><SceneCallouts items={defs} placement="header"/><div className="oreflow-story-drawing">{views[id]}</div></div>,
    panel: <><h2>{COPY[id][lang]}</h2>{panel}<p className="oreflow-story-case">{title} · {variant.label[lang]} · {caseId}</p></>,
  }));
  return <StoryFrame className="page-body wide oreflow-story" steps={steps} activeId={active} onStepChange={id => navigate(`/story/${id}?${hrefParams.toString()}`)} onExit={() => navigate(from)} />;
}

export default function Story() {
  const [params] = useSearchParams();
  const location = useLocation();
  const fromParam = params.get('from');
  const from = fromParam && fromParam.startsWith('/app?') && !fromParam.startsWith('//') && !fromParam.includes('\\')
    ? fromParam : `/app${location.search.replace(/([?&])from=[^&]*/g, '$1').replace(/[?&]$/, '')}`;
  const initial = { selectedId: null as string | null, cursor: 0 };
  return <LinkedViewProvider initial={initial}><StoryContent from={from}/></LinkedViewProvider>;
}
