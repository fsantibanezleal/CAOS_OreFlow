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

export const IRON_MODELS = ['train_mean', 'previous_lab', 'ar1_previous_lab', 'ridge', 'random_forest', 'hist_gradient_boosting', 'ridge_with_previous_lab', 'boosting_with_previous_lab'] as const;
export const IRON_NAME: Record<string, Bi> = {
  train_mean: { en: 'Training mean', es: 'Media de entrenamiento' },
  previous_lab: { en: 'Previous lab assay (persistence)', es: 'Ensaye de laboratorio anterior (persistencia)' },
  ar1_previous_lab: { en: 'Fitted last assay (AR(1))', es: 'Último ensaye ajustado (AR(1))' },
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
  traceSummary: { en: 'The measured next-hour silica of the window\'s sampled hours, with the chosen model\'s prediction, persistence and the values the laboratory repeated.', es: 'La sílice medida de la hora siguiente en las horas muestreadas de la ventana, con la predicción del modelo elegido, la persistencia y los valores de laboratorio repetidos.' },
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
  // S-16: the laboratory values repeated over consecutive hours, and the scores without the pairs that touch them
  held: { en: 'Repeated laboratory value', es: 'Valor de laboratorio repetido' },
  allPairs: { en: 'every pair', es: 'todos los pares' },
  withoutHeld: { en: 'without repeated values', es: 'sin valores repetidos' },
  heldCaption: {
    en: (touching: string, pairs: string, runs: number, longest: number, hours: number) => `The three windows pooled, with every pair and without the ${touching} of ${pairs} pairs that touch a laboratory value repeated over ${hours} or more consecutive hours (${runs} runs, the longest ${longest} hours). The models are refitted on the remaining pairs.`,
    es: (touching: string, pairs: string, runs: number, longest: number, hours: number) => `Las tres ventanas juntas, con todos los pares y sin los ${touching} de ${pairs} pares que tocan un valor de laboratorio repetido durante ${hours} o más horas consecutivas (${runs} tramos, el más largo de ${longest} horas). Los modelos se reajustan con los pares restantes.`,
  },
  best: { en: 'lowest MAE', es: 'menor MAE' },
  bestRmse: { en: 'lowest RMSE', es: 'menor RMSE' },
};

const day = (stamp: string) => stamp.slice(0, 10);

function IronFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-iron-arrow)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 254" role="img" aria-label={p('20-second rows become hourly medians; interpolated hours are dropped and values repeated across hours are kept and marked; each hour predicts the next; three forward windows with an embargo', 'Las filas de 20 segundos pasan a medianas horarias; se descartan las horas interpoladas y los valores repetidos entre horas se conservan y se marcan; cada hora predice la siguiente; tres ventanas futuras con embargo')}>
      <Arrow id="of-iron-arrow" />
      <Box x={8} y={10} w={128} h={52} title={p('737,453 rows', '737.453 filas')} lines={[p('about 180 per hour', 'unas 180 por hora')]} />
      <Box x={156} y={10} w={128} h={52} title={p('4,097 hours', '4.097 horas')} lines={[p('sensor medians', 'medianas de sensores')]} />
      <Box x={304} y={10} w={128} h={52} kind="accent" title={p('3,701 pairs', '3.701 pares')} lines={[p('t predicts t + 1', 't predice t + 1')]} />
      <line className="dg-edge" x1="136" y1="36" x2="155" y2="36" markerEnd={arrow} />
      <line className="dg-edge" x1="284" y1="36" x2="303" y2="36" markerEnd={arrow} />
      <text className="dg-note" x="220" y="80" textAnchor="middle">{p('310 hours with an interpolated silica label are dropped whole', '310 horas con la sílice interpolada se descartan completas')}</text>
      <text className="dg-note" x="220" y="96" textAnchor="middle">{p('a value repeated over 3 or more hours is kept and marked', 'un valor repetido por 3 o más horas se conserva y se marca')}</text>
      {[0, 1, 2].map(k => {
        const y = 118 + 40 * k;
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
      <text className="dg-note" x="20" y="248">{p('training (expanding)  |  24 h embargo  |  test', 'entrenamiento (creciente)  |  embargo de 24 h  |  prueba')}</text>
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
        // M-04: the winner depends on the metric, so each metric names its own
        const best = IRON_MODELS.reduce((m, id) => (scores[id].mae_pct_points < scores[m].mae_pct_points ? id : m), IRON_MODELS[0]);
        const bestRmse = IRON_MODELS.reduce((m, id) => (scores[id].rmse_pct_points < scores[m].rmse_pct_points ? id : m), IRON_MODELS[0]);
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
              <Chart data={[xs, trace.map(t => t.observed_pct), trace.map(t => t.predictions_pct[model]), trace.map(t => t.predictions_pct.previous_lab), trace.map(t => (t.held ? t.observed_pct : null))] as uPlot.AlignedData}
                xLabel={TEXT.hour[lang]} yLabel={TEXT.silica[lang]} title={TEXT.traceTitle[lang]} summary={TEXT.traceSummary[lang]}
                series={[{ label: TEXT.observed[lang], colour: 'subtle', points: true }, { label: IRON_NAME[model][lang], colour: 'accent' },
                  { label: IRON_NAME.previous_lab[lang], colour: 'warn', dash: [4, 4] }, { label: TEXT.held[lang], colour: 'magenta', points: true, width: 3 }]}
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
                    <th scope="row">{IRON_NAME[id][lang]}{id === best ? <span className="of-tag">{TEXT.best[lang]}</span> : null}{id === bestRmse ? <span className="of-tag">{TEXT.bestRmse[lang]}</span> : null}</th>
                    <td>{formatFixed(scores[id].mae_pct_points, lang, 3)}</td><td>{formatFixed(scores[id].rmse_pct_points, lang, 3)}</td>
                    <td>{formatFixed(scores[id].bias_pct_points, lang, 3)}</td><td>{formatFixed(scores[id].r2, lang, 3)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{TEXT.heldCaption[lang](formatFixed(a.held_labels.pairs_touching, lang, 0), formatFixed(a.protocol.pair_rows, lang, 0), a.held_labels.held_runs, a.held_labels.longest_run_hours, a.held_labels.run_hours_min)}</caption>
                <thead><tr>{[TEXT.model[lang], `${TEXT.mae[lang]}, ${TEXT.allPairs[lang]}`, `${TEXT.mae[lang]}, ${TEXT.withoutHeld[lang]}`, `${TEXT.rmse[lang]}, ${TEXT.allPairs[lang]}`, `${TEXT.rmse[lang]}, ${TEXT.withoutHeld[lang]}`].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
                <tbody>{IRON_MODELS.map(id => (
                  <tr key={id}>
                    <th scope="row">{IRON_NAME[id][lang]}</th>
                    <td>{formatFixed(a.pooled_scores[id].mae_pct_points, lang, 3)}</td><td>{formatFixed(a.held_labels.pooled_scores_without[id].mae_pct_points, lang, 3)}</td>
                    <td>{formatFixed(a.pooled_scores[id].rmse_pct_points, lang, 3)}</td><td>{formatFixed(a.held_labels.pooled_scores_without[id].rmse_pct_points, lang, 3)}</td>
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
    { en: 'At hour t the 21 feed, reagent, pulp and column sensors predict the silica measured at t + 1. Both concentrate assays, the future target and the date are kept out of the predictors. Three future windows are scored in time order, each after an expanding history and at least 24 hours of embargo, with imputation and scaling fitted inside each training window. The training mean, the previous laboratory assay and that assay fitted to the next one by a straight line (an AR(1) regression, refitted in each window) are the baselines; ridge, a random forest and gradient boosting use the sensors, and two more models use the sensors and the previous assay.',
      es: 'En la hora t los 21 sensores de alimentación, reactivos, pulpa y columnas predicen la sílice medida en t + 1. Los dos ensayes del concentrado, el objetivo futuro y la fecha quedan fuera de los predictores. Se evalúan tres ventanas futuras en orden temporal, cada una tras una historia creciente y al menos 24 horas de embargo, con la imputación y el escalamiento ajustados dentro de cada ventana de entrenamiento. La media de entrenamiento, el ensaye de laboratorio anterior y ese ensaye ajustado al siguiente por una recta (una regresión AR(1), reajustada en cada ventana) son las referencias; ridge, un bosque aleatorio y gradient boosting usan los sensores, y otros dos modelos usan los sensores y el ensaye anterior.' },
    { en: 'Over the three windows the sensor-only models do no better than the training mean: ridge is 0.001 points below its mean absolute error of 0.766, and the random forest and gradient boosting are above it. Which forecast wins depends on the metric. By mean absolute error the previous assay alone is best, 0.464 points; by root-mean-square error the fitted last assay is best, 0.707 points against persistence\'s 0.767, because shrinking the last assay toward the mean (slope about 0.70) cuts the large misses. Adding the sensors to the previous assay is worse than the fitted last assay under both metrics, by 0.015 points of mean absolute error and 0.010 of root-mean-square error (95% intervals from resampling whole days, 0.004 to 0.025 and 0.002 to 0.018). Under this protocol the hourly sensor medians carry little information about the next hour\'s silica that the last assay does not already hold. 14% of the test hours repeat the previous assay exactly, which persistence scores as no error. Many of those are one laboratory value carried over: in 46 runs the silica label stays unchanged for three or more consecutive hours, the longest for 73 hours, and 461 of the 3,701 pairs touch such a run. An hour whose label changes inside the hour is dropped; a label held across hours is kept, so the second table gives the scores with and without those pairs. Without them every error that uses the laboratory rises (the previous assay\'s mean absolute error from 0.464 to 0.510 points), ridge moves from 0.001 points below the training mean to 0.014 above it, and each metric keeps its winner; the previous assay is then no better than the fitted last assay beyond the interval (0.008 points, -0.009 to 0.025; with every pair, 0.023 points, 0.004 to 0.043). A published random forest on the same data reports R² 0.965; its split protocol is not in its abstract, and a random split of the 20-second rows would put rows of one hourly label on both sides of it, so the two are not compared.',
      es: 'En las tres ventanas los modelos solo con sensores no mejoran a la media de entrenamiento: ridge queda 0,001 puntos bajo su error absoluto medio de 0,766, y el bosque aleatorio y gradient boosting quedan sobre él. Cuál pronóstico gana depende de la métrica. Por error absoluto medio el ensaye anterior solo es el mejor, 0,464 puntos; por error cuadrático medio el último ensaye ajustado es el mejor, 0,707 puntos frente a 0,767 de la persistencia, porque acercar el último ensaye a la media (pendiente cercana a 0,70) reduce los errores grandes. Agregar los sensores al ensaye anterior es peor que el último ensaye ajustado en ambas métricas, por 0,015 puntos de error absoluto medio y 0,010 de error cuadrático medio (intervalos de 95% remuestreando días completos, 0,004 a 0,025 y 0,002 a 0,018). Con este protocolo las medianas horarias de los sensores llevan poca información sobre la sílice de la hora siguiente que el último ensaye no tenga ya. 14% de las horas de prueba repiten exactamente el ensaye anterior, lo que la persistencia cuenta como error nulo. Muchas de ellas son un mismo valor de laboratorio arrastrado: en 46 tramos la etiqueta de sílice no cambia durante tres o más horas consecutivas, el más largo por 73 horas, y 461 de los 3.701 pares tocan uno de esos tramos. Una hora cuya etiqueta cambia dentro de la hora se descarta; una etiqueta repetida entre horas se conserva, así que la segunda tabla da los puntajes con y sin esos pares. Sin ellos sube cada error que usa el ensaye de laboratorio (el error absoluto medio del ensaye anterior, de 0,464 a 0,510 puntos), ridge pasa de 0,001 puntos bajo la media de entrenamiento a 0,014 sobre ella, y cada métrica conserva su ganador; el ensaye anterior deja entonces de ser mejor que el último ensaye ajustado más allá del intervalo (0,008 puntos, -0,009 a 0,025; con todos los pares, 0,023 puntos, 0,004 a 0,043). Un bosque aleatorio publicado sobre los mismos datos informa R² 0,965; su protocolo de partición no está en su resumen, y una partición aleatoria de las filas de 20 segundos pondría filas de una misma etiqueta horaria a ambos lados, así que los dos no se comparan.' },
  ],
  equations: [
    { tex: { en: r`\hat y_{t+1} = f\left(\tilde x_t\right),\qquad \tilde x_t = \operatorname{median}_{s \in t}\ x_s,\qquad \mathrm{MAE} = \frac{1}{n}\sum_t \left|\hat y_{t+1} - y_{t+1}\right|`, es: r`\hat y_{t+1} = f\left(\tilde x_t\right),\qquad \tilde x_t = \operatorname{mediana}_{s \in t}\ x_s,\qquad \mathrm{MAE} = \frac{1}{n}\sum_t \left|\hat y_{t+1} - y_{t+1}\right|` }, caption: { en: 'The next hour\'s silica from the hour\'s sensor medians, scored by mean absolute error in percentage points.', es: 'La sílice de la hora siguiente a partir de las medianas horarias de los sensores, evaluada por el error absoluto medio en puntos porcentuales.' } },
  ],
  limits: [
    { en: 'One plant, one season and observational data: the scores say how well the next hour is forecast here, not what a change of any sensor would do. The persistence baseline assumes the previous hour\'s assay is already known, which the data do not establish. The plant\'s reverse cationic circuit is not an engine family, so the lane stays apart from the copper circuit and from the optimizer, and nothing on it is set-point advice.', es: 'Una planta, una temporada y datos observacionales: los puntajes dicen qué tan bien se pronostica aquí la hora siguiente, no qué haría un cambio de algún sensor. La persistencia supone que el ensaye de la hora anterior ya se conoce, lo que los datos no establecen. El circuito catiónico inverso de la planta no es una familia del motor, así que la vía queda separada del circuito de cobre y del optimizador, y nada en ella es una recomendación de operación.' },
  ],
  figure: { caption: { en: 'From 20-second rows to next-hour pairs, and the three forward windows with their embargo.', es: 'De las filas de 20 segundos a los pares de la hora siguiente, y las tres ventanas futuras con su embargo.' }, render: lang => <IronFigure lang={lang} /> },
  data: lang => <IronPanel lang={lang} />,
  refs: ['kaggle6294', 'kadlec2009', 'bergmeir2012', 'pural2023', 'sklearn2011'],
};

export const INDUSTRIAL = { IRON_PLANT };
