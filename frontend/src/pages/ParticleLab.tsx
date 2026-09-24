import { useEffect, useRef, useState } from 'react';
import { Cite, Refs, useShellLang } from '@fasl-work/caos-app-shell';
import { loadParticleBenchmark, type ParticleBenchmark, type ParticleThreshold } from '../api/artifacts';
import { PageHeading } from '../content/Research';

const MODEL_IDS = ['published_reference', 'l1_logistic', 'particle_mlp'] as const;
const MODEL_COLORS: Record<string, string> = {
  published_reference: 'var(--color-fg-subtle)',
  l1_logistic: 'var(--color-accent)',
  particle_mlp: 'var(--color-warn)',
};

function name(id: string, es: boolean) {
  if (id === 'published_reference') return es ? 'Referencia publicada' : 'Published reference';
  if (id === 'l1_logistic') return es ? 'Regresión logística L1' : 'L1 logistic';
  return 'PyTorch MLP';
}

function ThresholdChart({ models, selected, threshold, onThreshold, es }: {
  models: Record<string, { thresholds: ParticleThreshold[] }>;
  selected: string; threshold: number; onThreshold: (value: number) => void; es: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(300, Math.floor(entries[0].contentRect.width))));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  const left = 44, right = 16, top = 14, bottom = 34, height = 258;
  const x = (value: number) => left + value * (width - left - right);
  const y = (value: number) => top + (1 - value) * (height - top - bottom);
  const highlighted = models[selected].thresholds[Math.round(threshold * 100)];
  const points = (rows: ParticleThreshold[]) => rows.map(row => `${x(row.selected_fraction).toFixed(1)},${y(row.expected_recovery).toFixed(1)}`).join(' ');
  return <div className="of-particle-chart" ref={box}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={es ? 'Fracción seleccionada versus recuperación esperada para tres modelos' : 'Selected fraction versus expected recovery for three models'} onClick={event => {
      const svg = event.currentTarget;
      const transform = svg.getScreenCTM();
      if (!transform) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX; point.y = event.clientY;
      const svgX = point.matrixTransform(transform.inverse()).x;
      const selectedFraction = Math.max(0, Math.min(1, (svgX - left) / (width - left - right)));
      const nearest = models[selected].thresholds.reduce((best, row) => Math.abs(row.selected_fraction - selectedFraction) < Math.abs(best.selected_fraction - selectedFraction) ? row : best);
      onThreshold(nearest.threshold);
    }}>
      {[0, 0.25, 0.5, 0.75, 1].map(tick => <g key={tick}>
        <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="var(--color-border)" strokeDasharray="3 5" />
        <text x={left - 7} y={y(tick) + 4} textAnchor="end">{Math.round(tick * 100)}%</text>
        <text x={x(tick)} y={height - 13} textAnchor="middle">{Math.round(tick * 100)}%</text>
      </g>)}
      {MODEL_IDS.map(id => <polyline key={id} points={points(models[id].thresholds)} fill="none" stroke={MODEL_COLORS[id]} strokeWidth={id === selected ? 3 : 1.7} opacity={id === selected ? 1 : 0.6} />)}
      <line x1={x(highlighted.selected_fraction)} x2={x(highlighted.selected_fraction)} y1={top} y2={height - bottom} stroke="var(--color-accent)" strokeDasharray="5 5" />
      <circle cx={x(highlighted.selected_fraction)} cy={y(highlighted.expected_recovery)} r="6" fill={MODEL_COLORS[selected]} stroke="var(--color-bg)" strokeWidth="2" />
    </svg>
    <div className="of-particle-axis"><span>{es ? 'Fracción de partículas seleccionadas →' : 'Fraction of particles selected →'}</span><span>{es ? '↑ Captura esperada de clase B' : '↑ Expected Class B capture'}</span></div>
  </div>;
}

export default function ParticleLab() {
  const es = useShellLang() === 'es';
  const [data, setData] = useState<ParticleBenchmark | null>(null);
  const [error, setError] = useState('');
  const [caseId, setCaseId] = useState('1');
  const [model, setModel] = useState<string>('particle_mlp');
  const [threshold, setThreshold] = useState(0.5);
  useEffect(() => { loadParticleBenchmark().then(setData).catch(e => setError(String(e))); }, []);
  if (error) return <div role="alert" className="of-error">{error}</div>;
  if (!data) return <div role="status">{es ? 'Cargando experimento de partículas…' : 'Loading particle experiment…'}</div>;
  const selectedCase = data.cases.find(entry => entry.case === caseId)!;
  const selectedModel = selectedCase.models[model];
  const point = selectedModel.thresholds[Math.round(threshold * 100)];
  return <div className="of-particle-page">
    <PageHeading title={['Particle-level separation learning', 'Aprendizaje de separación a nivel de partícula']} lede={[
      'The published HZDR workbook provides 68,008 training particles and a separate 29,147-particle test sheet for four constructed separation cases. OreFlow trains L1 logistic and GPU-capable neural models on the training classes, then compares held-out probabilities with the workbook’s constructed oracle, not with a mine’s measured recovery.',
      'El libro público de HZDR contiene 68.008 partículas de entrenamiento y una hoja separada de 29.147 partículas de prueba para cuatro casos de separación construidos. OreFlow entrena modelos logísticos L1 y neuronales, y compara probabilidades reservadas con el oráculo construido del libro, no con recuperación medida en una mina.',
    ]} />
    <div className="of-particle-toolbar">
      <label>{es ? 'Caso construido' : 'Constructed case'}<select value={caseId} onChange={event => { setCaseId(event.target.value); setThreshold(0.5); }}>{data.cases.map(entry => <option key={entry.case} value={entry.case}>{es ? 'Caso' : 'Case'} {entry.case}</option>)}</select></label>
      <label>{es ? 'Modelo de selección' : 'Selection model'}<select value={model} onChange={event => setModel(event.target.value)}>{MODEL_IDS.map(id => <option value={id} key={id}>{name(id, es)}</option>)}</select></label>
      <label className="of-particle-threshold">{es ? 'Umbral de clase B' : 'Class B threshold'} <strong>{threshold.toFixed(2)}</strong><input type="range" min="0" max="1" step="0.01" value={threshold} onChange={event => setThreshold(Number(event.target.value))} /></label>
    </div>
    <div className="of-particle-body">
      <section className="of-particle-main">
        <div className="of-particle-head"><div><span className="of-kicker">01 / {es ? 'INTERACCIÓN DE UMBRAL' : 'THRESHOLD INTERACTION'}</span><h2>{es ? 'Fracción seleccionada y captura esperada' : 'Selected fraction and expected capture'}</h2></div><span>{selectedCase.test_rows.toLocaleString()} {es ? 'partículas comparables' : 'comparable test particles'}</span></div>
        <ThresholdChart models={selectedCase.models} selected={model} threshold={threshold} onThreshold={setThreshold} es={es} />
        <div className="of-particle-legend">{MODEL_IDS.map(id => <span key={id}><i style={{ background: MODEL_COLORS[id] }} />{name(id, es)}</span>)}</div>
        <p className="of-particle-note">{es ? 'Cada curva integra las probabilidades construidas del conjunto de prueba en partículas con puntaje superior al umbral. No mide recuperación de una planta. Haga clic en la curva para mover el umbral.' : 'Each curve integrates constructed test-sheet probabilities over particles scoring above the threshold. It is not plant recovery. Click the curve to move the threshold.'} <Cite id="hzdr" /></p>
      </section>
      <aside className="of-particle-side">
        <span className="of-kicker">02 / {es ? 'ESTADO DEL ENSAYO' : 'EXPERIMENT STATE'}</span>
        <div><span>{es ? 'Partículas seleccionadas' : 'Particles selected'}</span><strong>{(point.selected_fraction * 100).toFixed(1)}%</strong></div>
        <div><span>{es ? 'Captura esperada de B' : 'Expected B capture'}</span><strong>{(point.expected_recovery * 100).toFixed(1)}%</strong></div>
        <div><span>{es ? 'Probabilidad media seleccionada' : 'Selected mean oracle probability'}</span><strong>{(point.expected_grade_proxy * 100).toFixed(1)}%</strong></div>
        <div><span>{es ? 'RMSE probabilístico' : 'Probability RMSE'}</span><strong>{selectedModel.rmse.toFixed(4)}</strong></div>
        <p>{es ? 'La hoja de prueba no contiene clases A/B observadas. Los valores esperados usan Probability 1–4 como oráculo construido.' : 'The test sheet has no observed A/B classes. Expected values use Probability 1–4 as a constructed oracle.'}</p>
      </aside>
    </div>
    <section className="of-particle-protocol"><h2>{es ? 'Protocolo y límites' : 'Protocol and limits'}</h2>
      <p>{es ? 'Entrenamiento y prueba son las hojas originales de HZDR. Solo cuatro variables medidas/derivadas de partícula entran al modelo: razón de aspecto, solidez, ECD y superficie de mineral 1. Probabilidades, predicciones publicadas y clases de otros casos se excluyen de las variables. El 15% de entrenamiento se reserva para detener el MLP.' : 'Training and test are the original HZDR sheets. Only four particle features enter the model: aspect ratio, solidity, ECD and mineral-1 surface. Probability columns, published predictions and other case classes are excluded from features. Fifteen percent of training rows is reserved for MLP early stopping.'} <Cite id="hzdr" /></p>
      <p>{es ? `Caso ${caseId}: se excluyeron ${selectedCase.excluded_test_rows} filas por probabilidades de referencia/oráculo ausentes; todos los modelos se comparan en las mismas ${selectedCase.test_rows} filas. Entrenamiento neural: ${data.protocol.device.toUpperCase()}.` : `Case ${caseId}: ${selectedCase.excluded_test_rows} rows with missing oracle/reference probabilities were excluded; all models use the same ${selectedCase.test_rows} comparable rows. Neural training: ${data.protocol.device.toUpperCase()}.`}</p>
      <div className="of-table-wrap"><table className="of-info-table"><thead><tr><th>{es ? 'Modelo' : 'Model'}</th><th>RMSE</th><th>MAE</th><th>{es ? 'Sesgo' : 'Bias'}</th></tr></thead><tbody>{MODEL_IDS.map(id => <tr key={id}><th>{name(id, es)}</th><td>{selectedCase.models[id].rmse.toFixed(4)}</td><td>{selectedCase.models[id].mae.toFixed(4)}</td><td>{selectedCase.models[id].bias.toFixed(4)}</td></tr>)}</tbody></table></div>
      <p>{es ? 'La referencia publicada ya figura en la hoja de prueba y no se reentrenó aquí. Un error menor frente a la probabilidad construida no prueba desempeño industrial ni generalización a otro mineral.' : 'The published reference is supplied in the test sheet and was not retrained here. Lower error against a constructed probability does not prove industrial performance or transfer to another ore.'} <Cite id="particle-paper" /></p>
    </section>
    <Refs ids={['hzdr', 'particle-paper', 'sklearn', 'pytorch']} label={es ? 'Referencias' : 'References'} />
  </div>;
}
