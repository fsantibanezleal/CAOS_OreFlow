/**
 * Benchmark, the two measured lanes (ADR-0016 section 9.C): the GeoMet locked-cycle tests with their
 * grouped folds and paired bootstrap, the HZDR particles with their probability errors, threshold and
 * calibration curves, and the particle network run in the browser. Transcribed from the particle-lane
 * and GeoMet-lane data contracts; every number is read from the committed lane artifacts.
 */
import { useRef, useState } from 'react';
import type uPlot from 'uplot';
import { Chart } from '../components/charts/Chart';
import { loadGeometBenchmark, loadParticleBenchmark, type GeometRow, type ParticleThreshold } from '../lib/artifacts';
import { formatFixed, formatFraction, type Lang } from '../lib/format';
import { APP_VERSION } from '../lib/version';
import { Loaded, useArtifact } from './data';
import type { Bi, Topic } from './doc';
import { Arrow, Box, pick } from './figures';

const r = String.raw;

const GEOMET_MODELS = ['train_mean', 'ridge', 'random_forest', 'gaussian_process'];
const PARTICLE_MODELS = ['published_reference', 'l1_logistic', 'particle_mlp'];
const NAME: Record<string, Bi> = {
  train_mean: { en: 'Training mean', es: 'Media de entrenamiento' },
  ridge: { en: 'Ridge', es: 'Ridge' },
  random_forest: { en: 'Random forest', es: 'Bosque aleatorio' },
  gaussian_process: { en: 'Gaussian process', es: 'Proceso gaussiano' },
  published_reference: { en: 'Published reference', es: 'Referencia publicada' },
  l1_logistic: { en: 'L1 logistic', es: 'Logística L1' },
  particle_mlp: { en: 'PyTorch MLP', es: 'MLP de PyTorch' },
};
const PROTOCOL: Record<string, Bi> = {
  hole: { en: 'Whole drill holes, 5 folds', es: 'Sondajes completos, 5 particiones' },
  zone: { en: 'Spatial zones, 3 folds', es: 'Zonas espaciales, 3 particiones' },
};

const TEXT = {
  protocol: { en: 'Held out', es: 'Reservado' },
  model: { en: 'Model', es: 'Modelo' },
  observed: { en: 'Observed LCT recovery (%)', es: 'Recuperación LCT observada (%)' },
  predicted: { en: 'Out-of-fold prediction (%)', es: 'Predicción fuera de la partición (%)' },
  identity: { en: 'prediction = observation', es: 'predicción = observación' },
  scatterTitle: { en: 'Observed test against its held-out prediction', es: 'Ensayo observado frente a su predicción reservada' },
  scatterSummary: { en: 'Each of the 52 locked-cycle tests against the chosen model\'s prediction made without its drill hole or zone.', es: 'Cada uno de los 52 ensayos de ciclo cerrado frente a la predicción del modelo elegido hecha sin su sondaje o zona.' },
  x: { en: 'Local X (m)', es: 'X local (m)' },
  y: { en: 'Local Y (m)', es: 'Y local (m)' },
  over: { en: 'overpredicted', es: 'sobreestimado' },
  under: { en: 'underpredicted', es: 'subestimado' },
  mapTitle: { en: 'Where the tests are and how the prediction misses', es: 'Dónde están los ensayos y cómo falla la predicción' },
  mapSummary: { en: 'The local coordinates of the tests, split by whether the chosen model over- or underpredicts them.', es: 'Las coordenadas locales de los ensayos, separadas según si el modelo elegido los sobreestima o subestima.' },
  mae: { en: 'MAE (pp)', es: 'MAE (pp)' },
  rmse: { en: 'RMSE (pp)', es: 'RMSE (pp)' },
  interval: { en: 'RMSE 95% interval (pp)', es: 'Intervalo 95% del RMSE (pp)' },
  bias: { en: 'Bias (pp)', es: 'Sesgo (pp)' },
  biasShort: { en: 'bias', es: 'sesgo' },
  scoresCaption: { en: 'Held-out scores of the four models under both protocols, with the paired bootstrap\'s 95% interval of each RMSE ({n} resamples of whole holes).', es: 'Puntajes reservados de los cuatro modelos bajo ambos protocolos, con el intervalo del 95% del RMSE del bootstrap pareado ({n} remuestreos de sondajes completos).' },
  pair: { en: 'Pair (first minus second RMSE)', es: 'Par (RMSE del primero menos el del segundo)' },
  diff: { en: 'Mean difference (pp)', es: 'Diferencia media (pp)' },
  share: { en: 'First better', es: 'El primero mejor' },
  excludes: { en: 'Interval excludes 0', es: 'Intervalo excluye 0' },
  diffInterval: { en: '95% interval of the difference (pp)', es: 'Intervalo 95% de la diferencia (pp)' },
  pairsCaption: { en: 'Every pair of models on the same resampled holes: the difference carries their shared sampling noise once.', es: 'Cada par de modelos sobre los mismos sondajes remuestreados: la diferencia lleva una sola vez su ruido de muestreo compartido.' },
  yes: { en: 'yes', es: 'sí' },
  no: { en: 'no', es: 'no' },
  reading: { en: 'Point at a test to read it', es: 'Apunte a un ensayo para leerlo' },
  hole: { en: 'hole', es: 'sondaje' },
  case: { en: 'Constructed case', es: 'Caso construido' },
  threshold: { en: 'Class B threshold', es: 'Umbral de clase B' },
  fraction: { en: 'Share of particles selected (%)', es: 'Fracción de partículas seleccionadas (%)' },
  capture: { en: 'Expected class B capture (%)', es: 'Captura esperada de clase B (%)' },
  thresholdTitle: { en: 'Expected capture against the share selected', es: 'Captura esperada frente a la fracción seleccionada' },
  thresholdSummary: { en: 'For the chosen constructed case, the share of test particles each model selects above a threshold and the class B probability they carry.', es: 'Para el caso construido elegido, la fracción de partículas de prueba que cada modelo selecciona sobre un umbral y la probabilidad de clase B que llevan.' },
  atThreshold: { en: 'At the threshold: {model} selects {sel} of the particles and captures {cap} of the expected class B, at a mean probability of {grade}.', es: 'En el umbral: {model} selecciona {sel} de las partículas y captura {cap} de la clase B esperada, con una probabilidad media de {grade}.' },
  calibTitle: { en: 'Calibration against the constructed probability', es: 'Calibración frente a la probabilidad construida' },
  calibSummary: { en: 'The mean predicted probability of each bin against the mean constructed probability of its particles, for the three models.', es: 'La probabilidad media predicha de cada intervalo frente a la probabilidad construida media de sus partículas, para los tres modelos.' },
  calibX: { en: 'Mean predicted probability', es: 'Probabilidad predicha media' },
  calibY: { en: 'Mean constructed probability', es: 'Probabilidad construida media' },
  metricsCaption: { en: 'Probability errors against the constructed probability of the test sheet; case 4 compares {rows} rows, the {excluded} without an oracle or reference value excluded.', es: 'Errores de probabilidad frente a la probabilidad construida de la hoja de prueba; el caso 4 compara {rows} filas, excluidas las {excluded} sin valor de oráculo o de referencia.' },
  caseN: { en: 'Case', es: 'Caso' },
  mark: { en: 'threshold', es: 'umbral' },
  run: { en: 'Run the network in the browser', es: 'Ejecutar la red en el navegador' },
  running: { en: 'Running', es: 'Ejecutando' },
  resultTitle: { en: 'Class B probability for each constructed case', es: 'Probabilidad de clase B para cada caso construido' },
  resultSummary: { en: 'The exported network\'s class B probability for the particle as set, one bar per constructed case.', es: 'La probabilidad de clase B de la red exportada para la partícula tal como está, una barra por caso construido.' },
  probability: { en: 'Class B probability', es: 'Probabilidad de clase B' },
  empty: { en: 'Set a particle and run the network: the four probabilities appear here.', es: 'Ajuste una partícula y ejecute la red: las cuatro probabilidades aparecen aquí.' },
  failed: { en: 'The network could not run', es: 'La red no pudo ejecutarse' },
};

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? key);
const signed = (value: number, lang: Lang, decimals: number) => `${value > 0 ? '+' : ''}${formatFixed(value, lang, decimals)}`;

function GeometFoldsFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const colours = ['dg-fill-accent', 'dg-fill-warn', 'dg-bar', 'dg-bar-2', 'dg-box accent'];
  const holes = Array.from({ length: 29 }, (_, i) => i);
  return (
    <svg className="fig-svg" viewBox="0 0 440 222" role="img" aria-label={p('Tests grouped by whole drill hole into five folds, and holes grouped by position into three zones', 'Ensayos agrupados por sondaje completo en cinco particiones, y sondajes agrupados por posición en tres zonas')}>
      <text className="dg-box-title" x="12" y="22">{p('whole drill holes: 5 folds', 'sondajes completos: 5 particiones')}</text>
      {holes.map(i => <circle key={`h${i}`} cx={20 + 14 * i} cy="46" r="5.5" className={colours[(i * 3) % 5]} />)}
      <text className="dg-box-sub" x="12" y="76">{p('a hole never has tests on both sides of a split', 'un sondaje nunca tiene ensayos a ambos lados de una partición')}</text>
      <text className="dg-box-title" x="12" y="116">{p('spatial zones: 3 folds by mean X', 'zonas espaciales: 3 particiones por X media')}</text>
      {holes.map(i => <circle key={`z${i}`} cx={20 + 14 * i} cy="140" r="5.5" className={colours[i < 10 ? 0 : i < 20 ? 1 : 2]} />)}
      <line className="dg-marker" x1="153" y1="128" x2="153" y2="152" />
      <line className="dg-marker" x1="293" y1="128" x2="293" y2="152" />
      <text className="dg-box-sub" x="12" y="170">{p('a whole zone of holes is held out at a time', 'se reserva una zona completa de sondajes a la vez')}</text>
      <text className="dg-note" x="220" y="208" textAnchor="middle">{p('29 holes, 52 tests; the assays are imputed and scaled inside each fold', '29 sondajes, 52 ensayos; los ensayes se imputan y escalan dentro de cada partición')}</text>
    </svg>
  );
}

function GeometPanel({ lang }: { lang: Lang }) {
  const geomet = useArtifact(loadGeometBenchmark);
  const [protocol, setProtocol] = useState<'hole' | 'zone'>('hole');
  const [model, setModel] = useState('ridge');
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[geomet.error]} ready={Boolean(geomet.value)}>
      {() => {
        const g = geomet.value!;
        const pr = g.protocols[protocol];
        const rows = [...pr.rows].sort((a, b) => a.observed_lct_pct - b.observed_lct_pct);
        const describe = (row: GeometRow) => `${TEXT.hole[lang]} ${row.hole_id}: ${formatFixed(row.observed_lct_pct, lang, 1)}% / ${formatFixed(row.predictions_pct[model], lang, 1)}% (${signed(row.predictions_pct[model] - row.observed_lct_pct, lang, 1)} pp)`;
        const byX = [...pr.rows].sort((a, b) => a.x - b.x);
        const miss = (row: GeometRow) => row.predictions_pct[model] - row.observed_lct_pct;
        const boot = (id: 'hole' | 'zone') => g.protocols[id].paired_bootstrap;
        return (
          <div className="of-doc-panel">
            <div className="of-doc-controls">
              <label className="of-doc-control"><span>{TEXT.protocol[lang]}</span>
                <select value={protocol} onChange={e => setProtocol(e.target.value as 'hole' | 'zone')}>{(['hole', 'zone'] as const).map(id => <option key={id} value={id}>{PROTOCOL[id][lang]}</option>)}</select></label>
              <label className="of-doc-control"><span>{TEXT.model[lang]}</span>
                <select value={model} onChange={e => setModel(e.target.value)}>{GEOMET_MODELS.map(id => <option key={id} value={id}>{NAME[id][lang]}</option>)}</select></label>
            </div>
            <div className="of-doc-charts-2">
              <div className="of-doc-chart">
                <Chart data={[rows.map(row => row.observed_lct_pct), rows.map(row => row.predictions_pct[model]), rows.map(row => row.observed_lct_pct)] as uPlot.AlignedData}
                  xLabel={TEXT.observed[lang]} yLabel={TEXT.predicted[lang]} title={TEXT.scatterTitle[lang]} summary={TEXT.scatterSummary[lang]}
                  series={[{ label: NAME[model][lang], colour: 'accent', points: true }, { label: TEXT.identity[lang], colour: 'subtle', dash: [5, 4] }]}
                  format={(v, axis) => (v === null ? '-' : `${formatFixed(v, lang, 1)}%`)}
                  onCursor={c => setReading(c ? describe(rows[c.index]) : null)} />
              </div>
              <div className="of-doc-chart">
                <Chart data={[byX.map(row => row.x), byX.map(row => (miss(row) >= 0 ? row.y : null)), byX.map(row => (miss(row) < 0 ? row.y : null))] as uPlot.AlignedData}
                  xLabel={TEXT.x[lang]} yLabel={TEXT.y[lang]} title={TEXT.mapTitle[lang]} summary={TEXT.mapSummary[lang]}
                  series={[{ label: TEXT.over[lang], colour: 'warn', points: true }, { label: TEXT.under[lang], colour: 'accent-2', points: true }]}
                  format={(v) => (v === null ? '-' : formatFixed(v, lang, 0))}
                  onCursor={c => setReading(c ? describe(byX[c.index]) : null)} />
              </div>
            </div>
            <p className="of-doc-reading" aria-live="polite">{reading ?? TEXT.reading[lang]}</p>
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{fill(TEXT.scoresCaption[lang], { n: formatFixed(boot('hole').samples, lang, 0) })}</caption>
                <thead><tr>{[TEXT.protocol, TEXT.model, TEXT.mae, TEXT.rmse, TEXT.interval, { en: 'R²', es: 'R²' }, TEXT.bias].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
                <tbody>{(['hole', 'zone'] as const).flatMap(id => GEOMET_MODELS.map((m, i) => {
                  const s = g.protocols[id].scores[m], ci = boot(id).rmse_interval_95_pp[m];
                  return (
                    <tr key={`${id}-${m}`} className={i === 0 ? 'of-doc-group' : undefined}>
                      <th scope="row">{i === 0 ? PROTOCOL[id][lang] : ''}</th>
                      <td>{NAME[m][lang]}</td>
                      <td>{formatFixed(s.mae_pp, lang, 2)}</td>
                      <td>{formatFixed(s.rmse_pp, lang, 2)}</td>
                      <td>{`${formatFixed(ci[0], lang, 2)} - ${formatFixed(ci[1], lang, 2)}`}</td>
                      <td>{formatFixed(s.r2, lang, 3)}</td>
                      <td>{signed(s.bias_pp, lang, 2)}</td>
                    </tr>
                  );
                }))}</tbody>
              </table>
            </div>
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{TEXT.pairsCaption[lang]}</caption>
                <thead><tr>{[TEXT.protocol, TEXT.pair, TEXT.diff, TEXT.diffInterval, TEXT.share, TEXT.excludes].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
                <tbody>{(['hole', 'zone'] as const).flatMap(id => Object.entries(boot(id).rmse_differences).map(([pair, d], i) => {
                  const [a, b] = pair.split('-');
                  return (
                    <tr key={`${id}-${pair}`} className={i === 0 ? 'of-doc-group' : undefined}>
                      <th scope="row">{i === 0 ? PROTOCOL[id][lang] : ''}</th>
                      <td>{`${NAME[a]?.[lang] ?? a} - ${NAME[b]?.[lang] ?? b}`}</td>
                      <td>{signed(d.mean_pp, lang, 2)}</td>
                      <td>{`${signed(d.interval_95_pp[0], lang, 2)} ; ${signed(d.interval_95_pp[1], lang, 2)}`}</td>
                      <td>{formatFraction(d.share_first_better, lang, 1)}</td>
                      <td className={d.excludes_zero ? 'of-up' : undefined}>{d.excludes_zero ? TEXT.yes[lang] : TEXT.no[lang]}</td>
                    </tr>
                  );
                }))}</tbody>
              </table>
            </div>
          </div>
        );
      }}
    </Loaded>
  );
}

function ParticleFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-lane-arrow)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 236" role="img" aria-label={p('The training sheet trains the models; the separate test sheet scores them against its constructed probabilities', 'La hoja de entrenamiento entrena los modelos; la hoja de prueba separada los evalúa contra sus probabilidades construidas')}>
      <Arrow id="of-lane-arrow" />
      <Box x={10} y={14} w={196} h={62} title={p('Training sheet', 'Hoja de entrenamiento')} lines={[p('68,008 particles, A/B classes', '68.008 partículas, clases A/B'), p('4 constructed cases', '4 casos construidos')]} kind="accent" />
      <Box x={234} y={14} w={196} h={62} title={p('Test sheet', 'Hoja de prueba')} lines={[p('29,147 particles', '29.147 partículas'), p('constructed probabilities', 'probabilidades construidas')]} kind="good" />
      <line className="dg-edge" x1="108" y1="76" x2="108" y2="104" markerEnd={arrow} />
      <Box x={10} y={106} w={196} h={62} title={p('Models, 4 features', 'Modelos, 4 variables')} lines={[p('L1 logistic per case', 'logística L1 por caso'), p('MLP 4-32-32-4, 15% to stop', 'MLP 4-32-32-4, 15% para detener')]} />
      <line className="dg-edge" x1="206" y1="137" x2="232" y2="137" markerEnd={arrow} />
      <line className="dg-edge" x1="332" y1="76" x2="332" y2="104" markerEnd={arrow} />
      <Box x={234} y={106} w={196} h={62} title={p('Scores', 'Puntajes')} lines={[p('probability RMSE, MAE, bias', 'RMSE, MAE y sesgo'), p('beside the published model', 'junto al modelo publicado')]} />
      <text className="dg-note" x="220" y="200" textAnchor="middle">{p('the test sheet has no observed classes:', 'la hoja de prueba no tiene clases observadas:')}</text>
      <text className="dg-note" x="220" y="216" textAnchor="middle">{p('errors are against constructed probabilities, not accuracy', 'los errores son contra probabilidades construidas, no exactitud')}</text>
    </svg>
  );
}

/** One series per model on a merged x axis: each model's curve is defined at its own x values. */
function merged(curves: Array<Array<[number, number]>>): uPlot.AlignedData {
  const xs = [...new Set(curves.flatMap(c => c.map(([x]) => x)))].sort((a, b) => a - b);
  const at = curves.map(c => new Map(c.map(([x, y]) => [x, y])));
  return [xs, ...at.map(m => xs.map(x => m.get(x) ?? null))] as uPlot.AlignedData;
}

function ParticlePanel({ lang }: { lang: Lang }) {
  const particles = useArtifact(loadParticleBenchmark);
  const [caseId, setCaseId] = useState('1');
  const [model, setModel] = useState('particle_mlp');
  const [threshold, setThreshold] = useState(0.5);
  return (
    <Loaded lang={lang} errors={[particles.error]} ready={Boolean(particles.value)}>
      {() => {
        const data = particles.value!;
        const current = data.cases.find(c => c.case === caseId) ?? data.cases[0];
        // a curve per model: the share selected and the capture, one point per distinct share
        const curve = (rows: ParticleThreshold[]) => [...new Map(rows.map(row => [row.selected_fraction, row])).values()].map(row => [100 * row.selected_fraction, 100 * row.expected_recovery] as [number, number]); // not-engine: fractions shown in percent
        const point = current.models[model].thresholds[Math.round(threshold * 100)];
        const calib = PARTICLE_MODELS.map(m => current.models[m].calibration.map(bin => [bin.predicted, bin.oracle] as [number, number]));
        const calibData = merged(calib);
        const excluded = data.cases.find(c => c.excluded_test_rows > 0);
        return (
          <div className="of-doc-panel">
            <div className="of-doc-controls">
              <label className="of-doc-control"><span>{TEXT.case[lang]}</span>
                <select value={caseId} onChange={e => { setCaseId(e.target.value); setThreshold(0.5); }}>{data.cases.map(c => <option key={c.case} value={c.case}>{`${TEXT.caseN[lang]} ${c.case}`}</option>)}</select></label>
              <label className="of-doc-control"><span>{TEXT.model[lang]}</span>
                <select value={model} onChange={e => setModel(e.target.value)}>{PARTICLE_MODELS.map(m => <option key={m} value={m}>{NAME[m][lang]}</option>)}</select></label>
              <label className="of-doc-control"><span>{`${TEXT.threshold[lang]} ${formatFixed(threshold, lang, 2)}`}</span>
                <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label>
            </div>
            <div className="of-doc-charts-2">
              <div className="of-doc-chart">
                <Chart data={merged(PARTICLE_MODELS.map(m => curve(current.models[m].thresholds)))} xLabel={TEXT.fraction[lang]} yLabel={TEXT.capture[lang]}
                  title={TEXT.thresholdTitle[lang]} summary={TEXT.thresholdSummary[lang]}
                  series={PARTICLE_MODELS.map((m, i) => ({ label: NAME[m][lang], colour: (['subtle', 'accent', 'warn'] as const)[i], points: true }))}
                  marks={[{ x: 100 * point.selected_fraction, label: TEXT.mark[lang] }]}
                  format={(v) => (v === null ? '-' : `${formatFixed(v, lang, 1)}%`)} />
              </div>
              <div className="of-doc-chart">
                <Chart data={[calibData[0], ...calibData.slice(1), calibData[0]] as uPlot.AlignedData} xLabel={TEXT.calibX[lang]} yLabel={TEXT.calibY[lang]}
                  title={TEXT.calibTitle[lang]} summary={TEXT.calibSummary[lang]}
                  series={[...PARTICLE_MODELS.map((m, i) => ({ label: NAME[m][lang], colour: (['subtle', 'accent', 'warn'] as const)[i], points: true })), { label: TEXT.identity[lang], colour: 'subtle' as const, dash: [5, 4] }]}
                  format={(v) => (v === null ? '-' : formatFixed(v, lang, 3))} />
              </div>
            </div>
            <p className="of-doc-reading" aria-live="polite">{fill(TEXT.atThreshold[lang], { model: NAME[model][lang], sel: formatFraction(point.selected_fraction, lang, 1), cap: formatFraction(point.expected_recovery, lang, 1), grade: formatFraction(point.expected_grade_proxy, lang, 1) })}</p>
            <table className="of-doc-table of-doc-table-data">
              <caption>{fill(TEXT.metricsCaption[lang], { rows: formatFixed(excluded?.test_rows ?? 0, lang, 0), excluded: formatFixed(excluded?.excluded_test_rows ?? 0, lang, 0) })}</caption>
              <thead><tr><th scope="col">{TEXT.caseN[lang]}</th>{PARTICLE_MODELS.flatMap(m => [<th scope="col" key={`${m}-r`}>{`${NAME[m][lang]} RMSE`}</th>, <th scope="col" key={`${m}-b`}>{`${NAME[m][lang]} ${TEXT.biasShort[lang]}`}</th>])}</tr></thead>
              <tbody>{data.cases.map(c => (
                <tr key={c.case}>
                  <th scope="row">{c.case}</th>
                  {PARTICLE_MODELS.flatMap(m => [<td key={`${m}-r`}>{formatFixed(c.models[m].rmse, lang, 4)}</td>, <td key={`${m}-b`}>{signed(c.models[m].bias, lang, 4)}</td>])}
                </tr>
              ))}</tbody>
            </table>
          </div>
        );
      }}
    </Loaded>
  );
}

/**
 * The particle network's inputs as the training sheet records them: its 1st to 99th percentile range and
 * its median (computed from the HZDR workbook's training sheet, which stays local and is not committed).
 */
const PARTICLE_INPUTS: Array<{ label: Bi; min: number; max: number; start: number }> = [
  { label: { en: 'Aspect ratio (as recorded)', es: 'Razón de aspecto (como se registra)' }, min: -1.787, max: 0, start: -0.437 },
  { label: { en: 'Solidity (as recorded)', es: 'Solidez (como se registra)' }, min: -0.341, max: 0.288, start: -0.007 },
  { label: { en: 'ECD (as recorded)', es: 'ECD (como se registra)' }, min: 0.873, max: 4.056, start: 2.21 },
  { label: { en: 'Mineral 1 surface share', es: 'Fracción de superficie del mineral 1' }, min: 0, max: 1, start: 0 },
];
type Session = import('onnxruntime-web').InferenceSession;

function InferenceFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-lane-arrow-2)';
  const steps: Array<[string, string]> = [
    [p('4 features, as the workbook records them', '4 variables, como las registra el libro'), p('aspect ratio, solidity, ECD, mineral 1', 'razón de aspecto, solidez, ECD, mineral 1')],
    [p('standardize with the training scalers', 'estandarizar con los escaladores'), p('(x - mean) / scale', '(x - media) / escala')],
    [p('the exported network', 'la red exportada'), p('ONNX, 4-32-32-4, two ReLU layers', 'ONNX, 4-32-32-4, dos capas ReLU')],
    [p('a logistic link per output', 'un enlace logístico por salida'), p('class B probability of 4 cases', 'probabilidad de clase B de 4 casos')],
  ];
  return (
    <svg className="fig-svg" viewBox="0 0 440 272" role="img" aria-label={p('The browser standardizes the particle, runs the exported network and turns its four outputs into probabilities', 'El navegador estandariza la partícula, ejecuta la red exportada y convierte sus cuatro salidas en probabilidades')}>
      <Arrow id="of-lane-arrow-2" />
      {steps.map(([title, sub], k) => (
        <g key={title}>
          <Box x={10} y={8 + 60 * k} w={420} h={46} title={title} lines={[sub]} kind={k === 2 ? 'accent' : undefined} />
          {k < steps.length - 1 && <line className="dg-edge" x1="220" y1={54 + 60 * k} x2="220" y2={66 + 60 * k} markerEnd={arrow} />}
        </g>
      ))}
      <text className="dg-note" x="220" y="264" textAnchor="middle">{p('onnxruntime-web on WebAssembly, one thread; nothing leaves the browser', 'onnxruntime-web sobre WebAssembly, un hilo; nada sale del navegador')}</text>
    </svg>
  );
}

function InferencePanel({ lang }: { lang: Lang }) {
  const particles = useArtifact(loadParticleBenchmark);
  const [values, setValues] = useState(PARTICLE_INPUTS.map(input => input.start));
  const [result, setResult] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Session | null>(null);
  const run = async () => {
    if (!particles.value || busy) return;
    setBusy(true); setError(null);
    try {
      const ort = await import('onnxruntime-web/wasm');
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
      session.current ??= await ort.InferenceSession.create(`${import.meta.env.BASE_URL}models/particle_mlp.onnx?v=${encodeURIComponent(APP_VERSION)}`, { executionProviders: ['wasm'] });
      const { mean, scale } = particles.value.standardization;
      const input = Float32Array.from(values.map((v, i) => (v - mean[i]) / scale[i]));
      const out = await session.current.run({ features: new ort.Tensor('float32', input, [1, 4]) });
      const logits = Array.from(out.logits.data as Float32Array);
      if (logits.length !== 4 || logits.some(v => !Number.isFinite(v))) throw new Error('the network returned an invalid output');
      setResult(logits.map(v => 1 / (1 + Math.exp(-v)))); // not-engine: the particle classifier's logistic link
    } catch (cause) {
      session.current = null;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Loaded lang={lang} errors={[particles.error]} ready={Boolean(particles.value)}>
      {() => (
        <div className="of-doc-panel of-doc-inference">
          <div className="of-doc-inputs">
            {PARTICLE_INPUTS.map((input, i) => (
              <label className="of-doc-control of-doc-slider" key={input.label.en}>
                <span>{`${input.label[lang]}: ${formatFixed(values[i], lang, 3)}`}</span>
                <input type="range" min={input.min} max={input.max} step="0.001" value={values[i]} onChange={e => { const v = Number(e.target.value); setValues(old => old.map((x, k) => (k === i ? v : x))); setResult(null); }} />
              </label>
            ))}
            <button type="button" className="of-doc-run" onClick={run} disabled={busy}>{busy ? `${TEXT.running[lang]}...` : TEXT.run[lang]}</button>
            {error && <p className="of-doc-state" role="alert">{`${TEXT.failed[lang]}: ${error}`}</p>}
          </div>
          <div className="of-doc-chart of-doc-chart-narrow">
            {result
              ? <Chart data={[[0, 1, 2, 3], result.map(v => 100 * v)] as uPlot.AlignedData} categories={['1', '2', '3', '4'].map(c => `${TEXT.caseN[lang]} ${c}`)} // not-engine: probabilities shown in percent
                  xLabel={TEXT.case[lang]} yLabel={`${TEXT.probability[lang]} (%)`} title={TEXT.resultTitle[lang]} summary={TEXT.resultSummary[lang]}
                  series={[{ label: TEXT.probability[lang], colour: 'accent', bars: true }]} yRange={[0, 100]}
                  format={(v, axis) => (axis === 'x' ? '' : `${formatFixed(v, lang, 1)}%`)} />
              : <p className="of-doc-state">{TEXT.empty[lang]}</p>}
          </div>
        </div>
      )}
    </Loaded>
  );
}

const GEOMET: Topic = {
  id: 'geomet',
  title: { en: 'Measured locked-cycle recovery (GeoMet)', es: 'Recuperación medida en ciclo cerrado (GeoMet)' },
  paragraphs: [
    { en: 'The GeoMet dataset (Zenodo 7051975, CC BY 4.0) holds 53 flotation locked-cycle tests from one copper deposit with their drill hole, local coordinates and assays; one test has no recovery, so 52 tests from 29 holes remain. A locked-cycle test is a laboratory measurement of the deposit\'s response, not a state of an operating plant, and it carries no grind, collector or residence: this lane cannot calibrate the engine\'s controls, and the page keeps it apart from them.',
      es: 'El conjunto GeoMet (Zenodo 7051975, CC BY 4.0) contiene 53 ensayos de flotación en ciclo cerrado de un yacimiento de cobre con su sondaje, coordenadas locales y ensayes; un ensayo no tiene recuperación, así que quedan 52 ensayos de 29 sondajes. Un ensayo de ciclo cerrado es una medición de laboratorio de la respuesta del yacimiento, no un estado de una planta en operación, y no lleva molienda, colector ni residencia: esta vía no puede calibrar los controles del motor, y la página la mantiene separada de ellos.' },
    { en: 'Four models predict the recovery from five assays (Cu, Fe, S, Si and Al in ppm, log-transformed, with median imputation and scaling fitted inside each training fold): the training mean, ridge, a random forest and a Gaussian process. Two protocols keep whole drill holes out of training: five folds of complete holes, and three spatial zones of holes ordered by mean X. The hole identity and the coordinates define the groups and are never features.',
      es: 'Cuatro modelos predicen la recuperación desde cinco ensayes (Cu, Fe, S, Si y Al en ppm, con transformación logarítmica, imputación por mediana y escalamiento ajustados dentro de cada partición de entrenamiento): la media de entrenamiento, ridge, un bosque aleatorio y un proceso gaussiano. Dos protocolos mantienen sondajes completos fuera del entrenamiento: cinco particiones de sondajes completos, y tres zonas espaciales de sondajes ordenados por X media. La identidad del sondaje y las coordenadas definen los grupos y nunca son variables.' },
    { en: 'With 52 tests, point estimates of RMSE do not rank four models, so each protocol carries a paired bootstrap over complete holes (2000 resamples): every resample scores every model on the same rows. Under hole folds only ridge beats the training mean with an interval that excludes zero, by 0.42 points (95% interval 0.02 to 0.82); under spatial zones no difference does. The five assays carry little transferable signal about locked-cycle recovery on this deposit, and the benchmark reports that instead of a ranking.',
      es: 'Con 52 ensayos, las estimaciones puntuales del RMSE no ordenan cuatro modelos, así que cada protocolo lleva un bootstrap pareado sobre sondajes completos (2000 remuestreos): cada remuestreo evalúa cada modelo sobre las mismas filas. Con particiones por sondaje solo ridge supera a la media de entrenamiento con un intervalo que excluye el cero, por 0,42 puntos (intervalo del 95% de 0,02 a 0,82); con zonas espaciales ninguna diferencia lo hace. Los cinco ensayes llevan poca señal transferible sobre la recuperación en ciclo cerrado de este yacimiento, y el benchmark informa eso en vez de un ordenamiento.' },
  ],
  equations: [
    { tex: { en: r`\Delta_{ab} = \mathrm{RMSE}_a - \mathrm{RMSE}_b,\qquad \mathrm{CI}_{95}\big(\Delta_{ab}\big) = \big[q_{0.025},\ q_{0.975}\big]`, es: r`\Delta_{ab} = \mathrm{RMSE}_a - \mathrm{RMSE}_b,\qquad \mathrm{IC}_{95}\big(\Delta_{ab}\big) = \big[q_{0.025},\ q_{0.975}\big]` }, caption: { en: 'The paired difference of two models\' errors on the same resampled holes, and its 95% bootstrap interval.', es: 'La diferencia pareada de los errores de dos modelos sobre los mismos sondajes remuestreados, y su intervalo bootstrap del 95%.' } },
  ],
  limits: [
    { en: 'One deposit and 52 tests: the lane says what the assays predict on this deposit, not across deposits, and nothing about plant operation.', es: 'Un yacimiento y 52 ensayos: la vía dice qué predicen los ensayes en este yacimiento, no entre yacimientos, y nada sobre la operación de una planta.' },
  ],
  figure: { caption: { en: 'The two leakage-safe protocols: tests grouped by whole drill hole, and holes grouped into spatial zones.', es: 'Los dos protocolos sin fuga: ensayos agrupados por sondaje completo, y sondajes agrupados en zonas espaciales.' }, render: lang => <GeometFoldsFigure lang={lang} /> },
  data: lang => <GeometPanel lang={lang} />,
  refs: ['geomet', 'geomet-paper', 'sklearn2011'],
};

const PARTICLES: Topic = {
  id: 'particles',
  title: { en: 'Particle separation classes (HZDR)', es: 'Clases de separación de partículas (HZDR)' },
  paragraphs: [
    { en: 'The HZDR workbook (RODARE 336, CC BY 4.0) keeps its original sheets. The training sheet has 68,008 particles with class A or B labels for four constructed separation cases; the test sheet has 29,147 particles with the constructed probability of class B and the source authors\' published predictions, but no observed classes. The lane therefore scores probabilities against the constructed probability, never accuracy, observed recovery or a plant.',
      es: 'El libro de HZDR (RODARE 336, CC BY 4.0) conserva sus hojas originales. La hoja de entrenamiento tiene 68.008 partículas con clases A o B para cuatro casos de separación construidos; la hoja de prueba tiene 29.147 partículas con la probabilidad construida de clase B y las predicciones publicadas por los autores de la fuente, pero sin clases observadas. La vía evalúa entonces probabilidades frente a la probabilidad construida, nunca exactitud, recuperación observada ni una planta.' },
    { en: 'Exactly four particle features enter the models: aspect ratio, solidity, equivalent circle diameter and the surface share of mineral 1. A seeded L1 logistic regression is fitted per case, and a shared 4-32-32-4 PyTorch network is trained on the same features with 15% of the training sheet (10,202 particles) reserved to stop it. The published predictions are a reference from the workbook, not refitted here. Case 4 lacks oracle or reference values for 663 test particles, so all three models are compared on its 28,484 complete rows.',
      es: 'Exactamente cuatro variables de partícula entran a los modelos: razón de aspecto, solidez, diámetro de círculo equivalente y la fracción de superficie del mineral 1. Se ajusta una regresión logística L1 sembrada por caso, y una red de PyTorch 4-32-32-4 compartida se entrena con las mismas variables reservando 15% de la hoja de entrenamiento (10.202 partículas) para detenerla. Las predicciones publicadas son una referencia del libro, no reajustadas aquí. Al caso 4 le faltan valores de oráculo o de referencia en 663 partículas de prueba, así que los tres modelos se comparan en sus 28.484 filas completas.' },
    { en: 'The network\'s probability RMSE is below the published reference\'s in cases 1, 3 and 4, and the logistic regression\'s in cases 1 to 3; the logistic regression, linear in the four features, fails case 4 (0.19 against the reference\'s 0.037), where the network does not (0.023). The threshold curves show what a selection would capture: moving the threshold trades the share of particles selected for the expected class B they carry.',
      es: 'El RMSE de probabilidad de la red está bajo el de la referencia publicada en los casos 1, 3 y 4, y el de la regresión logística en los casos 1 a 3; la regresión logística, lineal en las cuatro variables, falla en el caso 4 (0,19 frente a 0,037 de la referencia), donde la red no falla (0,023). Las curvas de umbral muestran qué capturaría una selección: mover el umbral intercambia la fracción de partículas seleccionadas por la clase B esperada que llevan.' },
  ],
  equations: [
    { tex: r`\mathrm{RMSE} = \sqrt{\frac{1}{n}\sum_i \left(\hat p_i - p_i\right)^2},\qquad C(\theta) = \frac{\sum_{i:\,\hat p_i > \theta} p_i}{\sum_i p_i}`, caption: { en: 'The probability error against the constructed probability p, and the expected class B capture C of a selection above the threshold θ.', es: 'El error de probabilidad frente a la probabilidad construida p, y la captura esperada de clase B C de una selección sobre el umbral θ.' } },
  ],
  limits: [
    { en: 'Constructed cases: a lower error against a constructed probability shows the models learn the construction, not that they would separate a real ore.', es: 'Casos construidos: un error menor frente a una probabilidad construida muestra que los modelos aprenden la construcción, no que separarían un mineral real.' },
  ],
  figure: { caption: { en: 'The two original sheets: the training sheet fits the models, the separate test sheet scores them against its constructed probabilities.', es: 'Las dos hojas originales: la de entrenamiento ajusta los modelos, la de prueba separada los evalúa frente a sus probabilidades construidas.' }, render: lang => <ParticleFigure lang={lang} /> },
  data: lang => <ParticlePanel lang={lang} />,
  refs: ['hzdr', 'particle-paper', 'sklearn2011', 'pytorch2019'],
};

const INFERENCE: Topic = {
  id: 'inference',
  title: { en: 'The particle network in the browser', es: 'La red de partículas en el navegador' },
  paragraphs: [
    { en: 'The exported particle network runs here, in the browser, when asked: the four inputs are standardized with the training scalers, the ONNX network computes one output per constructed case, and a logistic link turns each into the probability of class B. No server takes part in the calculation.',
      es: 'La red de partículas exportada corre aquí, en el navegador, cuando se pide: las cuatro entradas se estandarizan con los escaladores de entrenamiento, la red ONNX calcula una salida por caso construido, y un enlace logístico convierte cada una en la probabilidad de clase B. Ningún servidor participa en el cálculo.' },
    { en: 'Each slider spans the 1st to the 99th percentile of its feature in the training sheet and starts at the median; the features are used as the workbook records them, since their physical units are not documented there.',
      es: 'Cada deslizador cubre del percentil 1 al 99 de su variable en la hoja de entrenamiento y parte en la mediana; las variables se usan como las registra el libro, ya que allí no se documentan sus unidades físicas.' },
  ],
  equations: [
    { tex: r`p_c = \frac{1}{1 + e^{-z_c}},\qquad z = f_\theta\!\left(\frac{x - \mu}{\sigma}\right) \in \mathbb{R}^4`, caption: { en: 'The class B probability of each constructed case c from the network\'s output z on the standardized features.', es: 'La probabilidad de clase B de cada caso construido c desde la salida z de la red sobre las variables estandarizadas.' } },
  ],
  limits: [
    { en: 'The probabilities belong to the four constructed cases; they are not a prediction for any real ore or plant.', es: 'Las probabilidades pertenecen a los cuatro casos construidos; no son una predicción para ningún mineral ni planta real.' },
  ],
  figure: { caption: { en: 'What the browser computes: standardize the particle, run the exported network, and turn its four outputs into probabilities.', es: 'Lo que calcula el navegador: estandarizar la partícula, ejecutar la red exportada y convertir sus cuatro salidas en probabilidades.' }, render: lang => <InferenceFigure lang={lang} /> },
  data: lang => <InferencePanel lang={lang} />,
  refs: ['hzdr', 'onnx-web', 'pytorch2019'],
};

export const MEASURED_LANES = { GEOMET, PARTICLES, INFERENCE };
