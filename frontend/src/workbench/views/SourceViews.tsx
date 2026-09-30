/**
 * The views of a real source (RS-07, RS-09). A GeoMet sample runs in the engine, so the circuit, grinding and
 * separation views react to it; its Case view says what the sample fixes, what the engine still authors, and how
 * the engine's recovery compares with the measured locked-cycle test and the GeoMet lane. An iron-plant hour does
 * not run in the engine (the plant's reverse cationic circuit is not an engine family), so every engine view says
 * so, and the Case view shows the hour: its sensors, its assays, and the soft sensor's forecast of the next hour.
 */
import type uPlot from 'uplot';
import { Chart } from '../../components/charts/Chart';
import { IRON_MODELS, IRON_NAME } from '../../content/industrial';
import type { IronPlant, RealSample, RealSamples } from '../../lib/artifacts';
import { formatFixed, formatWithUnit, type Lang } from '../../lib/format';
import { metricLabel, mineralName } from '../../lib/i18n';
import { hourOf } from '../SourcePicker';

/** The GeoMet lane's models, as the Benchmark's measured-lanes tab names them. */
const LANE_MODEL: Record<string, { en: string; es: string }> = {
  train_mean: { en: 'training mean', es: 'media de entrenamiento' },
  ridge: { en: 'ridge', es: 'ridge' },
  random_forest: { en: 'random forest', es: 'bosque aleatorio' },
  gaussian_process: { en: 'Gaussian process', es: 'proceso gaussiano' },
};

export const SOURCE_TEXT = {
  notEngine: {
    en: 'This hour comes from an iron-ore plant whose reverse cationic flotation is not an engine family, so nothing of it is simulated here. Its sensors, its assays and the soft sensor\'s forecast are in the Case view.',
    es: 'Esta hora viene de una planta de mineral de hierro cuya flotación catiónica inversa no es una familia del motor, así que nada de ella se simula aquí. Sus sensores, sus ensayes y el pronóstico del sensor virtual están en la vista Caso.',
  },
  sampleNoMethods: {
    en: 'The method records (the optimizer, the uncertainty and sensitivity records, the learned lane) belong to the synthetic variants. A sample fixes the ore\'s head grade and work index outside the synthetic envelope they were computed over, so they are not shown for it.',
    es: 'Los registros de métodos (el optimizador, los registros de incertidumbre y sensibilidad, la vía aprendida) pertenecen a las variantes sintéticas. Una muestra fija la ley de cabeza y el índice de trabajo del mineral fuera de la envolvente sintética sobre la que se calcularon, así que no se muestran para ella.',
  },
  sampleNoResponse: {
    en: 'The response sweeps run over the synthetic case\'s envelope, and a sample\'s head grade and work index lie outside it; move the operating controls in the rail to see the sample respond.',
    es: 'Los barridos de respuesta recorren la envolvente del caso sintético, y la ley de cabeza y el índice de trabajo de una muestra quedan fuera de ella; mueva los controles de operación del riel para ver responder a la muestra.',
  },
  fixes: { en: 'What the sample fixes', es: 'Lo que fija la muestra' },
  authors: { en: 'What the engine still authors', es: 'Lo que el motor sigue definiendo' },
  compare: { en: 'Recovery: engine, measurement and the GeoMet lane', es: 'Recuperación: motor, medición y la vía GeoMet' },
  quantity: { en: 'Quantity', es: 'Cantidad' },
  value: { en: 'Value', es: 'Valor' },
  basis: { en: 'Basis', es: 'Base' },
  head: { en: 'Head assays (Cu, S, Fe)', es: 'Ensayes de cabeza (Cu, S, Fe)' },
  minerals: { en: 'Copper minerals (share of the copper)', es: 'Minerales de cobre (parte del cobre)' },
  allocation: { en: 'sulphur-limited normative mineralogy (an assumption)', es: 'mineralogía normativa limitada por azufre (un supuesto)' },
  magnetite: { en: 'Magnetite (the iron the sulphides leave)', es: 'Magnetita (el hierro que dejan los sulfuros)' },
  assumption: { en: 'an assumption: the assays do not identify it', es: 'un supuesto: los ensayes no la identifican' },
  wi: { en: 'Bond work index', es: 'Índice de trabajo de Bond' },
  nearest: { en: 'nearest comminution sample in the hole', es: 'muestra de conminución más cercana del sondaje' },
  median: { en: 'deposit median (no comminution sample in the hole)', es: 'mediana del yacimiento (sin muestra de conminución en el sondaje)' },
  authored: {
    en: 'The soft porphyry\'s plant and nominal operating point, its breakage and liberation parameters, and its flotation parameters: bornite floats at 0.8 of chalcopyrite\'s floatability and chalcocite at 1.5 times bornite\'s, both authored from bounded laboratory evidence; magnetite floats as quartz does.',
    es: 'La planta y el punto nominal de operación del pórfido blando, sus parámetros de fractura y liberación, y sus parámetros de flotación: la bornita flota a 0,8 de la flotabilidad de la calcopirita y la calcosina a 1,5 veces la de la bornita, ambas definidas desde evidencia de laboratorio acotada; la magnetita flota como el cuarzo.',
  },
  engine: { en: 'Engine, this state', es: 'Motor, este estado' },
  measured: { en: 'Measured locked-cycle test', es: 'Ensayo en ciclo cerrado medido' },
  lane: { en: 'GeoMet lane, out of fold', es: 'Vía GeoMet, fuera de la partición' },
  comparison: {
    en: 'A simulated plant at an operating point against a laboratory locked-cycle test: a comparison, not a calibration. Nothing in the engine is fitted to these samples.',
    es: 'Una planta simulada en un punto de operación frente a un ensayo de laboratorio en ciclo cerrado: una comparación, no una calibración. Nada del motor se ajusta a estas muestras.',
  },
  source: { en: 'GeoMet dataset, Zenodo 7051975, CC BY 4.0', es: 'Conjunto GeoMet, Zenodo 7051975, CC BY 4.0' },
  hourTitle: { en: 'The hour and the next one', es: 'La hora y la siguiente' },
  sensor: { en: 'Sensor (hourly median)', es: 'Sensor (mediana horaria)' },
  labNow: { en: 'Assays of this hour', es: 'Ensayes de esta hora' },
  silica: { en: 'silica', es: 'sílice' },
  iron: { en: 'iron', es: 'hierro' },
  next: { en: 'Silica measured the next hour', es: 'Sílice medida la hora siguiente' },
  model: { en: 'Forecast of the next hour', es: 'Pronóstico de la hora siguiente' },
  error: { en: 'Error (points)', es: 'Error (puntos)' },
  traceTitle: { en: 'The window\'s next-hour silica, with this hour marked', es: 'La sílice de la hora siguiente en la ventana, con esta hora marcada' },
  traceSummary: { en: 'Measured next-hour silica across the window\'s sampled hours, with persistence, and the chosen hour marked.', es: 'Sílice medida de la hora siguiente en las horas muestreadas de la ventana, con la persistencia, y la hora elegida marcada.' },
  hourAxis: { en: 'Sampled hour in the window', es: 'Hora muestreada en la ventana' },
  silicaAxis: { en: 'Silica in the concentrate (%)', es: 'Sílice en el concentrado (%)' },
  observed: { en: 'Measured', es: 'Medida' },
  thisHour: { en: 'this hour', es: 'esta hora' },
  hourLabel: { en: 'Plant hour', es: 'Hora de planta' },
  recorded: { en: 'A measured record, shown and not simulated', es: 'Un registro medido, que se muestra y no se simula' },
  laneNote: {
    en: 'An observational forecast from one plant: it says how well the next hour is predicted here, not what a change of any sensor would do.',
    es: 'Un pronóstico observacional de una planta: dice qué tan bien se predice aquí la hora siguiente, no qué haría un cambio de algún sensor.',
  },
};

export function SourceStatement({ kind, lang }: { kind: 'hour' | 'sample-methods' | 'sample-response'; lang: Lang }) {
  const text = kind === 'hour' ? SOURCE_TEXT.notEngine : kind === 'sample-methods' ? SOURCE_TEXT.sampleNoMethods : SOURCE_TEXT.sampleNoResponse;
  return <div className="of-view of-view-statement"><p className="of-note" role="note">{text[lang]}</p></div>;
}

export function SampleView({ record, sample, recovery, lang }: { record: RealSamples; sample: RealSample; recovery: number | null; lang: Lang }) {
  const shares = Object.entries(sample.allocation.copper_shares).filter(([, v]) => v > 0);
  const lanePredictions = sample.geomet_lane?.predictions_pct ?? {};
  return (
    <div className="of-view of-view-sample">
      <div className="of-split">
        <div className="of-sample-main">
          <table className="of-table">
            <caption>{SOURCE_TEXT.fixes[lang]}</caption>
            <thead><tr><th scope="col">{SOURCE_TEXT.quantity[lang]}</th><th scope="col">{SOURCE_TEXT.value[lang]}</th><th scope="col">{SOURCE_TEXT.basis[lang]}</th></tr></thead>
            <tbody>
              <tr><th scope="row">{SOURCE_TEXT.head[lang]}</th>
                <td>{['Cu', 'S', 'Fe'].map(e => `${e} ${formatFixed(sample.assays_pct[e], lang, e === 'Fe' ? 1 : 3)}%`).join(', ')}</td><td>{SOURCE_TEXT.source[lang]}</td></tr>
              <tr><th scope="row">{SOURCE_TEXT.minerals[lang]}</th>
                <td>{shares.map(([m, v]) => `${mineralName(m, lang)} ${formatFixed(100 * v, lang, 0)}%`).join(', ')}</td><td>{SOURCE_TEXT.allocation[lang]}</td></tr>
              <tr><th scope="row">{SOURCE_TEXT.magnetite[lang]}</th>
                <td>{`${formatFixed(100 * sample.allocation.fractions.magnetite, lang, 1)}%`}</td><td>{SOURCE_TEXT.assumption[lang]}</td></tr>
              <tr><th scope="row">{SOURCE_TEXT.wi[lang]}</th><td>{formatWithUnit(sample.work_index.value, 'kWh/t', lang)}</td>
                <td>{sample.work_index.how === 'nearest_in_hole' ? `${SOURCE_TEXT.nearest[lang]} (${formatFixed(sample.work_index.distance_m ?? 0, lang, 0)} m)` : SOURCE_TEXT.median[lang]}</td></tr>
            </tbody>
          </table>
          <p className="of-facts-title">{SOURCE_TEXT.authors[lang]}</p>
          <p className="of-sample-text">{SOURCE_TEXT.authored[lang]}</p>
        </div>
        <div className="of-aside">
          <table className="of-table">
            <caption>{SOURCE_TEXT.compare[lang]}</caption>
            <tbody>
              <tr><th scope="row">{SOURCE_TEXT.engine[lang]}</th><td>{recovery === null ? '-' : `${formatFixed(recovery, lang, 1)}%`}</td></tr>
              <tr><th scope="row">{SOURCE_TEXT.measured[lang]}</th><td>{`${formatFixed(sample.measured_recovery_pct, lang, 1)}%`}</td></tr>
              {Object.entries(lanePredictions).map(([m, v]) => (
                <tr key={m}><th scope="row">{`${SOURCE_TEXT.lane[lang]}: ${LANE_MODEL[m]?.[lang] ?? m.replace(/_/g, ' ')}`}</th><td>{`${formatFixed(v, lang, 1)}%`}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="of-footnote">{SOURCE_TEXT.comparison[lang]}</p>
          <p className="of-footnote">{`${record.summary.samples} ${lang === 'es' ? 'muestras' : 'samples'}; ${metricLabel('recovery_pct', lang)} ${lang === 'es' ? 'del motor menos la medida, media' : 'of the engine minus the measured, mean'} ${formatFixed(record.summary.engine_minus_measured_pp.mean, lang, 1)} ${lang === 'es' ? 'puntos' : 'points'}.`}</p>
        </div>
      </div>
    </div>
  );
}

/** The readout row of an hour: the next hour's measured silica and the two baselines, in the readout's place. */
export function HourReadout({ lane, hourKey, lang, cursor }: { lane: IronPlant; hourKey: string | null; lang: Lang; cursor: string | null }) {
  const { hour } = hourOf(lane, hourKey);
  const items: Array<[string, number]> = [[SOURCE_TEXT.next[lang], hour.observed_pct], [IRON_NAME.previous_lab[lang], hour.predictions_pct.previous_lab],
    [IRON_NAME.ridge[lang], hour.predictions_pct.ridge]];
  return (
    <div className="of-readout" role="status" aria-live="polite">
      <span className="of-readout-item"><span className="of-readout-label">{SOURCE_TEXT.hourLabel[lang]}</span><strong>{hour.sensor_hour.slice(0, 16)}</strong></span>
      {items.map(([label, v]) => (
        <span key={label} className="of-readout-item"><span className="of-readout-label">{label}</span><strong>{`${formatFixed(v, lang, 2)}%`}</strong></span>
      ))}
      <span className="of-readout-flags" title={SOURCE_TEXT.recorded[lang]}>{SOURCE_TEXT.recorded[lang]}</span>
      {cursor && <span className="of-readout-cursor" title={cursor}>{cursor}</span>}
    </div>
  );
}

export function HourView({ lane, hourKey, lang, onCursor }: { lane: IronPlant; hourKey: string | null; lang: Lang; onCursor: (text: string | null) => void }) {
  const { window, index, hour } = hourOf(lane, hourKey);
  const xs = window.trace.map((_, i) => i);
  return (
    <div className="of-view of-view-hour">
      <div className="of-split">
        <div className="of-stack">
          <Chart data={[xs, window.trace.map(t => t.observed_pct), window.trace.map(t => t.predictions_pct.previous_lab)] as uPlot.AlignedData}
            xLabel={SOURCE_TEXT.hourAxis[lang]} yLabel={SOURCE_TEXT.silicaAxis[lang]} title={SOURCE_TEXT.traceTitle[lang]} summary={SOURCE_TEXT.traceSummary[lang]}
            series={[{ label: SOURCE_TEXT.observed[lang], colour: 'accent', points: true }, { label: IRON_NAME.previous_lab[lang], colour: 'warn', dash: [4, 4] }]}
            marks={[{ x: index, label: SOURCE_TEXT.thisHour[lang] }]}
            format={(v, axis) => (v === null ? '-' : axis === 'x' ? String(v) : `${formatFixed(v, lang, 2)}%`)}
            onCursor={c => onCursor(c ? `${window.trace[c.index].sensor_hour.slice(0, 16)}: ${SOURCE_TEXT.observed[lang]} ${formatFixed(window.trace[c.index].observed_pct, lang, 2)}%` : null)} />
          <table className="of-table of-table-data">
            <caption>{`${SOURCE_TEXT.hourTitle[lang]}: ${hour.sensor_hour.slice(0, 16)}`}</caption>
            <thead><tr><th scope="col">{SOURCE_TEXT.model[lang]}</th><th scope="col">%</th><th scope="col">{SOURCE_TEXT.error[lang]}</th></tr></thead>
            <tbody>
              <tr className="of-table-group"><th scope="row">{SOURCE_TEXT.next[lang]}</th><td>{formatFixed(hour.observed_pct, lang, 2)}</td><td /></tr>
              {IRON_MODELS.map(m => (
                <tr key={m}><th scope="row">{IRON_NAME[m][lang]}</th><td>{formatFixed(hour.predictions_pct[m], lang, 2)}</td>
                  <td>{formatFixed(hour.predictions_pct[m] - hour.observed_pct, lang, 2)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="of-footnote">{SOURCE_TEXT.laneNote[lang]}</p>
        </div>
        <div className="of-aside">
          <table className="of-table">
            <caption>{`${SOURCE_TEXT.labNow[lang]}: ${SOURCE_TEXT.silica[lang]} ${formatFixed(hour.lab_pct.silica, lang, 2)}%, ${SOURCE_TEXT.iron[lang]} ${formatFixed(hour.lab_pct.iron, lang, 2)}%`}</caption>
            <thead><tr><th scope="col">{SOURCE_TEXT.sensor[lang]}</th><th scope="col">{SOURCE_TEXT.value[lang]}</th></tr></thead>
            <tbody>{Object.entries(hour.sensors).map(([name, v]) => <tr key={name}><th scope="row">{name}</th><td>{formatFixed(v, lang, 2)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
