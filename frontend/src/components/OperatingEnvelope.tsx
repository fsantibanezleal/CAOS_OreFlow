import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Params } from '../lib/contract.types';
import { analyzeEnvelope, defaultEnvelopeLimits, envelopeReport, type EnvelopeLimits, type EnvelopePoint } from '../live/operatingEnvelope';
import DecisionSurface from './DecisionSurface';

type Props = { params: Params; caseId: string; es: boolean; onApply: (next: Params) => void };
const num = (value: number, places = 1) => Number.isFinite(value) ? value.toFixed(places) : 'n/a';
const labels: Record<keyof EnvelopeLimits, [string, string, string]> = {
  minRecoveryPct: ['Minimum recovery', 'Recuperación mínima', '%'],
  minStressRecoveryPct: ['Minimum under declared stress', 'Mínima bajo estrés declarado', '%'],
  minGradePct: ['Minimum concentrate grade', 'Ley mínima de concentrado', '%'],
  maxEnergyKwhT: ['Maximum specific energy', 'Energía específica máxima', 'kWh/t'],
  maxWaterM3H: ['Maximum water demand', 'Demanda máxima de agua', 'm³/h'],
  maxCollectorGpt: ['Maximum collector dose', 'Dosis máxima de colector', 'g/t'],
};

export default function OperatingEnvelope({ params, caseId, es, onApply }: Props) {
  const [limits, setLimits] = useState<EnvelopeLimits>(() => defaultEnvelopeLimits(params, caseId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mode, setMode] = useState<'tradeoff' | 'projection'>('tradeoff');
  const [mobilePane, setMobilePane] = useState<'plot' | 'criteria'>('plot');
  const [compactPlot, setCompactPlot] = useState(() => window.matchMedia('(max-width: 500px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 500px)');
    const update = () => setCompactPlot(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const result = useMemo(() => analyzeEnvelope(params, caseId, limits), [params, caseId, limits]);
  const selected = result.candidates.find(point => point.id === selectedId) ?? result.candidates.find(point => point.id === result.recommendedId) ?? result.baseline;
  const hovered = result.candidates.find(point => point.id === hoverId) ?? selected;
  const xs = [result.baseline.powerMw, ...result.candidates.map(point => point.powerMw)];
  const ys = [result.baseline.recoveredValuableTph, ...result.candidates.map(point => point.recoveredValuableTph)];
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const chart = compactPlot ? { width: 420, height: 520, left: 59, right: 400, top: 32, bottom: 453 } : { width: 850, height: 485, left: 74, right: 782, top: 60, bottom: 423 };
  const sx = (value: number) => chart.left + (value - minX) / Math.max(maxX - minX, 1e-8) * (chart.right - chart.left);
  const sy = (value: number) => chart.bottom - (value - minY) / Math.max(maxY - minY, 1e-8) * (chart.bottom - chart.top);
  const frontier = result.candidates.filter(point => point.pareto).sort((a, b) => a.powerMw - b.powerMw);
  const setLimit = (key: keyof EnvelopeLimits, value: number) => {
    if (Number.isFinite(value)) setLimits(previous => ({ ...previous, [key]: Math.max(0, value) }));
  };
  const exportRecord = () => {
    const json = JSON.stringify(envelopeReport(result, selected.id), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `oreflow-${caseId}-operating-envelope.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const inspect = (point: EnvelopePoint) => {
    setHoverId(point.id);
    setSelectedId(point.id);
  };

  return <div className={`of-investigation pane-${mobilePane}`}>
    <div className="of-investigation-mobile-nav" role="tablist"><button type="button" role="tab" aria-selected={mobilePane === 'plot'} onClick={() => setMobilePane('plot')}>{es ? 'Análisis' : 'Analysis'}</button><button type="button" role="tab" aria-selected={mobilePane === 'criteria'} onClick={() => setMobilePane('criteria')}>{es ? 'Límites y punto' : 'Limits & point'}</button></div>
    <div className="of-investigation-main">
      <header className="of-investigation-head">
        <div><span className="of-kicker">{es ? 'INVESTIGACIÓN DEL PUNTO DE OPERACIÓN' : 'OPERATING-POINT INVESTIGATION'}</span><h2>{es ? 'Envolvente de operación' : 'Operating envelope'}</h2></div>
        <div className="of-segmented" role="tablist" aria-label={es ? 'Vista de análisis' : 'Analysis view'}>
          <button type="button" role="tab" aria-selected={mode === 'tradeoff'} className={mode === 'tradeoff' ? 'active' : ''} onClick={() => setMode('tradeoff')}>{es ? 'Compromisos' : 'Trade-offs'}</button>
          {result.family !== 'magnetic' && <button type="button" role="tab" aria-selected={mode === 'projection'} className={mode === 'projection' ? 'active' : ''} onClick={() => setMode('projection')}>{es ? 'Proyección' : 'Projection'}</button>}
        </div>
      </header>
      {mode === 'projection' && result.family !== 'magnetic' ? <div className="of-investigation-projection"><DecisionSurface params={params} caseId={caseId} es={es} onChoose={(grind, reagent) => onApply({ ...params, grind_p80_um: grind, reagent_gpt: reagent })}/></div> : <>
        <div className="of-investigation-plot">
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={es ? 'Potencia calculada frente a mineral valioso recuperado; puntos factibles y frente no dominado' : 'Calculated power versus recovered valuable mineral; feasible and non-dominated points'}>
            {[0, 1, 2, 3, 4].map(i => <g key={i}>
              <line x1={chart.left + i * (chart.right-chart.left)/4} x2={chart.left + i * (chart.right-chart.left)/4} y1={chart.top} y2={chart.bottom} className="of-envelope-grid"/>
              <line x1={chart.left} x2={chart.right} y1={chart.top + i * (chart.bottom-chart.top)/4} y2={chart.top + i * (chart.bottom-chart.top)/4} className="of-envelope-grid"/>
              <text x={chart.left + i * (chart.right-chart.left)/4} y={chart.bottom+22} textAnchor="middle" className="of-envelope-tick">{num(minX + i * (maxX - minX) / 4, 1)}</text>
              <text x={chart.left-9} y={chart.bottom+4 - i * (chart.bottom-chart.top)/4} textAnchor="end" className="of-envelope-tick">{num(minY + i * (maxY - minY) / 4, 2)}</text>
            </g>)}
            {frontier.length > 1 && <path d={`M ${frontier.map(point => `${sx(point.powerMw)},${sy(point.recoveredValuableTph)}`).join(' L ')}`} className="of-envelope-frontier"/>}
            {result.candidates.map(point => <circle key={point.id} cx={sx(point.powerMw)} cy={sy(point.recoveredValuableTph)} r={point.id === selected.id ? 8 : point.pareto ? 5.5 : 4} className={`of-envelope-dot ${point.feasible ? 'feasible' : 'excluded'} ${point.pareto ? 'pareto' : ''} ${point.id === selected.id ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`${num(point.powerMw, 2)} MW; ${num(point.recoveredValuableTph, 3)} t/h; ${point.feasible ? (es ? 'factible' : 'feasible') : (es ? 'excluido' : 'excluded')}`} onMouseEnter={() => setHoverId(point.id)} onFocus={() => setHoverId(point.id)} onClick={() => inspect(point)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(point); } }}/>) }
            <circle cx={sx(result.baseline.powerMw)} cy={sy(result.baseline.recoveredValuableTph)} r="9" className="of-envelope-baseline"/>
            <text x={sx(result.baseline.powerMw) + 13} y={sy(result.baseline.recoveredValuableTph) - 12} className="of-envelope-label">{es ? 'BASE' : 'BASELINE'}</text>
            <text x={chart.width/2} y={chart.height-7} textAnchor="middle" className="of-envelope-axis">{es ? 'Potencia calculada (MW)' : 'Calculated power (MW)'}</text>
            <text transform={`translate(${compactPlot ? 15 : 15} ${chart.height/2}) rotate(-90)`} textAnchor="middle" className="of-envelope-axis">{es ? 'Mineral valioso recuperado (t/h)' : 'Recovered valuable mineral (t/h)'}</text>
          </svg>
          <div className="of-envelope-legend"><span><i className="pareto"/>{es ? 'No dominado' : 'Non-dominated'}</span><span><i className="feasible"/>{es ? 'Factible' : 'Feasible'}</span><span><i className="excluded"/>{es ? 'Excluido' : 'Excluded'}</span><span><i className="baseline"/>{es ? 'Base actual' : 'Current baseline'}</span></div>
        </div>
        <div className="of-investigation-summary">
          <div><span>{es ? 'Muestra' : 'Sample'}</span><strong>{result.candidates.length}</strong><small>{es ? 'puntos de grilla' : 'grid points'}</small></div>
          <div><span>{es ? 'Factibles' : 'Feasible'}</span><strong>{result.feasibleCount}</strong><small>{es ? 'cumplen todos los límites' : 'meet every limit'}</small></div>
          <div><span>{es ? 'No dominados' : 'Non-dominated'}</span><strong>{result.frontierCount}</strong><small>{es ? 'entre factibles' : 'among feasible'}</small></div>
          <div><span>{es ? 'Punto inspeccionado' : 'Inspected point'}</span><strong>{num(hovered.recoveryPct)}%</strong><small>{num(hovered.energyKwhT)} kWh/t · {num(hovered.gradePct, 2)}% {es ? 'ley' : 'grade'}</small></div>
        </div>
      </>}
    </div>
    <aside className="of-investigation-rail">
      <div className="of-investigation-rail-head"><span className="of-kicker">{es ? 'CRITERIOS' : 'CRITERIA'}</span><button type="button" className="of-text-button" onClick={() => setLimits(defaultEnvelopeLimits(params, caseId))}>{es ? 'Restaurar límites' : 'Reset limits'}</button></div>
      <div className="of-envelope-limits">{(Object.keys(labels) as Array<keyof EnvelopeLimits>).filter(key => result.family !== 'magnetic' || key !== 'maxCollectorGpt').map(key => <label key={key}><span>{es ? labels[key][1] : labels[key][0]} <small>{labels[key][2]}</small></span><input type="number" min="0" step={key === 'minGradePct' ? '0.01' : '0.1'} value={limits[key]} onChange={event => setLimit(key, Number(event.target.value))}/></label>)}</div>
      <div className="of-envelope-selection"><span className="of-kicker">{selected.id === result.recommendedId ? (es ? 'PUNTO MUESTREADO RECOMENDADO' : 'RECOMMENDED SAMPLED POINT') : (es ? 'PUNTO SELECCIONADO' : 'SELECTED POINT')}</span>
        {result.feasibleCount === 0 ? <p className="of-envelope-empty">{es ? 'Ningún punto de la grilla cumple todos los límites. Revise los límites; no se propone un óptimo.' : 'No sampled point meets every limit. Review the limits; no optimum is proposed.'}</p> : <>
          <strong>{num(selected.recoveredValuableTph, 3)} <small>t/h</small></strong>
          <p>{es ? 'Mineral valioso recuperado calculado' : 'Calculated recovered valuable mineral'} <span>({selected.recoveredValuableTph >= result.baseline.recoveredValuableTph ? '+' : ''}{num(selected.recoveredValuableTph - result.baseline.recoveredValuableTph, 3)} t/h {es ? 'frente a base' : 'versus baseline'})</span></p>
          <dl>
            <div><dt>{es ? 'Molienda P80' : 'Grind P80'}</dt><dd>{num(selected.grindUm, 0)} µm</dd></div>
            <div><dt>{result.family === 'magnetic' ? (es ? 'Alimentación' : 'Feed rate') : (es ? 'Colector' : 'Collector')}</dt><dd>{num(selected.secondValue, 0)} {result.family === 'magnetic' ? 't/h' : 'g/t'}</dd></div>
            <div><dt>{es ? 'Recuperación' : 'Recovery'}</dt><dd>{num(selected.recoveryPct)}%</dd></div>
            <div><dt>{es ? 'Ley concentrado' : 'Concentrate grade'}</dt><dd>{num(selected.gradePct, 2)}%</dd></div>
            <div><dt>{es ? 'Potencia / agua' : 'Power / water'}</dt><dd>{num(selected.powerMw, 2)} MW / {num(selected.waterM3H, 0)} m³/h</dd></div>
            <div><dt>{es ? 'Δ potencia / colector' : 'Δ power / collector'}</dt><dd>{selected.powerMw - result.baseline.powerMw >= 0 ? '+' : ''}{num(selected.powerMw - result.baseline.powerMw, 2)} MW / {selected.collectorKgH - result.baseline.collectorKgH >= 0 ? '+' : ''}{num(selected.collectorKgH - result.baseline.collectorKgH, 1)} kg/h</dd></div>
            <div><dt>{es ? 'Recuperación mínima bajo estrés' : 'Stress-minimum recovery'}</dt><dd>{num(selected.stressMinRecoveryPct)}%</dd></div>
          </dl>
          {selected.failures.length > 0 && <p className="of-envelope-fail">{es ? 'Fuera de límite:' : 'Outside limits:'} {selected.failures.map(key => es ? labels[key][1] : labels[key][0]).join(', ')}</p>}
          <div className="of-envelope-actions"><button type="button" className="of-action" disabled={!selected.feasible} onClick={() => onApply(selected.params)}>{es ? 'Aplicar al circuito' : 'Apply to circuit'}</button><button type="button" onClick={exportRecord}>{es ? 'Exportar registro' : 'Export record'}</button></div>
        </>}
      </div>
      <p className="of-envelope-boundary">{es ? 'Barrido finito del simulador del caso. No es un óptimo continuo ni una predicción de planta. El estrés cambia dureza +10% y, si hay clasificador, corte ±10%; no es un intervalo de confianza.' : 'Finite sweep of this case’s simulator. Not a continuous optimum or plant prediction. Stress changes hardness +10% and, where applicable, classifier cut ±10%; it is not a confidence interval.'} <Link to="/benchmark">{es ? 'Comparar ensayos medidos ↗' : 'Compare measured tests ↗'}</Link></p>
    </aside>
  </div>;
}
