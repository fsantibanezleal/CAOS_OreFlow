import { useEffect, useState } from 'react';
import { Cite, Refs, useShellLang } from '@fasl-work/caos-app-shell';
import { loadGeometBenchmark, type GeometBenchmark, type GeometRow } from '../api/artifacts';
import { PageHeading } from '../content/Research';

const MODEL_IDS = ['train_mean', 'ridge', 'random_forest', 'gaussian_process'] as const;
const names: Record<string, [string, string]> = {
  train_mean: ['Training mean', 'Media de entrenamiento'],
  ridge: ['Ridge regression', 'Regresión ridge'],
  random_forest: ['Random forest', 'Bosque aleatorio'],
  gaussian_process: ['Gaussian process', 'Proceso gaussiano'],
};
const fmt = (value: number, digits = 2) => value.toFixed(digits);

function Point({ row, cx, cy, selected, onSelect, label, kind }: { row: GeometRow; cx: number; cy: number; selected: boolean; onSelect: (id: number) => void; label: string; kind: string }) {
  return <circle cx={cx} cy={cy} r={selected ? 7 : 4.3} className={`of-geomet-point ${kind} ${selected ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={label} onMouseEnter={() => onSelect(row.source_row)} onFocus={() => onSelect(row.source_row)} onClick={() => onSelect(row.source_row)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(row.source_row); } }}/>
}

export default function GeometLab() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<GeometBenchmark | null>(null);
  const [error, setError] = useState('');
  const [protocolId, setProtocolId] = useState<'hole' | 'zone'>('hole');
  const [modelId, setModelId] = useState<string>('ridge');
  const [rowId, setRowId] = useState<number | null>(null);
  useEffect(() => { loadGeometBenchmark().then(setData).catch(err => setError(String(err))); }, []);
  if (error) return <div role="alert" className="of-error">{error}</div>;
  if (!data) return <div role="status">{es ? 'Cargando ensayos medidos…' : 'Loading measured tests…'}</div>;
  const protocol = data.protocols[protocolId];
  const selected = protocol.rows.find(row => row.source_row === rowId) ?? protocol.rows[0];
  const values = protocol.rows.flatMap(row => [row.observed_lct_pct, row.predictions_pct[modelId]]);
  const lo = Math.floor(Math.min(...values) / 5) * 5;
  const hi = Math.ceil(Math.max(...values) / 5) * 5;
  const scatterX = (v: number) => 45 + (v - lo) / Math.max(hi - lo, 1) * 370;
  const scatterY = (v: number) => 290 - (v - lo) / Math.max(hi - lo, 1) * 245;
  const xs = protocol.rows.map(row => row.x), ys = protocol.rows.map(row => row.y);
  const mapX = (v: number) => 45 + (v - Math.min(...xs)) / Math.max(Math.max(...xs) - Math.min(...xs), 1) * 370;
  const mapY = (v: number) => 290 - (v - Math.min(...ys)) / Math.max(Math.max(...ys) - Math.min(...ys), 1) * 245;
  const score = protocol.scores[modelId];
  return <div className="of-geomet-lab">
    <PageHeading title={['Measured copper locked-cycle recovery', 'Recuperación medida en ciclo cerrado de cobre']} lede={['This separate experiment evaluates recovery models against 52 measured locked-cycle tests from one deposit. It tests whether assay chemistry can predict held-out test response, not whether OreFlow can set a plant grind, collector dose or residence time.', 'Este experimento separado evalúa modelos de recuperación frente a 52 ensayos medidos de ciclo cerrado de un yacimiento. Prueba si la química puede predecir ensayos reservados; no valida valores de molienda, colector ni residencia para una planta.']} />
    <div className="of-geomet-controls"><label>{es ? 'Partición' : 'Holdout'}<select value={protocolId} onChange={event => { setProtocolId(event.target.value as 'hole' | 'zone'); setRowId(null); }}><option value="hole">{es ? 'Pozos completos · 5 pliegues' : 'Complete holes · 5 folds'}</option><option value="zone">{es ? 'Zonas espaciales · 3 pliegues' : 'Spatial zones · 3 folds'}</option></select></label><label>{es ? 'Modelo' : 'Model'}<select value={modelId} onChange={event => setModelId(event.target.value)}>{MODEL_IDS.map(id => <option key={id} value={id}>{names[id][es ? 1 : 0]}</option>)}</select></label><div><span>{es ? 'MAE reservado' : 'Held-out MAE'}</span><strong>{fmt(score.mae_pp)} <small>pp</small></strong></div><div><span>{es ? 'RMSE reservado' : 'Held-out RMSE'}</span><strong>{fmt(score.rmse_pp)} <small>pp</small></strong></div></div>
    <div className="of-geomet-viz-grid">
      <section className="of-geomet-figure"><h2>{es ? 'Ensayo observado frente a predicción reservada' : 'Observed test versus held-out prediction'}</h2><svg viewBox="0 0 465 350" role="img" aria-label={es ? 'Recuperación LCT observada frente a predicción por muestra' : 'Observed versus predicted LCT recovery by sample'}>
        {[0,1,2,3,4].map(i => <g key={i}><line x1={45+i*92.5} x2={45+i*92.5} y1="45" y2="290" className="of-geomet-grid"/><line x1="45" x2="415" y1={45+i*61.25} y2={45+i*61.25} className="of-geomet-grid"/><text x={45+i*92.5} y="309" textAnchor="middle">{fmt(lo+i*(hi-lo)/4,0)}</text><text x="38" y={294-i*61.25} textAnchor="end">{fmt(lo+i*(hi-lo)/4,0)}</text></g>)}
        <line x1={scatterX(lo)} y1={scatterY(lo)} x2={scatterX(hi)} y2={scatterY(hi)} className="of-geomet-identity"/>
        {protocol.rows.map(row => <Point key={row.source_row} row={row} cx={scatterX(row.observed_lct_pct)} cy={scatterY(row.predictions_pct[modelId])} selected={row.source_row === selected.source_row} onSelect={setRowId} label={`${es ? 'Fila' : 'Row'} ${row.source_row}, ${es ? 'observada' : 'observed'} ${fmt(row.observed_lct_pct)}%, ${es ? 'predicha' : 'predicted'} ${fmt(row.predictions_pct[modelId])}%`} kind="prediction"/>)}
        <text x="230" y="343" textAnchor="middle" className="of-geomet-axis">{es ? 'LCT observado (%)' : 'Observed LCT (%)'}</text><text transform="translate(12 165) rotate(-90)" textAnchor="middle" className="of-geomet-axis">{es ? 'Predicción (%)' : 'Prediction (%)'}</text>
      </svg></section>
      <section className="of-geomet-figure"><h2>{es ? 'Ubicación de los ensayos y error' : 'Test locations and error'}</h2><svg viewBox="0 0 465 350" role="img" aria-label={es ? 'Coordenadas locales de ensayos; color indica signo del error' : 'Local test coordinates; color indicates error sign'}>
        {[0,1,2,3,4].map(i => <g key={i}><line x1={45+i*92.5} x2={45+i*92.5} y1="45" y2="290" className="of-geomet-grid"/><line x1="45" x2="415" y1={45+i*61.25} y2={45+i*61.25} className="of-geomet-grid"/></g>)}
        {protocol.rows.map(row => <Point key={row.source_row} row={row} cx={mapX(row.x)} cy={mapY(row.y)} selected={row.source_row === selected.source_row} onSelect={setRowId} label={`${es ? 'Pozo' : 'Hole'} ${row.hole_id}, X ${fmt(row.x,0)}, Y ${fmt(row.y,0)}, ${es ? 'error' : 'error'} ${fmt(row.predictions_pct[modelId]-row.observed_lct_pct)} pp`} kind={row.predictions_pct[modelId] >= row.observed_lct_pct ? 'over' : 'under'}/>)}
        <text x="230" y="332" textAnchor="middle" className="of-geomet-axis">{es ? 'Coordenada local X (m)' : 'Local X coordinate (m)'}</text><text transform="translate(12 165) rotate(-90)" textAnchor="middle" className="of-geomet-axis">{es ? 'Coordenada local Y (m)' : 'Local Y coordinate (m)'}</text>
      </svg><div className="of-geomet-legend"><span><i className="over"/> {es ? 'Sobrepredicción' : 'Overprediction'}</span><span><i className="under"/> {es ? 'Subpredicción' : 'Underprediction'}</span></div></section>
    </div>
    <div className="of-geomet-bottom"><section><h2>{es ? 'Muestra inspeccionada' : 'Inspected sample'}</h2><dl><div><dt>{es ? 'Pozo / fila fuente' : 'Hole / source row'}</dt><dd>{selected.hole_id} / {selected.source_row}</dd></div><div><dt>{es ? 'LCT medido' : 'Measured LCT'}</dt><dd>{fmt(selected.observed_lct_pct)}%</dd></div><div><dt>{es ? 'Predicción reservada' : 'Held-out prediction'}</dt><dd>{fmt(selected.predictions_pct[modelId])}%</dd></div><div><dt>{es ? 'Error firmado' : 'Signed error'}</dt><dd>{fmt(selected.predictions_pct[modelId]-selected.observed_lct_pct)} pp</dd></div><div><dt>{es ? 'Pliegue de prueba' : 'Test fold'}</dt><dd>{selected.fold + 1}</dd></div></dl></section><section><h2>{es ? 'Misma partición, cuatro comparadores' : 'Same holdout, four comparators'}</h2><table className="of-info-table"><thead><tr><th>{es ? 'Modelo' : 'Model'}</th><th>MAE · pp</th><th>RMSE · pp</th><th>R²</th></tr></thead><tbody>{MODEL_IDS.map(id => <tr key={id} className={id === modelId ? 'selected' : ''}><th><button type="button" aria-pressed={id === modelId} onClick={() => setModelId(id)}>{names[id][es ? 1 : 0]}</button></th><td>{fmt(protocol.scores[id].mae_pp)}</td><td>{fmt(protocol.scores[id].rmse_pp)}</td><td>{fmt(protocol.scores[id].r2)}</td></tr>)}</tbody></table></section></div>
    <section className="of-geomet-notes"><h2>{es ? 'Interpretación y procedencia' : 'Interpretation and provenance'}</h2><p>{es ? `La fuente contiene ${data.source.raw_rows} filas, de las que ${data.source.exclusions.length} carece de LCT válido; se evalúan ${data.source.usable_rows} ensayos en ${data.source.holes} pozos. Cada predicción graficada es externa al pliegue de entrenamiento. Los cinco ensayos químicos (Cu, Fe, S, Si, Al) se transforman e imputan solo dentro del entrenamiento. La reserva espacial deja fuera una zona de pozos completos por pliegue.` : `The source has ${data.source.raw_rows} rows; ${data.source.exclusions.length} lacks a valid LCT target. Evaluation uses ${data.source.usable_rows} tests from ${data.source.holes} holes. Every plotted prediction is out-of-fold. Five assays (Cu, Fe, S, Si, Al) are transformed and imputed inside training folds only. Spatial holdout leaves one zone of complete holes out per fold.`} <Cite id="geomet" /> <Cite id="geomet-paper" /></p><p>{es ? 'Los LCT son ensayos metalúrgicos de un yacimiento, no estados de una planta en operación. No se conocen molienda, dosis de colector ni residencia para estas filas; por tanto esta evaluación no calibra el simulador de OreFlow ni autoriza puntos de operación.' : 'These LCT results are metallurgical tests from one deposit, not operating-plant states. Grind, collector dose and residence are absent from these rows; this evaluation therefore does not calibrate OreFlow’s simulator or justify operating set-points.'}</p><Refs ids={['geomet','geomet-paper','sklearn']} label={es ? 'Referencias' : 'References'}/></section>
  </div>;
}
