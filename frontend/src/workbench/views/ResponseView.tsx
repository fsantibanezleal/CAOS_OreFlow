/**
 * Response view (PE-38): a metric against one contract input, or over two inputs as a decision surface,
 * computed in the Web Worker only when the user asks. States the contract rejects are shown as such and
 * never simulated. The surface carries the grade-specification and installed-power boundaries (their
 * limits come from the variant's optimization record) and marks the current state and the baked optimum.
 */
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type uPlot from 'uplot';
import { cancelSweep, sweepInWorker } from '../../engine/client';
import type { OperatingContract } from '../../engine/contract';
import type { OperatingPoint } from '../../engine/model';
import { gridValues, type SweepCell } from '../../engine/sweep';
import type { CaseArtifact, OptimizationRecord } from '../../lib/artifacts.types';
import { formatFixed, formatValue, formatWithUnit, sharedDecimals, unitLabel, type Lang } from '../../lib/format';
import { metricLabel, t, UI } from '../../lib/i18n';
import { OverlayInset } from '../../components/charts/inset';
import { Chart } from '../../components/charts/Chart';
import { gridSlice } from '../../components/charts/navigation';
import { Heatmap, type HeatmapSelection } from '../../components/charts/Heatmap';

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
  const overlay = useContext(OverlayInset);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  // Focus HUD is below the stage on a phone, rather than in the desktop's left strip.
  const inset = overlay[0] && narrow ? [0, overlay[1], 0, 0] : overlay;
  const entry = contract.cases[artifact.case_id];
  const names = Object.keys(entry.inputs);
  const declared = Object.fromEntries(contract.inputs.map(s => [s.name, s]));
  const [xInput, setX] = useState(names.includes('target_p80_um') ? 'target_p80_um' : names[0]);
  const [yInput, setY] = useState<string>(names.includes('collector_gpt') ? 'collector_gpt' : '');
  const compatibleAxes = names.includes(xInput) && (!yInput || (names.includes(yInput) && yInput !== xInput));
  const [metric, setMetric] = useState('recovery_pct');
  const [cells, setCells] = useState<SweepCell[]>([]);
  const [inspection, setInspection] = useState<{ key: string; selection: HeatmapSelection } | null>(null);
  const [sliceAxis, setSliceAxis] = useState<'x' | 'y'>('x');
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef<number | null>(null);
  const variantOpt = optimization;

  useEffect(() => () => { if (running.current !== null) cancelSweep(running.current); }, []);
  useEffect(() => {
    if (running.current !== null) { cancelSweep(running.current); running.current = null; setBusy(false); }
    setCells([]); setProgress(null); setInspection(null); onCursor(null);
    if (!names.includes(xInput)) setX(names.includes('target_p80_um') ? 'target_p80_um' : names[0]);
    if (yInput === xInput || (yInput && !names.includes(yInput))) setY('');
    // The view owns the callback only for readout; its identity does not invalidate a sweep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact.case_id, xInput, yInput]);
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
    setChanged(true); onCursor(null);
  }, [stateKey, optimization]);

  const axes = useMemo(() => {
    if (!compatibleAxes) return [];
    const axis = (name: string, n: number) => {
      const { min, max } = entry.inputs[name];
      return { input: name, values: linspace(min, max, declared[name].integer ? n : roundCount(min, max, n), declared[name].integer) };
    };
    return yInput ? [axis(xInput, 9), axis(yInput, 9)] : [axis(xInput, 17)];
  }, [xInput, yInput, entry, declared, compatibleAxes]);

  const compute = () => {
    if (!compatibleAxes) return;
    setInspection(null); onCursor(null);
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
    const finish = () => { if (running.current === handle.id) { running.current = null; setBusy(false); } };
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

  // The baked optimizer path is already an evaluated trade-off curve. Show it immediately so opening
  // Response always presents evidence; the control below then computes the selected live input sweep.
  const recordedPath = (optimization.path ?? []).filter(step => Number.isFinite(step.weight) && Number.isFinite(step.recovered_tph)).sort((a, b) => a.weight - b.weight);
  let body: React.ReactNode = !changed && recordedPath.length >= 2 ? (
    <Chart data={[recordedPath.map(step => step.weight), recordedPath.map(step => step.recovered_tph)] as uPlot.AlignedData}
      title={lang === 'es' ? 'Recuperación frente al peso del objetivo' : 'Recovered metal against objective weight'}
      xLabel={lang === 'es' ? 'Peso del metal recuperado' : 'Recovered-metal objective weight'}
      yLabel={lang === 'es' ? 'Metal recuperado (t/h)' : 'Recovered metal (t/h)'}
      series={[{ label: lang === 'es' ? 'Metal recuperado' : 'Recovered metal', colour: 'good' }]}
      summary={lang === 'es' ? 'Metal recuperado por el optimizador al cambiar el peso del objetivo; son resultados registrados, no una planta.' : 'Metal recovered by the optimizer as the objective weight changes; these are recorded model results, not plant data.'}
      format={(v, axis) => axis === 'x' ? formatFixed(v, lang, 2) : formatWithUnit(v, 't/h', lang)} />
  ) : <p className="of-hint">{changed ? TEXT.changed[lang] : TEXT.hint[lang]}</p>;
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
  } else if (cells.length > 0 && axes.length === 2) {
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
    const surfaceKey = JSON.stringify([artifact.case_id, stateKey, xInput, yInput, metric, z]);
    const selected = inspection?.key === surfaceKey ? inspection.selection : null;
    // A single cell selects its full row/column; a multi-cell brush crops the slice to that region.
    const region = selected && selected.region.i0 === selected.region.i1 && selected.region.j0 === selected.region.j1
      ? { i0: 0, i1: ax.values.length - 1, j0: 0, j1: ay.values.length - 1 } : selected?.region;
    const slice = selected && region ? gridSlice(ax.values, ay.values, z, region, [selected.cell.i, selected.cell.j], sliceAxis) : null;
    const varyingInput = sliceAxis === 'x' ? xInput : yInput;
    const fixedInput = sliceAxis === 'x' ? yInput : xInput;
    const fixedValue = selected ? (sliceAxis === 'x' ? selected.cell.y : selected.cell.x) : null;
    const fixedLabel = `${declared[fixedInput].label[lang]} = ${formatWithUnit(fixedValue, unitOf(fixedInput), lang)}`;
    const zd = sharedDecimals(z.flat(), metricUnit);   // U-30: both ends of the colour scale at one precision
    const gradeSlack = grid(c => c.metrics.concentrate_grade - variantOpt.constraints.grade.minimum);
    const powerSlack = grid(c => c.metrics.installed_mill_power_kw - c.metrics.required_mill_power_kw);
    const points = [{ x: point[xInput as keyof OperatingPoint], y: point[yInput as keyof OperatingPoint], label: TEXT.current[lang] },
      ...(xInput in optimum && yInput in optimum && matches([xInput, yInput]) ? [{ x: optimum[xInput], y: optimum[yInput], label: TEXT.optimizerRecord[lang] }] : [])];
    body = (
      <div className={`of-response-analysis${selected ? ' has-slice' : ''}`}>
      <Heatmap title={`${metricLabel(metric, lang)} ${lang === 'es' ? 'sobre' : 'over'} ${declared[xInput].label[lang]} ${lang === 'es' ? 'y' : 'and'} ${declared[yInput].label[lang]}`} xs={ax.values} ys={ay.values} z={z} xLabel={label(xInput)} yLabel={label(yInput)} zLabel={withUnit(metricLabel(metric, lang), unitLabel(metricUnit))}
        summary={`${metricLabel(metric, lang)} ${lang === 'es' ? 'sobre' : 'over'} ${declared[xInput].label[lang]} ${lang === 'es' ? 'y' : 'and'} ${declared[yInput].label[lang]}`}
        contours={[{ field: gradeSlack, label: TEXT.grade[lang], colour: '--color-fg' }, { field: powerSlack, label: TEXT.power[lang], colour: '--color-bad' }]}
        points={points}
        onSelection={selection => setInspection(selection ? { key: surfaceKey, selection } : null)}
        format={(v, axis) => (axis === 'x' ? formatFixed(v, lang, xd) : axis === 'y' ? formatFixed(v, lang, yd) : formatFixed(v, lang, zd))}
        onCell={cell => onCursor(cell ? `${declared[xInput].label[lang]} ${formatWithUnit(cell.x, unitOf(xInput), lang)}, ${declared[yInput].label[lang]} ${formatWithUnit(cell.y, unitOf(yInput), lang)}: ${cell.z === null ? t(UI.rejected, lang) : formatWithUnit(cell.z, metricUnit, lang)}` : null)} />
      {selected && slice && <OverlayInset.Provider value={[0, inset[1], inset[2], 0]}><section className="of-response-slice" aria-label={lang === 'es' ? 'Corte vinculado' : 'Linked slice'}
        data-slice-axis={sliceAxis} data-slice-fixed={fixedValue} data-slice-values={JSON.stringify(slice.values)} data-slice-coordinates={JSON.stringify(slice.coordinates)}>
        <div className="of-slice-head"><label className="of-slice-control">{lang === 'es' ? 'Corte vinculado' : 'Linked slice'} <select value={sliceAxis} onChange={e => setSliceAxis(e.target.value as 'x' | 'y')}>
          <option value="x">{lang === 'es' ? 'Fila (x)' : 'Row (x)'}</option><option value="y">{lang === 'es' ? 'Columna (y)' : 'Column (y)'}</option>
        </select></label>
        <p className="of-slice-source">{fixedLabel}<span className="of-sr-only">. {lang === 'es' ? 'Datos del barrido; los huecos son estados rechazados o no disponibles.' : 'Sweep data; gaps are rejected or unavailable states.'}</span></p></div>
        {slice.values.some(v => v !== null) ? <Chart data={[slice.coordinates, slice.values] as uPlot.AlignedData}
          xLabel={label(varyingInput)} yLabel={withUnit(metricLabel(metric, lang), unitLabel(metricUnit))}
          title={lang === 'es' ? 'Respuesta en el corte' : 'Response along slice'} summary={`${metricLabel(metric, lang)}; ${fixedLabel}`}
          series={[{ label: metricLabel(metric, lang), colour: 'accent', points: slice.coordinates.length === 1 }]}
          format={(v, axis) => axis === 'x' ? formatWithUnit(v, unitOf(varyingInput), lang) : v === null ? t(UI.rejected, lang) : formatWithUnit(v, metricUnit, lang)}
          onCursor={reading => onCursor(reading ? `${fixedLabel}; ${formatWithUnit(reading.x, unitOf(varyingInput), lang)}: ${reading.values[0] === null ? t(UI.rejected, lang) : formatWithUnit(reading.values[0], metricUnit, lang)}` : null)} />
          : <p className="of-hint" role="status">{lang === 'es' ? 'Este corte no contiene estados aceptados.' : 'This slice contains no accepted states.'}</p>}
      </section></OverlayInset.Provider>}
      </div>
    );
  }

  return (
    <div className={`of-view of-view-response${overlay[0] ? ' of-response-focus' : ''}`}>
      <div className="of-response-content">
      <div className="of-response-controls" role="group" style={{ paddingTop: inset[0], paddingLeft: inset[3], paddingRight: inset[1] }}>
        <label className="of-field"><span>{TEXT.x[lang]}</span>
          <select value={xInput} onChange={e => setX(e.target.value)}>{names.map(n => <option key={n} value={n}>{declared[n].label[lang]}</option>)}</select></label>
        <label className="of-field"><span>{TEXT.y[lang]}</span>
          <select value={yInput} onChange={e => setY(e.target.value)}><option value="">{TEXT.none[lang]}</option>{names.filter(n => n !== xInput).map(n => <option key={n} value={n}>{declared[n].label[lang]}</option>)}</select></label>
        <label className="of-field"><span>{TEXT.metric[lang]}</span>
          <select value={metric} onChange={e => setMetric(e.target.value)}>{OUTPUTS.map(o => <option key={o} value={o}>{metricLabel(o, lang)}</option>)}</select></label>
        <button type="button" className="of-cta" onClick={compute} disabled={!compatibleAxes}>{t(UI.runSweep, lang)}</button>
        {busy && <button type="button" className="of-revert" onClick={cancel}>{t(UI.cancel, lang)}</button>}
        {progress && <span className="of-progress" role="status">{`${progress[0]} / ${progress[1]} ${TEXT.progress[lang]}`}</span>}
      </div>
      <OverlayInset.Provider value={[0, inset[1], inset[2], inset[3]]}>
        <div className="of-stage" data-state={busy ? 'loading' : undefined}>{body}</div>
      </OverlayInset.Provider>
      </div>
    </div>
  );
}
