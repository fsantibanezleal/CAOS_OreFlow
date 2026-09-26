/**
 * The learned lane in the browser (PE-29, PE-39): the exported surrogate (an MLP trained on the 3072
 * engine states of the learning design) and its autoencoder guard, run by onnxruntime-web. For the
 * current state the panel sets the surrogate's recovery, concentrate grade and specific energy beside
 * the engine's; on request it sweeps one contract input with the engine in the Web Worker and asks the
 * surrogate for the same states, so the two responses can be compared where the surrogate follows the
 * engine and where it departs, with the guard's reconstruction error against its threshold. The
 * protocol results of the bake say how far to trust it: the interpolation split and leave one case out.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type uPlot from 'uplot';
import { cancelSweep, sweepInWorker } from '../../../engine/client';
import type { OperatingContract } from '../../../engine/contract';
import type { OperatingPoint } from '../../../engine/model';
import type { Trace } from '../../../engine/trace';
import { askSurrogate, type SurrogateAnswer } from '../../../learning/surrogate';
import { loadLearning } from '../../../lib/artifacts';
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
  surrogate: { en: 'Surrogate (ONNX)', es: 'Sustituto (ONNX)' },
  outside: { en: 'Guard: outside the training design', es: 'Guardia: fuera del diseño de entrenamiento' },
  guardError: { en: 'Guard reconstruction error', es: 'Error de reconstrucción del guardia' },
  guardAxis: { en: 'Guard error', es: 'Error del guardia' },
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
  verdictIn: { en: 'The guard accepts this state: it lies inside the training design.', es: 'El guardia acepta este estado: está dentro del diseño de entrenamiento.' },
  verdictOut: { en: 'The guard flags this state: it lies outside the training design, so the surrogate is extrapolating.', es: 'El guardia marca este estado: está fuera del diseño de entrenamiento, así que el sustituto extrapola.' },
  hint: { en: 'Choose an input and compute: the engine sweeps it in the background and the surrogate answers for the same states.', es: 'Elija una entrada y calcule: el motor la barre en segundo plano y el sustituto responde para los mismos estados.' },
  loading: { en: 'Loading the ONNX models', es: 'Cargando los modelos ONNX' },
  failed: { en: 'The ONNX models could not be loaded', es: 'No se pudieron cargar los modelos ONNX' },
  protocol: { en: 'How far to trust it (bake protocols, exported MLP)', es: 'Cuánto confiar (protocolos del horneado, MLP exportado)' },
  interpolation: { en: 'Interpolation split R²', es: 'R² en la partición de interpolación' },
  loco: { en: 'Leave one case out: median R²', es: 'Dejando un caso fuera: R² mediano' },
  locoRmse: { en: 'Leave one case out: mean RMSE', es: 'Dejando un caso fuera: RMSE medio' },
  guardRates: { en: 'Guard false alarms / false accepts', es: 'Guardia: falsas alarmas / falsas aceptaciones' },
  heldOut: { en: 'States of the held-out case the guard flags', es: 'Estados del caso excluido que marca el guardia' },
  bimodal: {
    en: 'The mean over the twelve folds: the guard flags every state of an unseen plant unlike any trained one and almost none of a copper sulphide plant like the others (see Methodology, learned lane).',
    es: 'Media de los doce pliegues: el guardia marca todos los estados de una planta no vista distinta de las entrenadas y casi ninguno de una planta de sulfuros de cobre parecida a las demás (ver Metodología, vía aprendida).',
  },
  learnedAs: { en: 'learned as the log10 upgrade ratio', es: 'aprendida como log10 de la razón de enriquecimiento' },
  summary: { en: 'The engine and the surrogate over one contract input, other inputs held at the current state.', es: 'El motor y el sustituto sobre una entrada del contrato, con las demás en el estado actual.' },
  guardSummary: { en: 'The guard reconstruction error over the same states, against its threshold.', es: 'El error de reconstrucción del guardia sobre los mismos estados, frente a su umbral.' },
  progress: { en: 'states', es: 'estados' },
};

type SweepResult = { xs: number[]; engine: (number | null)[]; surrogate: (number | null)[]; outside: (number | null)[]; guard: (number | null)[] };

export function Learned({ contract, artifact, point, trace, lang, onCursor }: {
  contract: OperatingContract; artifact: CaseArtifact; point: OperatingPoint; trace: Trace | null; lang: Lang;
  onCursor: (text: string | null) => void;
}) {
  const caseId = artifact.case_id;
  const entry = contract.cases[caseId];
  const names = Object.keys(entry.inputs);
  const declared = Object.fromEntries(contract.inputs.map(s => [s.name, s]));
  const gradeUnit = entry.primary.unit;
  const unitOf = (name: string) => (declared[name].unit === 'case' ? gradeUnit : declared[name].unit);
  const targetUnit = (target: Target) => (target === 'recovery_pct' ? '%' : target === 'concentrate_grade' ? gradeUnit : 'kWh/t');
  const [xInput, setX] = useState(names.includes('target_p80_um') ? 'target_p80_um' : names[0]);
  const [target, setTarget] = useState<Target>('recovery_pct');
  const [current, setCurrent] = useState<SurrogateAnswer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [learning, setLearning] = useState<LearningRecord | null>(null);
  const [cells, setCells] = useState<Array<{ x: number; engine: Record<string, number> | null; point: OperatingPoint | null }>>([]);
  const [answers, setAnswers] = useState<SurrogateAnswer[] | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const running = useRef<number | null>(null);
  const request = useRef(0);

  useEffect(() => { loadLearning().then(setLearning, () => setLearning(null)); }, []);
  useEffect(() => () => { if (running.current !== null) cancelSweep(running.current); }, []);
  useEffect(() => { setCells([]); setAnswers(null); setProgress(null); }, [caseId, xInput]);

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
    const values = Array.from({ length: POINTS }, (_, i) => spec.min + (spec.max - spec.min) * i / (POINTS - 1));
    const axis = { input: xInput, values: declared[xInput].integer ? [...new Set(values.map(Math.round))] : values };
    setCells([]);
    setAnswers(null);
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
      .then(batch => { setCells(collected); setAnswers(batch); })   // one answer per accepted state, in order
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

  let body: React.ReactNode = <p className="of-hint">{status === 'failed' ? TEXT.failed[lang] : TEXT.hint[lang]}</p>;
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
    <div className="of-split">
      {body}
      <div className="of-aside">
        <div className="of-fields">
          <label className="of-field"><span>{TEXT.input[lang]}</span>
            <select value={xInput} onChange={e => setX(e.target.value)}>{names.map(n => <option key={n} value={n}>{declared[n].label[lang]}</option>)}</select></label>
          <label className="of-field"><span>{TEXT.target[lang]}</span>
            <select value={target} onChange={e => setTarget(e.target.value as Target)}>{TARGETS.map(o => <option key={o} value={o}>{metricLabel(o, lang)}</option>)}</select></label>
          <button type="button" className="of-run" onClick={compute} disabled={status !== 'ready'}>{t(UI.runSweep, lang)}</button>
          {progress && running.current !== null && <span className="of-progress" role="status">{`${progress[0]} / ${progress[1]} ${TEXT.progress[lang]}`}</span>}
        </div>
        {status === 'loading' && <p className="of-hint" role="status">{TEXT.loading[lang]}</p>}
        {current && trace && (
          <>
            <table className="of-table">
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
            </table>
            <p className={current.outside ? 'of-status-line warn' : 'of-status-line'}>
              {`${current.outside ? TEXT.verdictOut[lang] : TEXT.verdictIn[lang]} (${formatSignificant(current.guardError, lang, 3)} / ${formatSignificant(current.guardThreshold, lang, 3)})`}
            </p>
          </>
        )}
        {summaryRow && learning && <p className="of-facts-title">{`${TEXT.protocol[lang]}${target === 'concentrate_grade' ? `; ${TEXT.learnedAs[lang]}` : ''}`}</p>}
        {summaryRow && learning && (
          <dl className="of-facts">
            <div><dt>{TEXT.interpolation[lang]}</dt><dd>{formatSignificant(summaryRow.interpolation_r2, lang, 3)}</dd></div>
            <div><dt>{TEXT.loco[lang]}</dt><dd>{formatSignificant(summaryRow.loco_r2_median, lang, 3)}</dd></div>
            <div><dt>{TEXT.locoRmse[lang]}</dt><dd>{target === 'concentrate_grade' ? formatSignificant(summaryRow.loco_rmse_mean, lang, 3)
              : target === 'recovery_pct' ? `${formatSignificant(summaryRow.loco_rmse_mean, lang, 3)} ${TEXT.points[lang]}` : formatWithUnit(summaryRow.loco_rmse_mean, unit, lang)}</dd></div>
            <div><dt>{TEXT.guardRates[lang]}</dt><dd>{`${formatFraction(learning.guard.false_alarm_rate, lang, 1)} / ${formatFraction(learning.guard.false_accept_rate, lang, 1)}`}</dd></div>
            {heldOut !== null && <div><dt>{TEXT.heldOut[lang]}</dt><dd>{formatFraction(heldOut, lang, 0)}</dd></div>}
          </dl>
        )}
        {summaryRow && learning && <p className="of-footnote">{TEXT.bimodal[lang]}</p>}
      </div>
    </div>
  );
}
