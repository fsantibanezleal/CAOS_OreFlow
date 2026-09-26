/**
 * The focus route (ADR-0070, design §12.2): the shell's FocusShell with one instrument on the stage
 * (the flowsheet, any single chart of the grinding or separation views, or the response sweep), the
 * headline metrics as the HUD, the stage labelled in place with the state the circuit is in, and the
 * rail holding the controls with a basic and an advanced set. The state travels in the URL, so entering
 * from the workbench and leaving again keep the case, the variant, the view and every changed control.
 */
import { FocusShell, useShellLang } from '@fasl-work/caos-app-shell';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { OperatingPoint } from '../engine/model';
import type { Trace } from '../engine/trace';
import type { CaseArtifact } from '../lib/artifacts.types';
import { formatWithUnit, type Lang } from '../lib/format';
import { flagShort, metricLabel, t, UI } from '../lib/i18n';
import { OverlayInset, type Inset } from '../components/charts/inset';
import { ControlList } from './Controls';
import { FlowsheetDiagram } from './FlowsheetDiagram';
import { changedInputs, stateQuery, useWorkbench } from './state';
import { useCaseState, useLoaded } from './Workbench';
import { GRINDING_CHARTS, grindingCharts, type GrindingChart } from './views/GrindingView';
import { ResponseView } from './views/ResponseView';
import { SEPARATION_CHARTS, separationCharts, type SeparationChart } from './views/SeparationView';

type Stage = 'flowsheet' | GrindingChart | SeparationChart | 'response';

/** The inputs a first look needs; the advanced set is every input the case's contract declares. */
const BASIC: Array<keyof OperatingPoint> = ['throughput_tph', 'target_p80_um', 'collector_gpt', 'gravity_bleed', 'deslime_cut_um'];
const ALL: Array<keyof OperatingPoint> = ['throughput_tph', 'work_index_kwh_t', 'head_grade', 'crusher_css_mm', 'target_p80_um', 'circulating_load',
  'water_m3_t', 'collector_gpt', 'jg_cm_s', 'rougher_cells', 'gravity_bleed', 'deslime_cut_um'];
const HUD = ['recovery_pct', 'concentrate_grade', 'specific_energy_total_kwh_t', 'p80_um'];
/** Room the FocusShell overlays take on the stage: the label and actions along the top, the HUD on the left. */
const FOCUS_INSET: Inset = [72, 16, 12, 156];

const TEXT = {
  stage: { en: 'On the stage', es: 'En el escenario' },
  flowsheet: { en: 'Flowsheet', es: 'Diagrama de flujo' },
  response: { en: 'Response sweep', es: 'Barrido de respuesta' },
  instrument: { en: 'Instrument', es: 'Instrumento' },
  controls: { en: 'Controls', es: 'Controles' },
  flowsheetSummary: { en: 'Flowsheet of the circuit with the solids flow and payable grade of every stream.', es: 'Diagrama del circuito con el flujo de sólidos y la ley del pagable de cada corriente.' },
  within: { en: 'Within every constraint', es: 'Dentro de todas las restricciones' },
  belowSpec: { en: 'Grade below the specification', es: 'Ley bajo la especificación' },
  aboveWater: { en: 'Process water above capacity', es: 'Agua de proceso sobre la capacidad' },
  powerLimited: { en: 'Power-limited: the mill runs at installed power and the grind is coarser than the target', es: 'Limitado por potencia: el molino opera a potencia instalada y la molienda es más gruesa que el objetivo' },
};

/** The state the circuit is in, in words: power, grade specification and water capacity. */
export function circuitState(trace: Trace, artifact: CaseArtifact, lang: Lang): string {
  const m = trace.metrics;
  const plant = artifact.definition.plant;
  const parts: string[] = [];
  if (trace.flags.some(f => f.code === 'power_limited')) parts.push(TEXT.powerLimited[lang]);
  if (plant.grade_spec && m.concentrate_grade < plant.grade_spec.minimum) parts.push(TEXT.belowSpec[lang]);
  if (plant.water_limit_m3_t > 0 && m.water_intensity_m3_t > plant.water_limit_m3_t) parts.push(TEXT.aboveWater[lang]);
  const others = trace.flags.filter(f => f.code !== 'power_limited').map(f => flagShort(f.code, lang));
  return [...(parts.length ? parts : [TEXT.within[lang]]), ...others].join('; ');
}

export default function FocusWorkbench() {
  const lang = useShellLang() as Lang;
  const { caseId: pathCase } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const params = useMemo(() => {
    const merged = new URLSearchParams(search);
    if (pathCase) merged.set('case', pathCase);
    return merged;
  }, [search, pathCase]);
  const { caseId, variantId, base, point, view, selectedUnit, advanced, setVariant, setAdvanced, selectUnit } = useWorkbench();
  const { loaded, failure } = useLoaded();
  const { artifact, variant, trace, accepted, errors } = useCaseState(loaded, params);
  const [stage, setStage] = useState<Stage>(() => (search.get('stage') as Stage | null) ?? 'flowsheet');
  const [cursor, setCursor] = useState<string | null>(null);

  // the URL mirrors the state, as on the workbench
  useEffect(() => {
    if (!caseId || !base) return;
    const query = `${stateQuery(caseId, variantId, base, point, view)}&stage=${stage}`;
    if (query !== search.toString()) navigate(`/focus/${caseId}?${query}`, { replace: true });
  }, [caseId, variantId, base, point, view, stage, search, navigate]);

  if (failure) return <p className="of-failure" role="alert">{failure}</p>;
  if (!loaded || !artifact || !variant || !point || artifact.case_id !== caseId) return <p className="of-hint" role="status">{t(UI.loading, lang)}</p>;
  const contract = loaded.contract;
  const primary = contract.cases[caseId].primary;
  const exit = () => navigate(`/?${stateQuery(caseId, variantId, base, point, view)}`);

  const choices: Array<{ id: Stage; label: string; node: React.ReactNode }> = [];
  if (trace && accepted) {
    choices.push({ id: 'flowsheet', label: TEXT.flowsheet[lang],
      node: <FlowsheetDiagram trace={trace} primary={primary} lang={lang} selected={selectedUnit} onSelect={selectUnit} summary={TEXT.flowsheetSummary[lang]} /> });
    const grinding = grindingCharts(trace, artifact.definition.ore, lang, setCursor);
    for (const [id, node] of Object.entries(grinding)) choices.push({ id: id as Stage, label: GRINDING_CHARTS[id as GrindingChart][lang], node });
    const separation = separationCharts(trace, primary, lang, setCursor);
    for (const [id, node] of Object.entries(separation)) choices.push({ id: id as Stage, label: SEPARATION_CHARTS[id as SeparationChart][lang], node });
    choices.push({ id: 'response', label: TEXT.response[lang],
      node: <ResponseView contract={contract} artifact={artifact} optimization={variant.methods.optimization} point={accepted} lang={lang} onCursor={setCursor} /> });
  }
  const current = choices.find(c => c.id === stage) ?? choices[0];
  const modified = Object.keys(changedInputs(base, point)).length > 0;
  const hud = trace ? HUD.filter(k => k in trace.metrics).map(k => ({ label: metricLabel(k, lang), value: formatWithUnit(trace.metrics[k], trace.metric_units[k], lang) })) : [];

  const rail = (
    <div className="of-focus-rail">
      <label className="of-field"><span>{TEXT.stage[lang]}</span>
        <select value={current?.id ?? 'flowsheet'} onChange={e => setStage(e.target.value as Stage)}>
          {choices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select></label>
      <label className="of-field"><span>{t(UI.variant, lang)}</span>
        <select value={variantId} onChange={e => {
          const next = artifact.variants.find(v => v.id === e.target.value);
          if (next) setVariant(next.id, next.point);
        }}>{artifact.variants.map(v => <option key={v.id} value={v.id}>{v.label[lang]}</option>)}</select></label>
      <div className="of-rail-sections" role="group" aria-label={TEXT.controls[lang]}>
        <button type="button" className={advanced ? '' : 'active'} aria-pressed={!advanced} onClick={() => setAdvanced(false)}>{t(UI.basic, lang)}</button>
        <button type="button" className={advanced ? 'active' : ''} aria-pressed={advanced} onClick={() => setAdvanced(true)}>{t(UI.advanced, lang)}</button>
      </div>
      <ControlList contract={contract} caseId={caseId} names={advanced ? ALL : BASIC} variantPoint={variant.point} errors={errors} lang={lang} idPrefix="of-focus" />
      {modified && <button type="button" className="of-revert" onClick={() => useWorkbench.getState().reset()}>{t(UI.reset, lang)}</button>}
    </div>
  );

  return (
    <FocusShell
      stage={(
        <OverlayInset.Provider value={FOCUS_INSET}>
          <div className="of-focus-body">
            {current?.node ?? <p className="of-hint" role="status">{t(UI.loading, lang)}</p>}
            {cursor && <p className="of-focus-cursor" aria-live="polite">{cursor}</p>}
          </div>
        </OverlayInset.Provider>
      )}
      rail={rail}
      title={artifact.title[lang]}
      description={trace ? circuitState(trace, artifact, lang) : t(UI.computing, lang)}
      hud={hud}
      onExit={exit}
      exitLabel={t(UI.exitFocus, lang)}
      stageLabel={`${TEXT.instrument[lang]}: ${current?.label ?? ''}`}
    />
  );
}
