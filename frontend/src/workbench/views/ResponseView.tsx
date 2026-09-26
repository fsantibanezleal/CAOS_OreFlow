/**
 * Response view (PE-38): a metric against one contract input, or over two inputs as a decision surface,
 * computed in the Web Worker only when the user asks. States the contract rejects are shown as such and
 * never simulated. The surface carries the grade-specification and installed-power boundaries (their
 * limits come from the variant's optimization record) and marks the current state and the baked optimum.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type uPlot from 'uplot';
import { cancelSweep, sweepInWorker } from '../../engine/client';
import type { OperatingContract } from '../../engine/contract';
import type { OperatingPoint } from '../../engine/model';
import type { SweepCell } from '../../engine/sweep';
import type { CaseArtifact, OptimizationRecord } from '../../lib/artifacts.types';
import { formatSignificant, formatValue, formatWithUnit, unitLabel, type Lang } from '../../lib/format';
import { metricLabel, t, UI } from '../../lib/i18n';
import { Chart } from '../../components/charts/Chart';
import { Heatmap } from '../../components/charts/Heatmap';

const OUTPUTS = ['recovery_pct', 'concentrate_grade', 'recovered_primary_tph', 'specific_energy_total_kwh_t', 'mill_power_kw', 'p80_um', 'water_intensity_m3_t'];
const NEEDED = ['concentrate_grade', 'required_mill_power_kw', 'installed_mill_power_kw'];
const TEXT = {
  x: { en: 'Input (x)', es: 'Entrada (x)' },
  y: { en: 'Input (y)', es: 'Entrada (y)' },
  none: { en: 'none: one input', es: 'ninguna: una entrada' },
  metric: { en: 'Metric', es: 'Métrica' },
  grade: { en: 'grade spec', es: 'ley mínima' },
  power: { en: 'installed power', es: 'potencia instalada' },
  current: { en: 'current', es: 'actual' },
  optimum: { en: 'optimum', es: 'óptimo' },
  hint: { en: 'Choose inputs and a metric, then compute. The sweep runs in the background and the page stays responsive.', es: 'Elija entradas y una métrica, y calcule. El barrido corre en segundo plano y la página sigue respondiendo.' },
  progress: { en: 'states', es: 'estados' },
};

const linspace = (lo: number, hi: number, n: number, integer: boolean) => {
  const values = Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / (n - 1));
  return integer ? [...new Set(values.map(v => Math.round(v)))] : values;
};

export function ResponseView({ contract, artifact, optimization, point, lang, onCursor }: {
  contract: OperatingContract; artifact: CaseArtifact; optimization: OptimizationRecord; point: OperatingPoint; lang: Lang;
  onCursor: (text: string | null) => void;
}) {
  const entry = contract.cases[artifact.case_id];
  const names = Object.keys(entry.inputs);
  const declared = Object.fromEntries(contract.inputs.map(s => [s.name, s]));
  const [xInput, setX] = useState(names.includes('target_p80_um') ? 'target_p80_um' : names[0]);
  const [yInput, setY] = useState<string>(names.includes('collector_gpt') ? 'collector_gpt' : '');
  const [metric, setMetric] = useState('recovery_pct');
  const [cells, setCells] = useState<SweepCell[]>([]);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef<number | null>(null);
  const variantOpt = optimization;

  useEffect(() => () => { if (running.current !== null) cancelSweep(running.current); }, []);
  useEffect(() => { setCells([]); setProgress(null); }, [artifact.case_id, xInput, yInput]);

  const axes = useMemo(() => {
    const axis = (name: string, n: number) => ({ input: name, values: linspace(entry.inputs[name].min, entry.inputs[name].max, n, declared[name].integer) });
    return yInput ? [axis(xInput, 9), axis(yInput, 9)] : [axis(xInput, 17)];
  }, [xInput, yInput, entry, declared]);

  const compute = () => {
    if (running.current !== null) cancelSweep(running.current);
    setCells([]);
    const handle = sweepInWorker({ caseId: artifact.case_id, ore: artifact.definition.ore, plant: artifact.definition.plant, base: point, axes,
      outputs: [...new Set([...OUTPUTS, ...NEEDED])] }, contract, (cell, done, total) => {
      setCells(previous => [...previous, cell]);
      setProgress([done, total]);
    });
    running.current = handle.id;
    setBusy(true);
    const finish = () => { running.current = null; setBusy(false); };
    handle.done.then(finish, finish);
  };
  const cancel = () => { if (running.current !== null) { cancelSweep(running.current); running.current = null; setBusy(false); setProgress(null); } };

  const unitOf = (name: string) => (declared[name].unit === 'case' ? entry.primary.unit : declared[name].unit);
  const label = (name: string) => `${declared[name].label[lang]} (${unitLabel(unitOf(name)) || '-'})`;
  const metricUnit = metric === 'concentrate_grade' ? entry.primary.unit : ({ recovery_pct: '%', recovered_primary_tph: 't/h', specific_energy_total_kwh_t: 'kWh/t', mill_power_kw: 'kW', p80_um: 'um', water_intensity_m3_t: 'm3/t' } as Record<string, string>)[metric];
  const optimum = variantOpt.optimum?.decisions ?? {};

  let body: React.ReactNode = <p className="of-hint">{TEXT.hint[lang]}</p>;
  if (cells.length > 0 && axes.length === 1) {
    const xs = axes[0].values;
    const ys = xs.map((_, i) => { const c = cells.find(cc => cc.index[0] === i); return c && c.accepted ? c.metrics[metric] ?? null : null; });
    body = (
      <Chart data={[xs, ys] as uPlot.AlignedData} xLabel={label(xInput)} title={`${metricLabel(metric, lang)} ${lang === 'es' ? 'contra' : 'against'} ${declared[xInput].label[lang]}`} yLabel={`${metricLabel(metric, lang)} (${unitLabel(metricUnit)})`}
        series={[{ label: metricLabel(metric, lang), colour: 'accent', points: false }]}
        summary={`${metricLabel(metric, lang)} ${lang === 'es' ? 'contra' : 'against'} ${declared[xInput].label[lang]}`}
        marks={[{ x: point[xInput as keyof OperatingPoint], label: TEXT.current[lang] }, ...(xInput in optimum ? [{ x: optimum[xInput], label: TEXT.optimum[lang] }] : [])]}
        format={(v, axis) => (axis === 'x' ? formatValue(v, unitOf(xInput), lang) : formatValue(v, metricUnit, lang))}
        onCursor={reading => onCursor(reading ? `${formatWithUnit(reading.x, unitOf(xInput), lang)}: ${formatWithUnit(reading.values[0], metricUnit, lang)}` : null)} />
    );
  } else if (cells.length > 0) {
    const [ax, ay] = axes;
    const grid = (fn: (c: SweepCell) => number | null) => ay.values.map((_, j) => ax.values.map((_, i) => {
      const c = cells.find(cc => cc.index[0] === i && cc.index[1] === j);
      return c && c.accepted ? fn(c) : null;
    }));
    const z = grid(c => c.metrics[metric] ?? null);
    const gradeSlack = grid(c => c.metrics.concentrate_grade - variantOpt.constraints.grade.minimum);
    const powerSlack = grid(c => c.metrics.installed_mill_power_kw - c.metrics.required_mill_power_kw);
    const points = [{ x: point[xInput as keyof OperatingPoint], y: point[yInput as keyof OperatingPoint], label: TEXT.current[lang] },
      ...(xInput in optimum && yInput in optimum ? [{ x: optimum[xInput], y: optimum[yInput], label: TEXT.optimum[lang] }] : [])];
    body = (
      <Heatmap title={`${metricLabel(metric, lang)} ${lang === 'es' ? 'sobre' : 'over'} ${declared[xInput].label[lang]} ${lang === 'es' ? 'y' : 'and'} ${declared[yInput].label[lang]}`} xs={ax.values} ys={ay.values} z={z} xLabel={label(xInput)} yLabel={label(yInput)} zLabel={`${metricLabel(metric, lang)} (${unitLabel(metricUnit)})`}
        summary={`${metricLabel(metric, lang)} ${lang === 'es' ? 'sobre' : 'over'} ${declared[xInput].label[lang]} ${lang === 'es' ? 'y' : 'and'} ${declared[yInput].label[lang]}`}
        contours={[{ field: gradeSlack, label: TEXT.grade[lang], colour: '--color-fg' }, { field: powerSlack, label: TEXT.power[lang], colour: '--color-bad' }]}
        points={points}
        format={(v, axis) => (axis === 'x' ? formatValue(v, unitOf(xInput), lang) : axis === 'y' ? formatValue(v, unitOf(yInput), lang) : formatSignificant(v, lang, 3))}
        onCell={cell => onCursor(cell ? `${declared[xInput].label[lang]} ${formatWithUnit(cell.x, unitOf(xInput), lang)}, ${declared[yInput].label[lang]} ${formatWithUnit(cell.y, unitOf(yInput), lang)}: ${cell.z === null ? t(UI.rejected, lang) : formatWithUnit(cell.z, metricUnit, lang)}` : null)} />
    );
  }

  return (
    <div className="of-view of-view-response">
      <div className="of-response-controls" role="group">
        <label className="of-field"><span>{TEXT.x[lang]}</span>
          <select value={xInput} onChange={e => setX(e.target.value)}>{names.map(n => <option key={n} value={n}>{declared[n].label[lang]}</option>)}</select></label>
        <label className="of-field"><span>{TEXT.y[lang]}</span>
          <select value={yInput} onChange={e => setY(e.target.value)}><option value="">{TEXT.none[lang]}</option>{names.filter(n => n !== xInput).map(n => <option key={n} value={n}>{declared[n].label[lang]}</option>)}</select></label>
        <label className="of-field"><span>{TEXT.metric[lang]}</span>
          <select value={metric} onChange={e => setMetric(e.target.value)}>{OUTPUTS.map(o => <option key={o} value={o}>{metricLabel(o, lang)}</option>)}</select></label>
        <button type="button" className="of-cta" onClick={compute}>{t(UI.runSweep, lang)}</button>
        {busy && <button type="button" className="of-revert" onClick={cancel}>{t(UI.cancel, lang)}</button>}
        {progress && <span className="of-progress" role="status">{`${progress[0]} / ${progress[1]} ${TEXT.progress[lang]}`}</span>}
      </div>
      <div className="of-stage">{body}</div>
    </div>
  );
}
