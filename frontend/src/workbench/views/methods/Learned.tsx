/**
 * The learned lane in the browser (PE-29, PE-39): the exported surrogate (an MLP trained on the
 * engine states of the learning design) and its autoencoder guard, run by onnxruntime-web. For the
 * current state the panel sets the surrogate's recovery, concentrate grade and specific energy beside
 * the engine's; on request it sweeps one contract input with the engine in the Web Worker and asks the
 * surrogate for the same states, so the two responses can be compared where the surrogate follows the
 * engine and where it departs, with the guard's reconstruction error against its threshold. The
 * protocol results belong to separately fitted evaluation models, rather than the final frozen network.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type uPlot from 'uplot';
import { cancelSweep, sweepInWorker } from '../../../engine/client';
import { gridValues } from '../../../engine/sweep';
import type { OperatingContract } from '../../../engine/contract';
import type { OperatingPoint } from '../../../engine/model';
import type { Trace } from '../../../engine/trace';
import { askSurrogate, type SurrogateAnswer } from '../../../learning/surrogate';
import { describeGuard, GUARD_LABELS } from '../../../learning/guard-description';
import { formatFoldCounts, formatLearningMetric } from '../../../learning/evidence';
import type { CaseArtifact, LearningRecord } from '../../../lib/artifacts.types';
import { formatFraction, formatSignificant, formatValue, formatWithUnit, unitLabel, type Lang } from '../../../lib/format';
import { metricLabel, t, UI } from '../../../lib/i18n';
import { Chart } from '../../../components/charts/Chart';

const TARGETS = ['recovery_pct', 'concentrate_grade', 'specific_energy_total_kwh_t'] as const;
type Target = (typeof TARGETS)[number];
/** The learned target behind each shown quantity (the grade is learned as the log10 upgrade ratio). */
const LEARNED: Record<Target, string> = { recovery_pct: 'recovery_pct', concentrate_grade: 'log_upgrade', specific_energy_total_kwh_t: 'specific_energy_total_kwh_t' };
const POINTS = 17;
const TEXT = {
  input: { en: 'Input (x)', es: 'Entrada (x)' },
  target: { en: 'Quantity', es: 'Cantidad' },
  engine: { en: 'Engine', es: 'Motor' },
  surrogate: { en: 'Final MLP (ONNX)', es: 'MLP final (ONNX)' },
  outside: GUARD_LABELS.alert,
  guardError: GUARD_LABELS.error,
  guardAxis: GUARD_LABELS.axis,
  points: { en: 'pts', es: 'pp' },
  short: {
    recovery_pct: { en: 'Recovery', es: 'Recuperación' },
    concentrate_grade: { en: 'Grade', es: 'Ley' },
    specific_energy_total_kwh_t: { en: 'Energy', es: 'Energía' },
  } as Record<Target, { en: string; es: string }>,
  sweepTitle: { en: 'Engine and surrogate over one input', es: 'Motor y sustituto sobre una entrada' },
  threshold: { en: 'threshold', es: 'umbral' },
  current: { en: 'current', es: 'actual' },
  difference: { en: 'Difference', es: 'Diferencia' },
  hint: { en: 'Choose an input and compute: the engine sweeps it in the background and the surrogate answers for the same states.', es: 'Elija una entrada y calcule: el motor la barre en segundo plano y el sustituto responde para los mismos estados.' },
  loading: { en: 'Loading the ONNX models', es: 'Cargando los modelos ONNX' },
  failed: { en: 'The ONNX models could not be loaded', es: 'No se pudieron cargar los modelos ONNX' },
  protocol: { en: 'Protocol evaluation: MLP models fitted separately for each fold', es: 'Evaluación de protocolos: modelos MLP ajustados por separado para cada partición' },
  liveModel: { en: 'Live inference uses the final frozen MLP fitted on the complete learning design, including every case family.', es: 'La inferencia en vivo usa el MLP final congelado, ajustado con el diseño completo de aprendizaje, incluidas todas las familias de casos.' },
  activeMetrics: { en: 'Active-target protocol metrics', es: 'Métricas de protocolos del objetivo activo' },
  interpolation: { en: 'Fold interpolation R² (pooled / within case / case-mean baseline)', es: 'R² de interpolación por partición (conjunto / dentro de cada caso / media por caso)' },
  transfer: { en: 'One ore group out: conditional median R²', es: 'Un grupo de mineral fuera: R² mediano condicional' },
  cutMode: { en: 'The learned lane describes the target mode: its features carry the grind target and the design load, which a set classifier cut ignores, so it does not answer here.', es: 'La vía aprendida describe el modo objetivo: sus atributos llevan el objetivo de molienda y la carga de diseño, que un corte del clasificador fijado ignora, así que aquí no responde.' },
  loco: { en: 'One case out: conditional median R²', es: 'Un caso fuera: R² mediano condicional' },
  locoRmse: { en: 'One case out: conditional mean RMSE', es: 'Un caso fuera: RMSE medio condicional' },
  guardRates: { en: 'Protocol detector false alarms / false accepts', es: 'Detector de evaluación: falsas alarmas / falsas aceptaciones' },
  heldOut: { en: 'Mean alert share on held-out cases', es: 'Fracción media de alertas en casos reservados' },
  bimodal: {
    en: (low: string, high: string) => `Across held-out cases, alert rates range from ${low} to ${high}. These rates describe the detectors fitted separately for protocol evaluation.`,
    es: (low: string, high: string) => `Entre los casos reservados, las tasas de alerta van de ${low} a ${high}. Estas tasas corresponden a los detectores ajustados por separado para evaluar los protocolos.`,
  },
  learnedAs: { en: 'learned as the log10 upgrade ratio', es: 'aprendida como log10 de la razón de enriquecimiento' },
  summary: { en: 'The engine and the surrogate over one contract input, other inputs held at the current state.', es: 'El motor y el sustituto sobre una entrada del contrato, con las demás en el estado actual.' },
  guardSummary: { en: 'Reconstruction error over the same states, against the detector threshold; this signal does not establish training support or prediction accuracy.', es: 'Error de reconstrucción sobre los mismos estados, frente al umbral del detector; esta señal no demuestra pertenencia al dominio de entrenamiento ni precisión predictiva.' },
  progress: { en: 'states', es: 'estados' },
  changed: { en: 'The state changed since the last sweep, so its results were cleared; compute again.', es: 'El estado cambió desde el último barrido, así que sus resultados se borraron; calcule de nuevo.' },
};

type SweepResult = { xs: number[]; engine: (number | null)[]; surrogate: (number | null)[]; outside: (number | null)[]; guard: (number | null)[] };

export function Learned({ contract, artifact, point, trace, lang, onCursor, learning, evidence }: {
  contract: OperatingContract; artifact: CaseArtifact; point: OperatingPoint; trace: Trace | null; lang: Lang;
  onCursor: (text: string | null) => void; learning: LearningRecord | null; evidence?: ReactNode;
}) {
  const caseId = artifact.case_id;
  const entry = contract.cases[caseId];
  // an input with an off value (the classifier cut) switches the lane's domain, so it is no sweep axis here (L-02)
  const names = Object.keys(entry.inputs).filter(n => entry.inputs[n].off === undefined);
  const declared = Object.fromEntries(contract.inputs.map(s => [s.name, s]));
  const gradeUnit = entry.primary.unit;
  const unitOf = (name: string) => (declared[name].unit === 'case' ? gradeUnit : declared[name].unit);
  const targetUnit = (target: Target) => (target === 'recovery_pct' ? '%' : target === 'concentrate_grade' ? gradeUnit : 'kWh/t');
  const [xInput, setX] = useState(names.includes('target_p80_um') ? 'target_p80_um' : names[0]);
  const [target, setTarget] = useState<Target>('recovery_pct');
  const [current, setCurrent] = useState<SurrogateAnswer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [cells, setCells] = useState<Array<{ x: number; engine: Record<string, number> | null; point: OperatingPoint | null }>>([]);
  const [answers, setAnswers] = useState<SurrogateAnswer[] | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const running = useRef<number | null>(null);
  const request = useRef(0);

  useEffect(() => () => { if (running.current !== null) cancelSweep(running.current); }, []);
  useEffect(() => { setCells([]); setAnswers(null); setProgress(null); }, [caseId, xInput]);
  // U-02: the sweep and the guard chart belong to the state they ran at; when it moves they are stopped and cleared
  const stateKey = JSON.stringify(point);
  const ranAt = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (ranAt.current === null || ranAt.current === stateKey) return;
    if (running.current !== null) { cancelSweep(running.current); running.current = null; }
    ranAt.current = null;
    setCells([]);
    setAnswers(null);
    setProgress(null);
    setChanged(true);
  }, [stateKey]);

  // the surrogate for the current state; a newer state supersedes an answer still on its way
  useEffect(() => {
    const id = ++request.current;
    askSurrogate(artifact.definition.ore, artifact.definition.plant, [point]).then(
      ([answer]) => { if (id === request.current) { setCurrent(answer); setStatus('ready'); } },
      () => { if (id === request.current) setStatus('failed'); },
    );
  }, [artifact, point]);

  const shown = (answer: SurrogateAnswer, target: Target, headGrade: number) =>
    (target === 'concentrate_grade' ? headGrade * 10 ** answer.prediction.log_upgrade : answer.prediction[target]); // not-engine: inverts the learned target's definition, log10(grade / head)

  const compute = () => {
    if (running.current !== null) cancelSweep(running.current);
    const spec = entry.inputs[xInput];
    const axis = { input: xInput, values: gridValues(spec.min, spec.max, POINTS, declared[xInput].integer) };
    setCells([]);
    setAnswers(null);
    setChanged(false);
    ranAt.current = stateKey;
    const collected: Array<{ x: number; engine: Record<string, number> | null; point: OperatingPoint | null }> = axis.values.map(x => ({ x, engine: null, point: null }));
    const handle = sweepInWorker({ caseId, ore: artifact.definition.ore, plant: artifact.definition.plant, base: point, axes: [axis],
      outputs: ['recovery_pct', 'concentrate_grade', 'head_grade', 'specific_energy_total_kwh_t'] }, contract, (cell, done, total) => {
      collected[cell.index[0]] = { x: axis.values[cell.index[0]], engine: cell.accepted ? cell.metrics : null, point: cell.accepted ? cell.point as unknown as OperatingPoint : null };
      setProgress([done, total]);
    });
    running.current = handle.id;
    handle.done
      .then(() => {
        running.current = null;
        const accepted = collected.filter(c => c.point !== null).map(c => c.point as OperatingPoint);
        return askSurrogate(artifact.definition.ore, artifact.definition.plant, accepted);
      })
      .then(batch => { if (ranAt.current === stateKey) { setCells(collected); setAnswers(batch); } })   // one answer per accepted state, in order
      .catch(() => { running.current = null; });
  };

  const sweep: SweepResult | null = useMemo(() => {
    if (!answers || cells.length === 0) return null;
    let k = 0;
    const out: SweepResult = { xs: [], engine: [], surrogate: [], outside: [], guard: [] };
    for (const c of cells) {
      out.xs.push(c.x);
      if (c.engine === null) { out.engine.push(null); out.surrogate.push(null); out.outside.push(null); out.guard.push(null); continue; }
      const answer = answers[k++];
      // a cut-mode state has no learned answer (L-02)
      if (answer.notApplicable) { out.engine.push(c.engine[target]); out.surrogate.push(null); out.outside.push(null); out.guard.push(null); continue; }
      const value = shown(answer, target, c.engine.head_grade);
      out.engine.push(c.engine[target]);
      out.surrogate.push(value);
      out.outside.push(answer.outside ? value : null);
      out.guard.push(answer.guardError);
    }
    return out;
  }, [answers, cells, target]);

  const unit = targetUnit(target);
  const xLabel = `${declared[xInput].label[lang]} (${unitLabel(unitOf(xInput)) || '-'})`;
  const yLabel = `${metricLabel(target, lang)} (${unitLabel(unit)})`;
  const summaryRow = learning?.summary?.mlp?.[LEARNED[target]];
  const heldOut = learning ? learning.leave_one_case_out.reduce((s, f) => s + f.held_out_flag_rate, 0) / learning.leave_one_case_out.length : null;
  const headGrade = trace?.metrics.head_grade ?? point.head_grade;

  let body: React.ReactNode = <p className="of-hint">{status === 'failed' ? TEXT.failed[lang] : changed ? TEXT.changed[lang] : TEXT.hint[lang]}</p>;
  if (sweep) {
    body = (
      <div className="of-stack of-stack-2-1">
        <Chart data={[sweep.xs, sweep.engine, sweep.surrogate, sweep.outside] as uPlot.AlignedData} xLabel={xLabel} yLabel={yLabel} title={TEXT.sweepTitle[lang]}
          series={[{ label: TEXT.engine[lang], colour: 'accent' }, { label: TEXT.surrogate[lang], colour: 'warn', dash: [6, 4] },
            { label: TEXT.outside[lang], colour: 'bad', points: true }]}
          marks={[{ x: point[xInput as keyof OperatingPoint], label: TEXT.current[lang] }]} summary={TEXT.summary[lang]}
          format={(v, axis) => (axis === 'x' ? formatValue(v, unitOf(xInput), lang) : formatValue(v, unit, lang))}
          onCursor={reading => onCursor(reading ? `${formatWithUnit(reading.x, unitOf(xInput), lang)}: ${TEXT.engine[lang]} ${formatWithUnit(reading.values[0], unit, lang)}, ${TEXT.surrogate[lang]} ${formatWithUnit(reading.values[1], unit, lang)}` : null)} />
        <Chart data={[sweep.xs, sweep.guard] as uPlot.AlignedData} xLabel={xLabel} yLabel={TEXT.guardAxis[lang]} logY title={TEXT.guardError[lang]}
          series={[{ label: TEXT.guardError[lang], colour: 'magenta', points: true }]}
          levels={current ? [{ y: current.guardThreshold, label: TEXT.threshold[lang] }] : []} summary={TEXT.guardSummary[lang]}
          format={(v, axis) => (axis === 'x' ? formatValue(v, unitOf(xInput), lang) : formatSignificant(v, lang, 3))}
          onCursor={reading => onCursor(reading ? `${formatWithUnit(reading.x, unitOf(xInput), lang)}: ${TEXT.guardError[lang]} ${formatSignificant(reading.values[0], lang, 3)}` : null)} />
      </div>
    );
  }

  return (
    <div className="of-split of-split-beside of-learning-layout">
      {body}
      <div className="of-aside of-learning-aside" role="region" tabIndex={0}
        aria-label={lang === 'en' ? 'Learned results and evaluation evidence' : 'Resultados aprendidos y evidencia de evaluación'}>
        <div className="of-fields">
          <label className="of-field"><span>{TEXT.input[lang]}</span>
            <select value={xInput} onChange={e => setX(e.target.value)}>{names.map(n => <option key={n} value={n}>{declared[n].label[lang]}</option>)}</select></label>
          <label className="of-field"><span>{TEXT.target[lang]}</span>
            <select value={target} onChange={e => setTarget(e.target.value as Target)}>{TARGETS.map(o => <option key={o} value={o}>{metricLabel(o, lang)}</option>)}</select></label>
          <button type="button" className="of-run" onClick={compute} disabled={status !== 'ready'}>{t(UI.runSweep, lang)}</button>
          {progress && running.current !== null && <span className="of-progress" role="status">{`${progress[0]} / ${progress[1]} ${TEXT.progress[lang]}`}</span>}
        </div>
        <p className="of-footnote">{TEXT.liveModel[lang]}</p>
        {status === 'loading' && <p className="of-hint" role="status">{TEXT.loading[lang]}</p>}
        {current && trace && (
          <>
            {!current.notApplicable && <table className="of-table">
              <thead><tr><th scope="col" /><th scope="col">{TEXT.engine[lang]}</th><th scope="col">{TEXT.surrogate[lang]}</th><th scope="col">{TEXT.difference[lang]}</th></tr></thead>
              <tbody>{TARGETS.map(k => {
                const u = targetUnit(k);
                const engine = trace.metrics[k];
                const learned = shown(current, k, headGrade);
                return (
                  <tr key={k} className={k === target ? 'is-selected' : undefined}><th scope="row">{`${TEXT.short[k][lang]} (${unitLabel(u)})`}</th>
                    <td>{formatValue(engine, u, lang)}</td><td>{formatValue(learned, u, lang)}</td><td>{formatValue(learned - engine, u, lang)}</td></tr>
                );
              })}</tbody>
            </table>}
            <p className={current.outside ? 'of-status-line warn' : 'of-status-line'}>
              {current.notApplicable ? TEXT.cutMode[lang]
                : `${describeGuard(current.outside, lang)} (${formatSignificant(current.guardError, lang, 3)} / ${formatSignificant(current.guardThreshold, lang, 3)})`}
            </p>
          </>
        )}
        {summaryRow && learning && <p className="of-facts-title">{`${TEXT.protocol[lang]}${target === 'concentrate_grade' ? `; ${TEXT.learnedAs[lang]}` : ''}`}</p>}
        {summaryRow && learning && (
          <dl className="of-facts" aria-label={TEXT.activeMetrics[lang]}>
            <div><dt>{TEXT.interpolation[lang]}</dt><dd>{[summaryRow.interpolation_r2, summaryRow.interpolation_r2_within_case, summaryRow.case_mean_r2]
              .filter((v): v is number => v !== undefined).map(v => formatSignificant(v, lang, 3)).join(' / ')}</dd></div>
            <div><dt>{TEXT.transfer[lang]}</dt><dd>{formatLearningMetric(summaryRow.transfer_r2_median, lang)}<br /><small>{formatFoldCounts(summaryRow.transfer_folds, lang)}</small></dd></div>
            <div><dt>{TEXT.loco[lang]}</dt><dd>{formatLearningMetric(summaryRow.loco_r2_median, lang)}<br /><small>{formatFoldCounts(summaryRow.loco_folds, lang)}</small></dd></div>
            <div><dt>{TEXT.locoRmse[lang]}</dt><dd>{summaryRow.loco_rmse_mean === null ? formatLearningMetric(null, lang)
              : target === 'concentrate_grade' ? formatSignificant(summaryRow.loco_rmse_mean, lang, 3)
                : target === 'recovery_pct' ? `${formatSignificant(summaryRow.loco_rmse_mean, lang, 3)} ${TEXT.points[lang]}` : formatWithUnit(summaryRow.loco_rmse_mean, unit, lang)}
              <br /><small>{formatFoldCounts(summaryRow.loco_folds, lang)}</small></dd></div>
            <div><dt>{TEXT.guardRates[lang]}</dt><dd>{`${formatFraction(learning.guard.false_alarm_rate, lang, 1)} / ${formatFraction(learning.guard.false_accept_rate, lang, 1)}`}</dd></div>
            {heldOut !== null && <div><dt>{TEXT.heldOut[lang]}</dt><dd>{formatFraction(heldOut, lang, 0)}</dd></div>}
          </dl>
        )}
        {summaryRow && learning && <p className="of-footnote">{TEXT.bimodal[lang](
          formatFraction(Math.min(...learning.leave_one_case_out.map(f => f.held_out_flag_rate)), lang, 0),
          formatFraction(Math.max(...learning.leave_one_case_out.map(f => f.held_out_flag_rate)), lang, 0))}</p>}
        {evidence}
      </div>
    </div>
  );
}
