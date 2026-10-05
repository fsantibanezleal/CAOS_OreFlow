/**
 * The Sobol record (PE-28), computed at the case's nominal state: Saltelli sampling and SALib's
 * estimator over the same uncertain factors as the uncertainty record. S1 is the share of an output's
 * variance a factor explains alone, ST the share it takes part in, interactions included; ST minus S1
 * is what it explains only together with the others. The bars are the baked estimates and the table carries their
 * bootstrap half widths, which resample the rows of a quasi-random design as independent draws and so overstate the
 * estimator's error (M-07); an interaction within them is shown as such, never as a negative share (M-06).
 */
import { useState } from 'react';
import type uPlot from 'uplot';
import type { SensitivityRecord } from '../../../lib/artifacts.types';
import { formatEstimate, formatFixed, formatFraction, formatSignificant, intervalDecimals, type Lang } from '../../../lib/format';
import { metricLabel } from '../../../lib/i18n';
import { Chart } from '../../../components/charts/Chart';
import { FACTOR_LABEL } from './Uncertainty';

const TEXT = {
  output: { en: 'Output', es: 'Salida' },
  factor: { en: 'Uncertain factor', es: 'Factor incierto' },
  index: { en: 'Sobol index', es: 'Índice de Sobol' },
  first: { en: 'First order (S1)', es: 'Primer orden (S1)' },
  total: { en: 'Total (ST)', es: 'Total (ST)' },
  interaction: { en: 'ST − S1', es: 'ST − S1' },
  spread: { en: 'Half width', es: 'Semiancho' },
  constant: { en: 'This output does not vary over the uncertain factors at this state.', es: 'Esta salida no varía con los factores inciertos en este estado.' },
  nominalOnly: { en: 'Computed at the nominal state of the case; the other variants carry the uncertainty record only.', es: 'Calculado en el estado nominal del caso; las demás variantes solo llevan el registro de incertidumbre.' },
  summary: { en: 'First-order and total Sobol indices of the chosen output for each uncertain factor.', es: 'Índices de Sobol de primer orden y totales de la salida elegida para cada factor incierto.' },
  footnote: { en: 'Saltelli sampling, SALib; half widths from a bootstrap that resamples the design\'s rows as independent draws, conservative for a Sobol design and not 95% intervals. Estimates can fall below 0, above 1 and ST below S1 within that error.', es: 'Muestreo de Saltelli, SALib; semianchos de un bootstrap que remuestrea las filas del diseño como extracciones independientes, conservador para un diseño de Sobol y no intervalos del 95%. Las estimaciones pueden caer bajo 0, sobre 1 y ST bajo S1 dentro de ese error.' },
  withinError: { en: 'within error', es: 'dentro del error' },
  refused: { en: 'Some draws of the design have no steady state at this state, and a Saltelli design cannot drop rows: no indices.', es: 'Algunas muestras del diseño no tienen estado estacionario en este estado, y un diseño de Saltelli no puede descartar filas: sin índices.' },
  evaluations: { en: 'engine evaluations', es: 'evaluaciones del motor' },
  base: { en: 'base samples', es: 'muestras base' },
};

export function Sensitivity({ record, atNominal, lang, onCursor }: {
  record: SensitivityRecord; atNominal: boolean; lang: Lang; onCursor: (text: string | null) => void;
}) {
  const outputs = Object.keys(record.indices ?? {});
  const factors = Object.keys(record.inputs);
  const [output, setOutput] = useState(outputs[0]);
  if (record.status === 'refused_draws' || outputs.length === 0) return <p className="of-hint">{TEXT.refused[lang]}</p>;
  const indices = record.indices[output];
  const names = factors.map(f => FACTOR_LABEL[f][lang]);
  // U-30: an index to its interval's decimal place ("0.00 ± 0.01", not "0.0022 ± 0.01")
  const pm = (value: number, conf: number) => formatEstimate(value, conf, lang);

  let chart: React.ReactNode = <p className="of-hint">{TEXT.constant[lang]}</p>;
  if (!('constant' in indices)) {
    const s1 = factors.map(f => indices.S1[f]);
    const st = factors.map(f => indices.ST[f]);
    const low = Math.min(0, ...factors.map(f => indices.S1[f] - indices.S1_conf[f]));
    const high = Math.max(0.1, ...factors.map(f => indices.ST[f] + indices.ST_conf[f])) * 1.08;
    chart = (
      <Chart data={[factors.map((_, i) => i), s1, st] as uPlot.AlignedData} categories={names} title={`${TEXT.index[lang]}: ${metricLabel(output, lang)}`} xLabel={TEXT.factor[lang]} yLabel={TEXT.index[lang]}
        yRange={[low, high]} levels={[{ y: 0, label: '' }]}
        series={[{ label: TEXT.first[lang], colour: 'accent', bars: true, align: -1 }, { label: TEXT.total[lang], colour: 'warn', bars: true, align: 1 }]}
        summary={`${TEXT.summary[lang]} ${metricLabel(output, lang)}.`}
        format={(v, axis) => (axis === 'x' ? String(v) : formatSignificant(v, lang, 3))}
        onCursor={reading => {
          if (!reading) { onCursor(null); return; }
          const f = factors[reading.index];
          onCursor(`${names[reading.index]}: S1 ${pm(indices.S1[f], indices.S1_conf[f])}, ST ${pm(indices.ST[f], indices.ST_conf[f])}`);
        }} />
    );
  }

  return (
    <div className="of-split">
      {chart}
      <div className="of-aside">
        {!atNominal && <p className="of-note">{TEXT.nominalOnly[lang]}</p>}
        <div className="of-fields">
          <label className="of-field"><span>{TEXT.output[lang]}</span>
            <select value={output} onChange={e => setOutput(e.target.value)}>{outputs.map(o => <option key={o} value={o}>{metricLabel(o, lang)}</option>)}</select></label>
        </div>
        {!('constant' in indices) && (
          <table className="of-table">
            <thead><tr><th scope="col">{TEXT.factor[lang]}</th><th scope="col">S1</th><th scope="col">ST</th><th scope="col">{TEXT.interaction[lang]}</th></tr></thead>
            <tbody>{factors.map((f, i) => (
              <tr key={f}><th scope="row">{names[i]} <span className="of-muted">{`±${formatFraction(record.inputs[f].half_width, lang, 0)}`}</span></th>
                <td>{pm(indices.S1[f], indices.S1_conf[f])}</td><td>{pm(indices.ST[f], indices.ST_conf[f])}</td>
                <td className="of-wrap">{Math.abs(indices.ST[f] - indices.S1[f]) <= indices.S1_conf[f] + indices.ST_conf[f]
                  ? <span className="of-muted">{TEXT.withinError[lang]}</span>
                  : formatFixed(indices.ST[f] - indices.S1[f], lang, Math.max(intervalDecimals(indices.S1_conf[f]), intervalDecimals(indices.ST_conf[f])))}</td></tr>
            ))}</tbody>
          </table>
        )}
        <p className="of-footnote">{`${TEXT.footnote[lang]} ${record.base_samples} ${TEXT.base[lang]}, ${record.evaluations} ${TEXT.evaluations[lang]}.`}</p>
      </div>
    </div>
  );
}
