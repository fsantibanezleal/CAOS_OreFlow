/**
 * Benchmark, industrial quality (IS-05, IS-06): the next-hour silica forecast of one iron-ore flotation plant, on the
 * publisher's CC0 data. Transcribed from docs/design/features/industrial-soft-sensor and the research dossier of
 * 2026-09-28 (section 5); every number on the page is read from the committed artifact. The lane is separate from
 * the copper circuit and from the optimizer, and nothing on it is set-point advice.
 */
import { useState } from 'react';
import type uPlot from 'uplot';
import { Chart } from '../components/charts/Chart';
import { loadIronPlant, type IronPlant } from '../lib/artifacts';
import { formatFixed, type Lang } from '../lib/format';
import { Loaded, useArtifact } from './data';
import type { Bi, Topic } from './doc';
import { Arrow, Box, pick } from './figures';

const r = String.raw;

export const IRON_MODELS = ['train_mean', 'previous_lab', 'ridge', 'random_forest', 'hist_gradient_boosting', 'ridge_with_previous_lab', 'boosting_with_previous_lab'] as const;
export const IRON_NAME: Record<string, Bi> = {
  train_mean: { en: 'Training mean', es: 'Media de entrenamiento' },
  previous_lab: { en: 'Previous lab assay (persistence)', es: 'Ensaye de laboratorio anterior (persistencia)' },
  ridge: { en: 'Ridge, sensors', es: 'Ridge, sensores' },
  random_forest: { en: 'Random forest, sensors', es: 'Bosque aleatorio, sensores' },
  hist_gradient_boosting: { en: 'Gradient boosting, sensors', es: 'Gradient boosting, sensores' },
  ridge_with_previous_lab: { en: 'Ridge, sensors and previous assay', es: 'Ridge, sensores y ensaye anterior' },
  boosting_with_previous_lab: { en: 'Gradient boosting, sensors and previous assay', es: 'Gradient boosting, sensores y ensaye anterior' },
};

const TEXT = {
  window: { en: 'Forward window', es: 'Ventana futura' },
  model: { en: 'Model', es: 'Modelo' },
  pooled: { en: 'All three windows', es: 'Las tres ventanas' },
  hour: { en: 'Sensor hour in the window', es: 'Hora de sensores en la ventana' },
  silica: { en: 'Silica in the concentrate, next hour (%)', es: 'Sílice en el concentrado, hora siguiente (%)' },
  observed: { en: 'Measured', es: 'Medida' },
  traceTitle: { en: 'The next hour\'s silica: measured against predicted', es: 'La sílice de la hora siguiente: medida frente a predicha' },
  traceSummary: { en: 'The measured next-hour silica of the window\'s sampled hours, with the chosen model\'s prediction and persistence.', es: 'La sílice medida de la hora siguiente en las horas muestreadas de la ventana, con la predicción del modelo elegido y la persistencia.' },
  mae: { en: 'MAE (points)', es: 'MAE (puntos)' },
  rmse: { en: 'RMSE (points)', es: 'RMSE (puntos)' },
  bias: { en: 'Bias (points)', es: 'Sesgo (puntos)' },
  r2: { en: 'R²', es: 'R²' },
  scoresCaption: { en: 'Error by model, over the chosen window; the best mean absolute error is marked.', es: 'Error por modelo, en la ventana elegida; se marca el menor error absoluto medio.' },
  windowsCaption: { en: 'The three forward windows: expanding training history, a 24-hour embargo, then the test hours.', es: 'Las tres ventanas futuras: historia de entrenamiento creciente, un embargo de 24 horas y luego las horas de prueba.' },
  train: { en: 'Training hours', es: 'Horas de entrenamiento' },
  test: { en: 'Test hours', es: 'Horas de prueba' },
  trainLast: { en: 'Training ends', es: 'Fin del entrenamiento' },
  testSpan: { en: 'Test span', es: 'Período de prueba' },
  embargo: { en: 'Embargo (h)', es: 'Embargo (h)' },
  reading: { en: 'Move over the trace to read an hour.', es: 'Recorra la curva para leer una hora.' },
  best: { en: 'best', es: 'mejor' },
};

const day = (stamp: string) => stamp.slice(0, 10);

function IronFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-iron-arrow)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 238" role="img" aria-label={p('20-second rows become hourly medians; interpolated hours are dropped; each hour predicts the next; three forward windows with an embargo', 'Las filas de 20 segundos pasan a medianas horarias; se descartan las horas interpoladas; cada hora predice la siguiente; tres ventanas futuras con embargo')}>
      <Arrow id="of-iron-arrow" />
      <Box x={8} y={10} w={128} h={52} title={p('737,453 rows', '737.453 filas')} lines={[p('about 180 per hour', 'unas 180 por hora')]} />
      <Box x={156} y={10} w={128} h={52} title={p('4,097 hours', '4.097 horas')} lines={[p('sensor medians', 'medianas de sensores')]} />
      <Box x={304} y={10} w={128} h={52} kind="accent" title={p('3,701 pairs', '3.701 pares')} lines={[p('t predicts t + 1', 't predice t + 1')]} />
      <line className="dg-edge" x1="136" y1="36" x2="155" y2="36" markerEnd={arrow} />
      <line className="dg-edge" x1="284" y1="36" x2="303" y2="36" markerEnd={arrow} />
      <text className="dg-note" x="220" y="80" textAnchor="middle">{p('310 hours with an interpolated silica label are dropped whole', '310 horas con la sílice interpolada se descartan completas')}</text>
      {[0, 1, 2].map(k => {
        const y = 102 + 40 * k;
        const start = [50, 65, 80][k], end = [65, 80, 100][k];
        const x = (f: number) => 20 + 3.4 * f;
        return (
          <g key={k}>
            <rect className="dg-bar" x={x(0)} y={y} width={3.4 * start - 6} height="18" />
            <rect className="dg-fill-warn" x={x(start) - 6} y={y} width="6" height="18" opacity="0.7" />
            <rect className="dg-bar-2" x={x(start)} y={y} width={3.4 * (end - start)} height="18" />
            <text className="dg-box-sub" x={x(end) + 6} y={y + 13}>{p(`window ${k + 1}`, `ventana ${k + 1}`)}</text>
          </g>
        );
      })}
      <text className="dg-note" x="20" y="232">{p('training (expanding)  |  24 h embargo  |  test', 'entrenamiento (creciente)  |  embargo de 24 h  |  prueba')}</text>
    </svg>
  );
}

function IronPanel({ lang }: { lang: Lang }) {
  const lane = useArtifact(loadIronPlant);
  const [window, setWindow] = useState<number | 'pooled'>(2);
  const [model, setModel] = useState<string>('ridge');
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[lane.error]} ready={Boolean(lane.value)}>
      {() => {
        const a = lane.value as IronPlant;
        const fold = window === 'pooled' ? null : a.folds[window];
        const scores = fold ? fold.scores : a.pooled_scores;
        const best = IRON_MODELS.reduce((m, id) => (scores[id].mae_pct_points < scores[m].mae_pct_points ? id : m), IRON_MODELS[0]);
        const trace = (fold ?? a.folds[a.folds.length - 1]).trace;
        const xs = trace.map((_, i) => i);
        return (
          <div className="of-doc-panel">
            <div className="of-doc-controls">
              <label className="of-doc-control"><span>{TEXT.window[lang]}</span>
                <select value={String(window)} onChange={e => setWindow(e.target.value === 'pooled' ? 'pooled' : Number(e.target.value))}>
                  {a.folds.map(f => <option key={f.id} value={f.id}>{`${f.id + 1}: ${day(f.test_first)} - ${day(f.test_last)}`}</option>)}
                  <option value="pooled">{TEXT.pooled[lang]}</option></select></label>
              <label className="of-doc-control"><span>{TEXT.model[lang]}</span>
                <select value={model} onChange={e => setModel(e.target.value)}>{IRON_MODELS.map(id => <option key={id} value={id}>{IRON_NAME[id][lang]}</option>)}</select></label>
            </div>
            <div className="of-doc-chart">
              <Chart data={[xs, trace.map(t => t.observed_pct), trace.map(t => t.predictions_pct[model]), trace.map(t => t.predictions_pct.previous_lab)] as uPlot.AlignedData}
                xLabel={TEXT.hour[lang]} yLabel={TEXT.silica[lang]} title={TEXT.traceTitle[lang]} summary={TEXT.traceSummary[lang]}
                series={[{ label: TEXT.observed[lang], colour: 'subtle', points: true }, { label: IRON_NAME[model][lang], colour: 'accent' },
                  { label: IRON_NAME.previous_lab[lang], colour: 'warn', dash: [4, 4] }]}
                format={(v, axis) => (v === null ? '-' : axis === 'x' ? String(v) : `${formatFixed(v, lang, 2)}%`)}
                onCursor={c => setReading(c ? `${trace[c.index].sensor_hour.slice(0, 16)}: ${TEXT.observed[lang]} ${formatFixed(trace[c.index].observed_pct, lang, 2)}%, ${IRON_NAME[model][lang]} ${formatFixed(trace[c.index].predictions_pct[model], lang, 2)}%` : null)} />
            </div>
            <p className="of-doc-reading" aria-live="polite">{reading ?? TEXT.reading[lang]}</p>
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{TEXT.scoresCaption[lang]}</caption>
                <thead><tr>{[TEXT.model, TEXT.mae, TEXT.rmse, TEXT.bias, TEXT.r2].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
                <tbody>{IRON_MODELS.map(id => (
                  <tr key={id} className={id === model ? 'is-selected' : undefined}>
                    <th scope="row">{IRON_NAME[id][lang]}{id === best ? <span className="of-tag">{TEXT.best[lang]}</span> : null}</th>
                    <td>{formatFixed(scores[id].mae_pct_points, lang, 3)}</td><td>{formatFixed(scores[id].rmse_pct_points, lang, 3)}</td>
                    <td>{formatFixed(scores[id].bias_pct_points, lang, 3)}</td><td>{formatFixed(scores[id].r2, lang, 3)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{TEXT.windowsCaption[lang]}</caption>
                <thead><tr>{[TEXT.window, TEXT.train, TEXT.trainLast, TEXT.embargo, TEXT.test, TEXT.testSpan].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
                <tbody>{a.folds.map(f => (
                  <tr key={f.id}><th scope="row">{f.id + 1}</th><td>{f.train_rows}</td><td>{f.train_last.slice(0, 16)}</td>
                    <td>{formatFixed(f.embargo_hours_min, lang, 0)}</td><td>{f.test_rows}</td><td>{`${day(f.test_first)} - ${day(f.test_last)}`}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );
      }}
    </Loaded>
  );
}

const IRON_PLANT: Topic = {
  id: 'iron-plant',
  title: { en: 'Next-hour silica in an iron-ore flotation plant', es: 'Sílice de la hora siguiente en una planta de flotación de hierro' },
  paragraphs: [
    { en: 'The data are one iron-ore plant\'s reverse flotation, published on Kaggle under CC0 (dataset 6294, version 1, pinned by SHA-256): 737,453 rows from March to September 2017, with about 180 sensor rows per hourly date. The two concentrate assays, iron and silica, are laboratory results. In 310 hours the silica label changes from row to row: it was interpolated, not measured, so those hours are dropped whole. The rest become hourly medians, and only exact consecutive hours with a measured label form a pair: 3,701 of them.',
      es: 'Los datos son la flotación inversa de una planta de mineral de hierro, publicados en Kaggle bajo CC0 (conjunto 6294, versión 1, fijado por SHA-256): 737.453 filas de marzo a septiembre de 2017, con unas 180 filas de sensores por fecha horaria. Los dos ensayes del concentrado, hierro y sílice, son resultados de laboratorio. En 310 horas la etiqueta de sílice cambia de fila en fila: fue interpolada, no medida, así que esas horas se descartan completas. El resto pasa a medianas horarias, y solo horas consecutivas exactas con etiqueta medida forman un par: 3.701.' },
    { en: 'At hour t the 21 feed, reagent, pulp and column sensors predict the silica measured at t + 1. Both concentrate assays, the future target and the date are kept out of the predictors. Three future windows are scored in time order, each after an expanding history and at least 24 hours of embargo, with imputation and scaling fitted inside each training window. The training mean and the previous laboratory assay are the baselines; ridge, a random forest and gradient boosting use the sensors, and two more models use the sensors and the previous assay.',
      es: 'En la hora t los 21 sensores de alimentación, reactivos, pulpa y columnas predicen la sílice medida en t + 1. Los dos ensayes del concentrado, el objetivo futuro y la fecha quedan fuera de los predictores. Se evalúan tres ventanas futuras en orden temporal, cada una tras una historia creciente y al menos 24 horas de embargo, con la imputación y el escalamiento ajustados dentro de cada ventana de entrenamiento. La media de entrenamiento y el ensaye de laboratorio anterior son las referencias; ridge, un bosque aleatorio y gradient boosting usan los sensores, y otros dos modelos usan los sensores y el ensaye anterior.' },
    { en: 'Over the three windows the sensor-only models do no better than the training mean: ridge is 0.001 points below its mean absolute error of 0.766, and the random forest and gradient boosting are above it. No model beats persistence: the previous assay alone has the lowest error, 0.464 points, and adding the sensors to it makes the forecast worse. Under this protocol the hourly sensor medians carry little information about the next hour\'s silica that the last assay does not already hold. A published random forest on the same data reports R² 0.965; its split protocol is not in its abstract, and a random split of the 20-second rows would put rows of one hourly label on both sides of it, so the two are not compared.',
      es: 'En las tres ventanas los modelos solo con sensores no mejoran a la media de entrenamiento: ridge queda 0,001 puntos bajo su error absoluto medio de 0,766, y el bosque aleatorio y gradient boosting quedan sobre él. Ningún modelo supera a la persistencia: el ensaye anterior solo tiene el menor error, 0,464 puntos, y agregarle los sensores empeora el pronóstico. Con este protocolo las medianas horarias de los sensores llevan poca información sobre la sílice de la hora siguiente que el último ensaye no tenga ya. Un bosque aleatorio publicado sobre los mismos datos informa R² 0,965; su protocolo de partición no está en su resumen, y una partición aleatoria de las filas de 20 segundos pondría filas de una misma etiqueta horaria a ambos lados, así que los dos no se comparan.' },
  ],
  equations: [
    { tex: r`\hat y_{t+1} = f\left(\tilde x_t\right),\qquad \tilde x_t = \operatorname{median}_{s \in t}\ x_s,\qquad \mathrm{MAE} = \frac{1}{n}\sum_t \left|\hat y_{t+1} - y_{t+1}\right|`, caption: { en: 'The next hour\'s silica from the hour\'s sensor medians, scored by mean absolute error in percentage points.', es: 'La sílice de la hora siguiente a partir de las medianas horarias de los sensores, evaluada por el error absoluto medio en puntos porcentuales.' } },
  ],
  limits: [
    { en: 'One plant, one season and observational data: the scores say how well the next hour is forecast here, not what a change of any sensor would do. The persistence baseline assumes the previous hour\'s assay is already known, which the data do not establish. The plant\'s reverse cationic circuit is not an engine family, so the lane stays apart from the copper circuit and from the optimizer, and nothing on it is set-point advice.', es: 'Una planta, una temporada y datos observacionales: los puntajes dicen qué tan bien se pronostica aquí la hora siguiente, no qué haría un cambio de algún sensor. La persistencia supone que el ensaye de la hora anterior ya se conoce, lo que los datos no establecen. El circuito catiónico inverso de la planta no es una familia del motor, así que la vía queda separada del circuito de cobre y del optimizador, y nada en ella es una recomendación de operación.' },
  ],
  figure: { caption: { en: 'From 20-second rows to next-hour pairs, and the three forward windows with their embargo.', es: 'De las filas de 20 segundos a los pares de la hora siguiente, y las tres ventanas futuras con su embargo.' }, render: lang => <IronFigure lang={lang} /> },
  data: lang => <IronPanel lang={lang} />,
  refs: ['kaggle6294', 'kadlec2009', 'bergmeir2012', 'pural2023', 'sklearn2011'],
};

export const INDUSTRIAL = { IRON_PLANT };
