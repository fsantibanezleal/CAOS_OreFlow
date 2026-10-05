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
import { gridValues, type SweepCell } from '../../engine/sweep';
import type { CaseArtifact, OptimizationRecord } from '../../lib/artifacts.types';
import { formatFixed, formatValue, formatWithUnit, sharedDecimals, unitLabel, type Lang } from '../../lib/format';
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
  hint: { en: 'Choose inputs and a metric, then compute. The sweep runs in the background and the page stays responsive.', es: 'Elija entradas y una métrica, y calcule. El barrido corre en segundo plano y la página sigue respondiendo.' },
  progress: { en: 'states', es: 'estados' },
  changed: { en: 'The state changed since the last sweep, so its results were cleared; compute again.', es: 'El estado cambió desde el último barrido, así que sus resultados se borraron; calcule de nuevo.' },
  optimizerRecord: { en: 'optimizer record', es: 'registro del optimizador' },
};

const linspace = gridValues;

/** U-13: the grid count near `around` whose step has the fewest significant digits, so the ticks read round and both
 * bounds stay on the grid (75 to 300 in steps of 25, 0 to 75 in steps of 7.5). A display choice, not an engine one. */
function roundCount(lo: number, hi: number, around: number): number {
  const digits = (step: number) => {
    for (let d = 0; d <= 6; d += 1) {
      const scaled = step / 10 ** (Math.floor(Math.log10(step)) - d); // not-engine: the significant digits of a tick step
      if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return d + 1;
    }
    return 8;
  };
  let best = around;
  let score = Infinity;
  for (let n = around - 3; n <= around + 4; n += 1) {
    if (n < 3 || hi <= lo) continue;
    const s = digits((hi - lo) / (n - 1)) * 10 + Math.abs(n - around);
    if (s < score) { score = s; best = n; }
  }
  return best;
}

/** U-13: an axis label with its unit, without doubling the parentheses of a label that already has them. */
export const withUnit = (text: string, unit: string) => (text.trim().endsWith(')') ? `${text}, ${unit}` : `${text} (${unit})`);

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
  // U-01: a sweep belongs to the state it ran at; when the point or the variant moves, it is stopped and cleared
  const stateKey = JSON.stringify(point);
  const [changed, setChanged] = useState(false);
  const ranAt = useRef<{ key: string; optimization: OptimizationRecord } | null>(null);
  useEffect(() => {
    const at = ranAt.current;
    if (!at || (at.key === stateKey && at.optimization === optimization)) return;
    if (running.current !== null) { cancelSweep(running.current); running.current = null; setBusy(false); }
    ranAt.current = null;
    setCells([]);
    setProgress(null);
    setChanged(true);
  }, [stateKey, optimization]);

  const axes = useMemo(() => {
    const axis = (name: string, n: number) => {
      const { min, max } = entry.inputs[name];
      return { input: name, values: linspace(min, max, declared[name].integer ? n : roundCount(min, max, n), declared[name].integer) };
    };
    return yInput ? [axis(xInput, 9), axis(yInput, 9)] : [axis(xInput, 17)];
  }, [xInput, yInput, entry, declared]);

  const compute = () => {
    if (running.current !== null) cancelSweep(running.current);
    setCells([]);
    setChanged(false);
    ranAt.current = { key: stateKey, optimization };
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
  const label = (name: string) => withUnit(declared[name].label[lang], unitLabel(unitOf(name)) || '-');
  const metricUnit = metric === 'concentrate_grade' ? entry.primary.unit : ({ recovery_pct: '%', recovered_primary_tph: 't/h', specific_energy_total_kwh_t: 'kWh/t', mill_power_kw: 'kW', p80_um: 'um', water_intensity_m3_t: 'm3/t' } as Record<string, string>)[metric];
  const optimum = variantOpt.optimum?.decisions ?? {};
  // U-13: the optimizer's decision is marked only on a surface that holds its other decisions; elsewhere it belongs
  // to another state
  const matches = (onAxes: string[]) => Object.entries(optimum).every(([name, value]) => onAxes.includes(name)
    || Math.abs((point[name as keyof OperatingPoint] as number) - value) <= 1e-6 * Math.max(1, Math.abs(value)));

  let body: React.ReactNode = <p className="of-hint">{changed ? TEXT.changed[lang] : TEXT.hint[lang]}</p>;
  if (cells.length > 0 && axes.length === 1) {
    const xs = axes[0].values;
    const ys = xs.map((_, i) => { const c = cells.find(cc => cc.index[0] === i); return c && c.accepted ? c.metrics[metric] ?? null : null; });
    body = (
      <Chart data={[xs, ys] as uPlot.AlignedData} xLabel={label(xInput)} title={`${metricLabel(metric, lang)} ${lang === 'es' ? 'contra' : 'against'} ${declared[xInput].label[lang]}`} yLabel={withUnit(metricLabel(metric, lang), unitLabel(metricUnit))}
        series={[{ label: metricLabel(metric, lang), colour: 'accent', points: false }]}
        summary={`${metricLabel(metric, lang)} ${lang === 'es' ? 'contra' : 'against'} ${declared[xInput].label[lang]}`}
        marks={[{ x: point[xInput as keyof OperatingPoint], label: TEXT.current[lang] }, ...(xInput in optimum && matches([xInput]) ? [{ x: optimum[xInput], label: TEXT.optimizerRecord[lang] }] : [])]}
        format={(v, axis) => (axis === 'x' ? formatValue(v, unitOf(xInput), lang) : formatValue(v, metricUnit, lang))}
        onCursor={reading => onCursor(reading ? `${formatWithUnit(reading.x, unitOf(xInput), lang)}: ${formatWithUnit(reading.values[0], metricUnit, lang)}` : null)} />
    );
  } else if (cells.length > 0) {
    const [ax, ay] = axes;
    // one precision per heatmap axis, from its grid step, so its ticks read alike (0.0 to 75.0, not 0.00
    // beside 18.8; 75 to 300, not 75.0 beside 131); a log10 of a display step, not an engine quantity
    const stepDecimals = (values: number[]) => Math.max(0, 1 - Math.floor(Math.log10(Math.abs(values[1] - values[0]) || 1)));
    const [xd, yd] = [stepDecimals(ax.values), stepDecimals(ay.values)];
    const grid = (fn: (c: SweepCell) => number | null) => ay.values.map((_, j) => ax.values.map((_, i) => {
      const c = cells.find(cc => cc.index[0] === i && cc.index[1] === j);
      return c && c.accepted ? fn(c) : null;
    }));
    const z = grid(c => c.metrics[metric] ?? null);
    const zd = sharedDecimals(z.flat(), metricUnit);   // U-30: both ends of the colour scale at one precision
    const gradeSlack = grid(c => c.metrics.concentrate_grade - variantOpt.constraints.grade.minimum);
    const powerSlack = grid(c => c.metrics.installed_mill_power_kw - c.metrics.required_mill_power_kw);
    const points = [{ x: point[xInput as keyof OperatingPoint], y: point[yInput as keyof OperatingPoint], label: TEXT.current[lang] },
      ...(xInput in optimum && yInput in optimum && matches([xInput, yInput]) ? [{ x: optimum[xInput], y: optimum[yInput], label: TEXT.optimizerRecord[lang] }] : [])];
    body = (
      <Heatmap title={`${metricLabel(metric, lang)} ${lang === 'es' ? 'sobre' : 'over'} ${declared[xInput].label[lang]} ${lang === 'es' ? 'y' : 'and'} ${declared[yInput].label[lang]}`} xs={ax.values} ys={ay.values} z={z} xLabel={label(xInput)} yLabel={label(yInput)} zLabel={withUnit(metricLabel(metric, lang), unitLabel(metricUnit))}
        summary={`${metricLabel(metric, lang)} ${lang === 'es' ? 'sobre' : 'over'} ${declared[xInput].label[lang]} ${lang === 'es' ? 'y' : 'and'} ${declared[yInput].label[lang]}`}
        contours={[{ field: gradeSlack, label: TEXT.grade[lang], colour: '--color-fg' }, { field: powerSlack, label: TEXT.power[lang], colour: '--color-bad' }]}
        points={points}
        format={(v, axis) => (axis === 'x' ? formatFixed(v, lang, xd) : axis === 'y' ? formatFixed(v, lang, yd) : formatFixed(v, lang, zd))}
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
