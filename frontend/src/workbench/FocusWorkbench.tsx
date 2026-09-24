import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { FocusShell, useShellLang } from '@fasl-work/caos-app-shell';
import { loadCase, loadIndex } from '../api/artifacts';
import type { CaseArtifact, CaseIndex, Params } from '../lib/contract.types';
import { simulateLive } from '../live/engine';
import { localizedCase, localizedVariant } from '../lib/locale';
import TopologyMap from '../components/TopologyMap';
import { Chart, type Series } from '../components/Charts';
import { controls } from './Workbench';
import { readFocusState, writeFocusState } from './focusState';

const order: Record<string, string[]> = {
  rougher: ['feed','crush','grind','classify','float','product'],
  gravity_rougher: ['feed','crush','grind','classify','gravity','float','product'],
  magnetic: ['feed','crush','grind','magnetic','product'],
  deslime_rougher: ['feed','crush','grind','classify','float','product'],
};
const stageLabels: Record<string, [string,string]> = {
  feed: ['Ore feed','Alimentación'], crush: ['Crushing','Trituración'], grind: ['Grinding','Molienda'],
  classify: ['Classification','Clasificación'], gravity: ['Gravity recovery','Recuperación gravimétrica'],
  magnetic: ['Magnetic separation','Separación magnética'], float: ['Rougher flotation','Flotación rougher'],
  product: ['Products','Productos'], tail: ['Tailings','Relaves'],
};
const descriptions: Record<string, [string,string]> = {
  feed: ['Feed tonnage and grade set the solids and valuable-mineral basis.','El caudal y la ley definen la base de sólidos y mineral valioso.'],
  crush: ['Crusher product size responds to the ore and reduction setting.','El tamaño triturado responde al mineral y al ajuste de reducción.'],
  grind: ['Target P80 changes the size distribution and specific energy.','El P80 objetivo cambia la distribución y la energía específica.'],
  classify: ['Size-bin partition divides mill discharge into two measured solids streams.','La partición por tamaño divide la descarga en dos corrientes de sólidos.'],
  gravity: ['An authored size-window captures free gold from classifier underflow.','Una ventana granulométrica supuesta captura oro libre del underflow.'],
  magnetic: ['An authored size response partitions magnetic concentrate and reject.','Una respuesta por tamaño supuesta separa concentrado magnético y rechazo.'],
  float: ['Residence time, air and collector set the conditional rougher response.','Residencia, aire y colector definen la respuesta condicional rougher.'],
  product: ['The visible branches close a one-pass solids balance.','Las ramas visibles cierran el balance de sólidos de una pasada.'],
  tail: ['The reject streams close the one-pass solids balance.','Los rechazos cierran el balance de sólidos de una pasada.'],
};

export default function FocusWorkbench() {
  const es = useShellLang() === 'es';
  const navigate = useNavigate();
  const { caseId: pathCaseId = '' } = useParams();
  const [index, setIndex] = useState<CaseIndex | null>(null);
  const [caseData, setCaseData] = useState<CaseArtifact | null>(null);
  const [variantId, setVariantId] = useState('nominal');
  const [params, setParams] = useState<Params | null>(null);
  const [stageId, setStageId] = useState('classify');
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { loadIndex().then(setIndex).catch(e => setError(String(e))); }, []);
  useEffect(() => {
    if (!pathCaseId) return;
    let valid = true;
    loadCase(pathCaseId).then(data => {
      if (!valid) return;
      const saved = readFocusState();
      const same = saved?.caseId === pathCaseId;
      const variant = data.variants.find(v => v.id === (same ? saved?.variantId : 'nominal')) ?? data.variants[0];
      setCaseData(data);
      setVariantId(variant?.id ?? '');
      setParams(same ? saved!.params : (variant?.params ?? null));
      setStageId(same ? saved!.stageId : (data.process_family === 'magnetic' ? 'magnetic' : data.process_family === 'gravity_rougher' ? 'gravity' : 'classify'));
      setError('');
    }).catch(e => { if (valid) setError(String(e)); });
    return () => { valid = false; };
  }, [pathCaseId]);
  useEffect(() => {
    if (caseData?.case_id === pathCaseId && params) writeFocusState({ caseId: pathCaseId, variantId, params, stageId });
  }, [caseData, pathCaseId, variantId, params, stageId]);
  const trace = useMemo(() => params && pathCaseId ? simulateLive(params, pathCaseId) : null, [params, pathCaseId]);
  const family = caseData?.process_family ?? 'rougher';
  const stages = order[family] ?? order.rougher;
  const stageIndex = Math.max(0, stages.indexOf(stageId));
  const changeStage = (delta: number) => setStageId(stages[Math.max(0, Math.min(stages.length - 1, stageIndex + delta))]);
  const changeVariant = (id: string) => {
    const variant = caseData?.variants.find(v => v.id === id);
    if (variant) { setVariantId(id); setParams(variant.params); }
  };
  const m = trace?.metrics;
  const hud = m ? [
    { label: es ? 'Recuperación' : 'Recovery', value: `${m.recovery_pct.toFixed(1)} %` },
    { label: es ? 'Ley concentrado' : 'Concentrate grade', value: `${m.concentrate_grade_pct.toFixed(2)} %` },
    { label: es ? 'Energía específica' : 'Specific energy', value: `${m.specific_energy_kwh_t.toFixed(1)} kWh/t` },
    { label: es ? 'Agua de proceso' : 'Process water', value: `${m.water_use_m3_h.toFixed(0)} m³/h` },
  ] : [];
  const title = stageLabels[stageId]?.[es ? 1 : 0] ?? stageId;
  const description = descriptions[stageId]?.[es ? 1 : 0] ?? '';
  const sizeLabels = trace?.size_um.map(n => `${n.toFixed(0)} µm`) ?? [];
  const isKinetics = stageId === 'float';
  const responseSeries: Series[] = trace ? isKinetics ? [
    { name: es ? 'Recuperación' : 'Recovery', color: 'var(--color-accent)', values: trace.flotation_recovery },
  ] : stageId === 'magnetic' ? [
    { name: es ? 'Captura LIMS' : 'LIMS capture', color: 'var(--color-accent)', values: trace.size_um.map(size => 0.91*(1-Math.exp(-size/25))*Math.exp(-size/1800)) },
  ] : stageId === 'gravity' ? [
    { name: es ? 'Ventana GRG' : 'GRG window', color: 'var(--color-accent)', values: trace.size_um.map(size => 0.82*(1-Math.exp(-size/45))*Math.exp(-size/700)) },
  ] : [
    { name: es ? 'Alimentación' : 'Feed', color: 'var(--color-fg-subtle)', values: trace.feed_psd },
    { name: es ? 'Molido' : 'Ground', color: 'var(--color-accent)', values: trace.ground_psd },
    ...(['classify','product','tail'].includes(stageId) ? [{ name: es ? 'Finos' : 'Overflow', color: 'var(--color-good)', values: trace.overflow_psd }] : []),
  ] : [];
  const exit = () => navigate('/');
  if (error) return <main role="alert" className="of-focus-error">{error}<button onClick={exit}>{es ? 'Volver' : 'Return'}</button></main>;
  if (!caseData || !params || !trace || caseData.case_id !== pathCaseId) return <main role="status" className="of-focus-error">{es ? 'Cargando escenario…' : 'Loading scenario…'}</main>;
  return <FocusShell
    title={title} description={description} hud={hud}
    onExit={exit} exitLabel={es ? '← Volver al laboratorio' : '← Return to workbench'}
    stageLabel={es ? 'Diagrama del circuito en foco' : 'Focused circuit diagram'}
    stage={<div className="of-focus-stage">
      <TopologyMap trace={trace} params={params} active={stageId} es={es} onSelect={setStageId} />
      <div className="of-focus-stage-chart"><Chart title={isKinetics ? (es ? 'Cinética rougher' : 'Rougher kinetics') : (es ? 'Respuesta por tamaño' : 'Size response')} subtitle={es ? 'Respuesta calculada al punto de operación actual' : 'Calculated at the current operating point'} series={responseSeries} labels={isKinetics ? trace.flotation_recovery.map((_,i) => `${(i*params.flotation_time_min/Math.max(trace.flotation_recovery.length-1,1)).toFixed(1)} min`) : sizeLabels} height={125} format={n => `${(n*100).toFixed(0)}%`} /></div>
      <div className="of-focus-stage-controls" aria-label={es ? 'Navegación de etapas' : 'Stage navigation'}>
        <button type="button" onClick={() => changeStage(-1)} disabled={stageIndex === 0} aria-label={es ? 'Etapa anterior' : 'Previous stage'}>←</button>
        <span>{stageIndex + 1} / {stages.length} · {title}</span>
        <button type="button" onClick={() => changeStage(1)} disabled={stageIndex === stages.length - 1} aria-label={es ? 'Etapa siguiente' : 'Next stage'}>→</button>
      </div>
    </div>}
    rail={<div className="of-focus-parameters">
      <span className="of-kicker">OREFLOW / {es ? 'ESCENARIO EN FOCO' : 'SCENARIO IN FOCUS'}</span>
      <h2>{localizedCase(caseData.case_id, caseData.title, es)}</h2>
      <small>{caseData.case_id} · {es ? 'una pasada · simulador no calibrado' : 'one pass · uncalibrated simulator'}</small>
      <label>{es ? 'Caso' : 'Case'}<select aria-label={es ? 'Caso en foco' : 'Focus case'} value={pathCaseId} onChange={e => navigate(`/focus/${encodeURIComponent(e.target.value)}`)}>
        {index?.cases.map(c => <option key={c.case_id} value={c.case_id}>{localizedCase(c.case_id, c.title, es)}</option>)}
      </select></label>
      <label>{es ? 'Variante' : 'Variant'}<select aria-label={es ? 'Variante en foco' : 'Focus variant'} value={variantId} onChange={e => changeVariant(e.target.value)}>
        {caseData.variants.map(v => <option key={v.id} value={v.id}>{localizedVariant(v.id, v.label, es)}</option>)}
      </select></label>
      <div className="of-focus-mode" role="group" aria-label={es ? 'Densidad de parámetros' : 'Parameter density'}>
        <button type="button" className={!advanced ? 'active' : ''} onClick={() => setAdvanced(false)}>{es ? 'Básico' : 'Basic'}</button>
        <button type="button" className={advanced ? 'active' : ''} onClick={() => setAdvanced(true)}>{es ? 'Avanzado' : 'Advanced'}</button>
      </div>
      <div className="of-focus-sliders">
        {Object.entries(controls).filter(([key]) => family !== 'magnetic' || ['feed_tph','grind_p80_um','water_m3_t'].includes(key)).filter(([key]) => advanced || ['feed_tph','grind_p80_um','classifier_cut_um','flotation_time_min'].includes(key)).map(([key,c]) => <label key={key}>
          <span>{es ? c.es : c.en}<output>{params[key].toFixed(c.step < 1 ? 1 : 0)} {c.unit}</output></span>
          <input type="range" aria-label={es ? c.es : c.en} min={c.min} max={c.max} step={c.step} value={params[key]} onChange={e => setParams(p => p ? { ...p, [key]: Number(e.target.value) } : p)} />
        </label>)}
      </div>
      <p className="of-focus-provenance">{es ? 'Motor local: balance de masa, distribución por tamaño y respuestas cinéticas supuestas. No predicción calibrada de planta.' : 'Local engine: mass balance, size distributions and authored kinetic responses. Not a plant-calibrated prediction.'}</p>
    </div>}
  />;
}
