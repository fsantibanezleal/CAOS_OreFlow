/**
 * The uncertainty record of the variant (PE-28): a seeded scrambled Latin hypercube over the ore's
 * uncertain properties (work index, head grade, liberation size and, with flotation, floatability),
 * each a uniform factor around 1 with an authored half width. The histogram shows how one output is
 * distributed with P05, P50, P95 and the base state marked; the scatter shows that output against one
 * factor, which is where the spread comes from; the tables give the probability of meeting each
 * constraint of the optimizer and the quantiles of every output. The baked samples are shown until the
 * user re-runs the design at another seed or sample count (UQ-06): the worker then runs the engine on
 * every sample of the current state, one run per tick with its progress, and the live record replaces
 * the baked one until the user returns to it. Nothing runs without the button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cancelRun, uncertaintyInWorker } from '../../../engine/client';
import { validateControl, type OperatingContract } from '../../../engine/contract';
import type { OperatingPoint, Ore, Plant } from '../../../engine/model';
import type uPlot from 'uplot';
import type { UncertaintyRecord } from '../../../lib/artifacts.types';
import { formatFraction, formatSignificant, formatValue, formatWithUnit, unitLabel, type Lang } from '../../../lib/format';
import { histogram as binned } from '../../../lib/histogram';
import { flagShort, metricLabel } from '../../../lib/i18n';
import { Chart } from '../../../components/charts/Chart';

export const FACTOR_LABEL: Record<string, { en: string; es: string }> = {
  work_index: { en: 'Work index factor', es: 'Factor del índice de trabajo' },
  head_grade: { en: 'Head grade factor', es: 'Factor de la ley de cabeza' },
  liberation_size: { en: 'Liberation size factor', es: 'Factor del tamaño de liberación' },
  floatability: { en: 'Floatability factor', es: 'Factor de flotabilidad' },
};
const CHECK_LABEL: Record<string, { en: string; es: string }> = {
  grade_meets_spec: { en: 'Grade at or above the specification', es: 'Ley sobre la especificación' },
  power_within_installed: { en: 'Required power within installed', es: 'Potencia requerida dentro de la instalada' },
  water_within_capacity: { en: 'Process water within capacity', es: 'Agua de proceso dentro de la capacidad' },
  all_constraints: { en: 'Every constraint at once', es: 'Todas las restricciones a la vez' },
};
const TEXT = {
  output: { en: 'Output', es: 'Salida' },
  factor: { en: 'Against', es: 'Contra' },
  count: { en: 'Samples in the bin', es: 'Muestras en el intervalo' },
  histogram: { en: 'Samples', es: 'Muestras' },
  samples: { en: 'Sample', es: 'Muestra' },
  base: { en: 'base', es: 'base' },
  nominal: { en: 'nominal', es: 'nominal' },
  probability: { en: 'Probability', es: 'Probabilidad' },
  baseState: { en: 'Base state', es: 'Estado base' },
  met: { en: 'met', es: 'cumple' },
  notMet: { en: 'not met', es: 'no cumple' },
  quantile: { en: 'Output', es: 'Salida' },
  spread: { en: 'Half width', es: 'Semiancho' },
  design: { en: 'SplitMix64 Latin hypercube', es: 'hipercubo latino SplitMix64' },
  flags: { en: 'Engine flags among the samples', es: 'Avisos del motor en las muestras' },
  none: { en: 'none', es: 'ninguno' },
  seed: { en: 'seed', es: 'semilla' },
  baked: { en: 'Baked for the variant state; the controls have changed since.', es: 'Calculado para el estado de la variante; los controles cambiaron desde entonces.' },
  rerun: { en: 'Re-run the design', es: 'Volver a correr el diseño' },
  run: { en: 'Run', es: 'Correr' },
  cancel: { en: 'Cancel', es: 'Cancelar' },
  running: { en: 'Engine runs', es: 'Corridas del motor' },
  live: { en: 'Live record at the current state', es: 'Registro en vivo en el estado actual' },
  showBaked: { en: 'Show the baked record', es: 'Mostrar el registro horneado' },
  failed: { en: 'The run failed', es: 'La corrida falló' },
};
/** Equal-width bins for the histogram over the sampled range. */
const BINS = 16;

export function outputUnit(output: string, gradeUnit: string): string {
  return ({ recovery_pct: '%', concentrate_grade: gradeUnit, specific_energy_grinding_kwh_t: 'kWh/t', recovered_primary_tph: 't/h' } as Record<string, string>)[output] ?? '';
}

export function Uncertainty({ record: baked, contract, ore, plant, point, gradeUnit, modified, lang, onCursor }: {
  record: UncertaintyRecord; contract: OperatingContract; ore: Ore; plant: Plant; point: OperatingPoint;
  gradeUnit: string; modified: boolean; lang: Lang; onCursor: (text: string | null) => void;
}) {
  const controls = contract.controls;
  const [seedText, setSeedText] = useState(String(baked.seed));
  const [samples, setSamples] = useState(baked.samples);
  const [live, setLive] = useState<UncertaintyRecord | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const runId = useRef(0);
  useEffect(() => () => { if (runId.current) cancelRun(runId.current); }, []);
  const seedVerdict = controls ? validateControl(contract, 'uncertainty_seed', seedText.trim() === '' ? Number.NaN : Number(seedText)) : null;
  const sampleOptions = controls ? Array.from({ length: (controls.uncertainty_samples.max - controls.uncertainty_samples.min) / controls.uncertainty_samples.step + 1 },
    (_, i) => controls.uncertainty_samples.min + i * controls.uncertainty_samples.step) : [];
  const start = () => {
    if (!seedVerdict?.accepted || seedVerdict.value === null) return;
    if (runId.current) cancelRun(runId.current);
    setFailure(null);
    setProgress({ done: 0, total: samples });
    const { id, done } = uncertaintyInWorker(ore, plant, point, samples, seedVerdict.value, (d, total) => setProgress({ done: d, total }));
    runId.current = id;
    done.then(result => { if (runId.current === id) { setLive(result as UncertaintyRecord); setProgress(null); runId.current = 0; } },
      (error: Error) => { if (runId.current === id) { setProgress(null); runId.current = 0; if (error.message !== 'cancelled') setFailure(error.message); } });
  };
  const stop = () => { if (runId.current) { cancelRun(runId.current); runId.current = 0; } setProgress(null); };
  const record = live ?? baked;
  const outputs = Object.keys(record.outputs);
  const factors = Object.keys(record.inputs);
  const [output, setOutput] = useState(outputs[0]);
  const [factor, setFactor] = useState(factors[0]);
  const dist = record.outputs[output];
  const unit = outputUnit(output, gradeUnit);

  const histogram = useMemo(() => binned(dist.values, BINS), [dist]);

  const scatter = useMemo(() => {
    const k = factors.indexOf(factor);
    const pairs = record.factors.map((row, i) => [row[k], dist.values[i]] as const).sort((a, b) => a[0] - b[0]);
    return [pairs.map(p => p[0]), pairs.map(p => p[1])] as uPlot.AlignedData;
  }, [record, factor, factors, dist]);

  const marks = [{ x: dist.p05, label: 'P05' }, { x: dist.p50, label: 'P50' }, { x: dist.p95, label: 'P95' }, { x: dist.base, label: TEXT.base[lang] }];
  const outputLabel = `${metricLabel(output, lang)} (${unitLabel(unit)})`;
  const checks = Object.keys(record.probabilities);
  const flags = Object.entries(record.flag_counts);

  return (
    <div className="of-split">
      <div className="of-stack">
        <Chart data={[histogram.centres, histogram.counts] as uPlot.AlignedData} xLabel={outputLabel} yLabel={TEXT.count[lang]} title={`${metricLabel(output, lang)}: ${record.samples} ${lang === 'es' ? 'muestras' : 'samples'}`}
          series={[{ label: TEXT.histogram[lang], colour: 'accent', bars: true }]} marks={marks}
          summary={`${metricLabel(output, lang)}: ${record.samples} ${lang === 'es' ? 'muestras' : 'samples'}, P05 ${formatWithUnit(dist.p05, unit, lang)}, P50 ${formatWithUnit(dist.p50, unit, lang)}, P95 ${formatWithUnit(dist.p95, unit, lang)}.`}
          format={(v, axis) => (axis === 'x' ? formatValue(v, unit, lang) : String(v))}
          onCursor={reading => onCursor(reading ? `${formatWithUnit(reading.x - histogram.width / 2, unit, lang)} – ${formatWithUnit(reading.x + histogram.width / 2, unit, lang)}: ${reading.values[0]} ${lang === 'es' ? 'muestras' : 'samples'}` : null)} />
        <Chart data={scatter} xLabel={FACTOR_LABEL[factor][lang]} yLabel={outputLabel}
          series={[{ label: TEXT.samples[lang], colour: 'accent-2', points: true }]} marks={[{ x: 1.0, label: TEXT.nominal[lang] }]}
          summary={`${metricLabel(output, lang)} ${lang === 'es' ? 'contra' : 'against'} ${FACTOR_LABEL[factor][lang]}`}
          format={(v, axis) => (axis === 'x' ? formatSignificant(v, lang, 3) : formatValue(v, unit, lang))}
          onCursor={reading => onCursor(reading ? `${FACTOR_LABEL[factor][lang]} ${formatSignificant(reading.x, lang, 3)}: ${formatWithUnit(reading.values[0], unit, lang)}` : null)} />
      </div>
      <div className="of-aside">
        {controls && (
          <div className="of-rerun">
            <p className="of-facts-title">{TEXT.rerun[lang]}</p>
            <div className="of-fields">
              <label className="of-field"><span>{controls.uncertainty_seed.label[lang]}</span>
                <input type="number" inputMode="numeric" min={controls.uncertainty_seed.min} max={controls.uncertainty_seed.max} step={1} value={seedText}
                  title={controls.uncertainty_seed.help[lang]} onChange={e => setSeedText(e.target.value)} /></label>
              <label className="of-field"><span>{controls.uncertainty_samples.label[lang]}</span>
                <select value={samples} title={controls.uncertainty_samples.help[lang]} onChange={e => setSamples(Number(e.target.value))}>
                  {sampleOptions.map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            </div>
            {seedVerdict && !seedVerdict.accepted && <p className="of-note">{contract.messages[seedVerdict.errors[0].code]?.[lang] ?? seedVerdict.errors[0].code}</p>}
            <div className="of-actions">
              <button type="button" className="of-run" onClick={start} disabled={!seedVerdict?.accepted || progress !== null}>{TEXT.run[lang]}</button>
              {progress && <button type="button" className="of-revert" onClick={stop}>{TEXT.cancel[lang]}</button>}
              {progress && <span className="of-progress">{`${TEXT.running[lang]}: ${progress.done} / ${progress.total}`}</span>}
            </div>
            {failure && <p className="of-note">{`${TEXT.failed[lang]}: ${failure}`}</p>}
            {live && <div className="of-actions">
              <p className="of-status-line">{`${TEXT.live[lang]}: ${TEXT.seed[lang]} ${live.seed}, ${live.samples} ${lang === 'es' ? 'muestras' : 'samples'}`}</p>
              <button type="button" className="of-revert" onClick={() => setLive(null)}>{TEXT.showBaked[lang]}</button></div>}
          </div>
        )}
        {modified && !live && <p className="of-note">{TEXT.baked[lang]}</p>}
        <div className="of-fields">
          <label className="of-field"><span>{TEXT.output[lang]}</span>
            <select value={output} onChange={e => setOutput(e.target.value)}>{outputs.map(o => <option key={o} value={o}>{metricLabel(o, lang)}</option>)}</select></label>
          <label className="of-field"><span>{TEXT.factor[lang]}</span>
            <select value={factor} onChange={e => setFactor(e.target.value)}>{factors.map(f => <option key={f} value={f}>{FACTOR_LABEL[f][lang]}</option>)}</select></label>
        </div>
        <table className="of-table">
          <thead><tr><th scope="col">{TEXT.quantile[lang]}</th><th scope="col">P05</th><th scope="col">P50</th><th scope="col">P95</th><th scope="col">{TEXT.base[lang]}</th></tr></thead>
          <tbody>{outputs.map(o => {
            const d = record.outputs[o];
            const u = outputUnit(o, gradeUnit);
            return (
              <tr key={o} className={o === output ? 'is-selected' : undefined}><th scope="row">{`${metricLabel(o, lang)} (${unitLabel(u)})`}</th>
                <td>{formatValue(d.p05, u, lang)}</td><td>{formatValue(d.p50, u, lang)}</td><td>{formatValue(d.p95, u, lang)}</td><td>{formatValue(d.base, u, lang)}</td></tr>
            );
          })}</tbody>
        </table>
        <table className="of-table">
          <thead><tr><th scope="col" /><th scope="col">{TEXT.probability[lang]}</th><th scope="col">{TEXT.baseState[lang]}</th></tr></thead>
          <tbody>{checks.map(c => (
            <tr key={c}><th scope="row">{CHECK_LABEL[c]?.[lang] ?? c}</th><td>{formatFraction(record.probabilities[c], lang, 0)}</td>
              <td>{c in record.base_checks ? (record.base_checks[c] ? TEXT.met[lang] : TEXT.notMet[lang]) : ''}</td></tr>
          ))}</tbody>
        </table>
        <p className="of-footnote">
          {`${record.samples} ${lang === 'es' ? 'muestras' : 'samples'}, ${TEXT.design[lang]}, ${TEXT.seed[lang]} ${record.seed}; `}
          {factors.map(f => `${FACTOR_LABEL[f][lang]} ±${formatFraction(record.inputs[f].half_width, lang, 0)}`).join(', ')}
          {`. ${TEXT.flags[lang]}: ${flags.length ? flags.map(([code, n]) => `${flagShort(code, lang)} (${n})`).join('; ') : TEXT.none[lang]}.`}
        </p>
      </div>
    </div>
  );
}
