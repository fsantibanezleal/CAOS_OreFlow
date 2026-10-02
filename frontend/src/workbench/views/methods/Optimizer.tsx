/**
 * The optimizer record of the variant (PE-27, OP-01 to OP-11): a pattern search with a progressive barrier from
 * six starts over the case's decisions, maximizing a weighted objective of recovered metal against specific energy
 * subject to the grade specification, the installed mill power and the plant's process-water capacity, with the
 * learned lane screening its search step. The chart shows one of four things, chosen beside it: where every start
 * ended, the incumbent's path over the engine evaluations, the optimum as the weight moves toward energy, or the
 * surrogate's recovery against the engine's at each candidate the screen proposed. The tables give the base and the
 * optimum (re-simulated from scratch) with their slacks and active constraints, and the screen's work per start with
 * the evaluations the same starts spend without it. The baked record is shown until the user runs the optimizer at
 * another weight (OP-09): the optimizer's own worker then runs it at the current state, with its progress, and the
 * live record replaces the baked one until the user returns to it. Nothing runs without the button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type uPlot from 'uplot';
import { cancelOptimize, optimizeInWorker } from '../../../engine/client';
import { validateControl, type OperatingContract } from '../../../engine/contract';
import type { OperatingPoint, Ore, Plant } from '../../../engine/model';
import type { OptimizationRecord, OptimumSummary } from '../../../lib/artifacts.types';
import { formatFixed, formatRange, formatSignificant, formatValue, formatWithUnit, sharedDecimals, unitLabel, type Lang } from '../../../lib/format';
import { formulaText, metricLabel } from '../../../lib/i18n';
import { Chart } from '../../../components/charts/Chart';

type View = 'starts' | 'trace' | 'path' | 'screen';

const TEXT = {
  start: { en: 'Optimizer start', es: 'Inicio del optimizador' },
  recovered: { en: 'Recovered metal at the end point (t/h)', es: 'Metal recuperado en el punto final (t/h)' },
  feasible: { en: 'Feasible end point', es: 'Punto final factible' },
  infeasible: { en: 'Infeasible end point', es: 'Punto final infactible' },
  base: { en: 'base', es: 'base' },
  optimum: { en: 'optimum', es: 'óptimo' },
  summary: {
    en: 'Recovered metal where each optimizer start ended, feasible or not, against the base state and the optimum.',
    es: 'Metal recuperado donde terminó cada inicio del optimizador, factible o no, frente al estado base y al óptimo.',
  },
  quantity: { en: 'Quantity', es: 'Cantidad' },
  baseCol: { en: 'Base', es: 'Base' },
  optimumCol: { en: 'Optimum', es: 'Óptimo' },
  leastCol: { en: 'Least violating', es: 'Menor violación' },
  bounds: { en: 'Search range', es: 'Rango de búsqueda' },
  constraint: { en: 'Constraint', es: 'Restricción' },
  limit: { en: 'Limit', es: 'Límite' },
  slack: { en: 'Slack', es: 'Holgura' },
  active: { en: 'active', es: 'activa' },
  grade: { en: 'Concentrate grade', es: 'Ley del concentrado' },
  power: { en: 'Required mill power', es: 'Potencia requerida del molino' },
  water: { en: 'Process water per tonne', es: 'Agua de proceso por tonelada' },
  atLeast: { en: 'at least', es: 'al menos' },
  atMost: { en: 'at most', es: 'como máximo' },
  optimal: { en: 'Optimum found', es: 'Óptimo encontrado' },
  weightNote: {
    en: 'With part of the weight on energy, the optimum gives up recovered metal for lower energy per tonne. The weight is a modelling choice, not a price, so this point is not advice.',
    es: 'Con parte del peso en la energía, el óptimo cede metal recuperado a cambio de menos energía por tonelada. El peso es una elección de modelo, no un precio, así que este punto no es una recomendación.',
  },
  noFeasible: { en: 'No start reached a state within every constraint; the least-violating end point is shown.', es: 'Ningún inicio alcanzó un estado dentro de todas las restricciones; se muestra el punto final de menor violación.' },
  gain: { en: 'of recovered metal', es: 'de metal recuperado' },
  evaluations: { en: 'engine evaluations', es: 'evaluaciones del motor' },
  starts: { en: 'starts', es: 'inicios' },
  baked: { en: 'Baked for the variant state; the controls have changed since.', es: 'Calculado para el estado de la variante; los controles cambiaron desde entonces.' },
  first: { en: 'the variant state', es: 'el estado de la variante' },
  title: { en: 'Where each optimizer start ended', es: 'Dónde terminó cada inicio del optimizador' },
  chart: { en: 'Chart', es: 'Gráfico' },
  views: {
    starts: { en: 'Where each start ended', es: 'Dónde terminó cada inicio' },
    trace: { en: 'The incumbent over the evaluations', es: 'El incumbente según las evaluaciones' },
    path: { en: 'The optimum as the weight moves', es: 'El óptimo según el peso' },
    screen: { en: 'Surrogate against engine', es: 'Sustituto frente al motor' },
  } as Record<View, { en: string; es: string }>,
  objective: { en: 'Objective of the feasible incumbent (1 at the base when all weight is on metal)', es: 'Objetivo del incumbente factible (1 en la base con todo el peso en el metal)' },
  barrier: { en: 'Barrier: the largest constraint violation a trial point may carry', es: 'Barrera: la mayor violación de restricciones que puede tener un punto de prueba' },
  engineEvaluations: { en: 'Engine evaluations', es: 'Evaluaciones del motor' },
  incumbent: { en: 'Feasible incumbent', es: 'Incumbente factible' },
  infeasibleIncumbent: { en: 'Barrier', es: 'Barrera' },
  traceTitle: { en: 'The best start\'s incumbent, evaluation by evaluation', es: 'El incumbente del mejor inicio, evaluación por evaluación' },
  traceSummary: { en: 'The objective of the best start\'s feasible incumbent against the engine evaluations it had spent.', es: 'El objetivo del incumbente factible del mejor inicio frente a las evaluaciones del motor que llevaba.' },
  weightAxis: { en: 'Weight on recovered metal (%)', es: 'Peso del metal recuperado (%)' },
  change: { en: 'Change from the base state (%)', es: 'Cambio respecto del estado base (%)' },
  metalChange: { en: 'Recovered metal', es: 'Metal recuperado' },
  energyChange: { en: 'Specific energy', es: 'Energía específica' },
  pathTitle: { en: 'The optimum as weight moves from metal to energy', es: 'El óptimo al pasar el peso del metal a la energía' },
  pathSummary: { en: 'Recovered metal and specific energy at the optimum of each weight, as changes from the base state.', es: 'Metal recuperado y energía específica en el óptimo de cada peso, como cambios respecto del estado base.' },
  engineRecovery: { en: 'Engine recovery at the candidate (%)', es: 'Recuperación del motor en el candidato (%)' },
  surrogateRecovery: { en: 'Surrogate recovery (%)', es: 'Recuperación del sustituto (%)' },
  surrogate: { en: 'Surrogate prediction', es: 'Predicción del sustituto' },
  identity: { en: 'Equal to the engine', es: 'Igual al motor' },
  screenTitle: { en: 'The screen\'s proposals: surrogate against engine', es: 'Las propuestas del filtro: sustituto frente al motor' },
  screenSummary: { en: 'The surrogate\'s recovery against the engine\'s at every candidate the screen proposed to the engine.', es: 'La recuperación del sustituto frente a la del motor en cada candidato que el filtro propuso al motor.' },
  noProposals: { en: 'The screen proposed no candidate: every one it saw was outside the guard or the interval bound.', es: 'El filtro no propuso candidatos: todos los que vio estaban fuera del guardia o de la cota del intervalo.' },
  unscreened: { en: 'This record ran without the screen.', es: 'Este registro corrió sin el filtro.' },
  screenCol: { en: 'Start', es: 'Inicio' },
  withCol: { en: 'Evaluations', es: 'Evaluaciones' },
  withoutCol: { en: 'Without the screen', es: 'Sin el filtro' },
  proposedCol: { en: 'Proposed', es: 'Propuestos' },
  improvedCol: { en: 'Improved', es: 'Mejoraron' },
  total: { en: 'All starts', es: 'Todos los inicios' },
  rejected: { en: 'rejected by the guard', es: 'rechazados por el guardia' },
  interval: { en: 'by the interval bound', es: 'por la cota del intervalo' },
  screened: { en: 'candidates screened', es: 'candidatos filtrados' },
  disagreement: { en: 'mean absolute surrogate error on recovery at the proposals', es: 'error absoluto medio del sustituto en la recuperación en las propuestas' },
  rerun: { en: 'Re-run the optimizer', es: 'Volver a correr el optimizador' },
  run: { en: 'Run', es: 'Correr' },
  cancel: { en: 'Cancel', es: 'Cancelar' },
  running: { en: 'Pattern-search runs', es: 'Corridas de la búsqueda por patrones' },
  live: { en: 'Live record at the current state', es: 'Registro en vivo en el estado actual' },
  showBaked: { en: 'Show the baked record', es: 'Mostrar el registro horneado' },
  failed: { en: 'The run failed', es: 'La corrida falló' },
  weight: { en: 'weight on recovered metal', es: 'peso del metal recuperado' },
  method: { en: 'pattern search with a progressive barrier', es: 'búsqueda por patrones con barrera progresiva' },
  atBound: { en: 'at its bound', es: 'en su cota' },
  costNote: {
    en: 'The objective weighs recovered metal against grinding energy only: collector and air cost nothing in it, so an optimum can sit at their upper bounds.',
    es: 'El objetivo pondera el metal recuperado contra la energía de molienda solamente: el colector y el aire no cuestan nada en él, así que un óptimo puede quedar en sus cotas superiores.',
  },
};

const RESULTS: Array<{ key: keyof OptimumSummary | 'grade' | 'required_power_kw' | 'water_m3_t' | 'energy_kwh_t'; metric: string; unit?: string }> = [
  { key: 'recovered_tph', metric: 'recovered_primary_tph', unit: 't/h' },
  { key: 'recovery_pct', metric: 'recovery_pct', unit: '%' },
  { key: 'grade', metric: 'concentrate_grade' },
  { key: 'required_power_kw', metric: 'required_mill_power_kw', unit: 'kW' },
  { key: 'water_m3_t', metric: 'water_intensity_m3_t', unit: 'm3/t' },
  { key: 'energy_kwh_t', metric: 'specific_energy_total_kwh_t', unit: 'kWh/t' },
];


export function Optimizer({ record: baked, contract, caseId, ore, plant, point, modified, lang, onCursor }: {
  record: OptimizationRecord; contract: OperatingContract; caseId: string; ore: Ore; plant: Plant; point: OperatingPoint;
  modified: boolean; lang: Lang; onCursor: (text: string | null) => void;
}) {
  const control = contract.controls?.optimizer_weight_pct;
  const [weightPct, setWeightPct] = useState(Math.round(100 * baked.weights.recovered_metal));
  const [live, setLive] = useState<OptimizationRecord | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [view, setView] = useState<View>('starts');
  const runId = useRef(0);
  useEffect(() => () => { if (runId.current) cancelOptimize(runId.current); }, []);
  const verdict = control ? validateControl(contract, 'optimizer_weight_pct', weightPct) : null;
  const weightOptions = control ? Array.from({ length: (control.max - control.min) / control.step + 1 }, (_, i) => control.min + i * control.step) : [];
  const start = () => {
    if (!verdict?.accepted || verdict.value === null) return;
    if (runId.current) cancelOptimize(runId.current);
    setFailure(null);
    setProgress({ done: 0, total: 1 });
    const { id, done } = optimizeInWorker(caseId, ore, plant, point, contract, verdict.value / 100, (d, total) => setProgress({ done: d, total }));
    runId.current = id;
    done.then(result => { if (runId.current === id) { setLive(result); setProgress(null); runId.current = 0; } },
      (error: Error) => { if (runId.current === id) { setProgress(null); runId.current = 0; if (error.message !== 'cancelled') setFailure(error.message); } });
  };
  const stop = () => { if (runId.current) { cancelOptimize(runId.current); runId.current = 0; } setProgress(null); };

  const record = live ?? baked;
  const entry = contract.cases[caseId];
  const declared = Object.fromEntries(contract.inputs.map(spec => [spec.name, spec]));
  const gradeUnit = entry.primary.unit;
  // U-05: a gold plant recovers kilograms an hour, so its metal reads in kg/h, not as 0.0009 t/h
  const metalUnit = gradeUnit === 'g/t' ? 'kg/h' : 't/h';
  const metal = (v: number | null | undefined) => (v == null ? v : gradeUnit === 'g/t' ? 1000 * v : v);
  const unitOf = (name: string) => (declared[name].unit === 'case' ? gradeUnit : declared[name].unit);
  const outcome = record.optimum ?? record.least_violating ?? null;
  const starts = record.starts;
  const w = record.weights.recovered_metal;
  const value = (summary: OptimumSummary | null, key: (typeof RESULTS)[number]['key']): number | null => {
    if (!summary) return null;
    if (key === 'grade' || key === 'required_power_kw' || key === 'water_m3_t' || key === 'energy_kwh_t') return summary.values[key] ?? null;
    return summary[key] as number;
  };
  const decisionText = (decisions: Record<string, number>) =>
    record.decisions.map(n => `${declared[n].label[lang]} ${formatWithUnit(decisions[n], unitOf(n), lang)}`).join(', ');

  const proposals = useMemo(() => {
    if (!record.proposal_columns) return [];
    const c = record.proposal_columns;
    return record.starts.flatMap(s => (s.screen?.proposals ?? []).map(row => ({
      surrogate: row[c.indexOf('surrogate_recovery_pct')] as number, engine: row[c.indexOf('engine_recovery_pct')] as number | null,
    }))).filter(p => p.engine !== null) as Array<{ surrogate: number; engine: number }>;
  }, [record]);

  const chart = (() => {
    if (view === 'trace' && record.trace) {
      const rows = record.trace;
      const feasible = rows.some(r => r[3] !== null);
      const xs = rows.map(r => r[4]);
      const ys = rows.map(r => (feasible ? r[3] : r[2]));
      const base = 2 * w - 1;
      return (
        <Chart data={[xs, ys] as uPlot.AlignedData} xLabel={TEXT.engineEvaluations[lang]} yLabel={feasible ? TEXT.objective[lang] : TEXT.barrier[lang]}
          title={TEXT.traceTitle[lang]} logY={!feasible}
          series={[{ label: feasible ? TEXT.incumbent[lang] : TEXT.infeasibleIncumbent[lang], colour: feasible ? 'good' : 'bad', points: true }]}
          levels={feasible && record.base.feasible ? [{ y: base, label: TEXT.base[lang] }] : undefined}
          summary={TEXT.traceSummary[lang]} format={(v, axis) => (axis === 'x' ? String(v) : formatSignificant(v ?? Number.NaN, lang, 5))}
          onCursor={reading => onCursor(reading ? `${reading.x} ${TEXT.evaluations[lang]}: ${formatSignificant(reading.values[0] ?? Number.NaN, lang, 6)}` : null)} />
      );
    }
    if (view === 'path' && record.path && record.optimum) {
      const baseM = record.base.recovered_tph;
      const baseE = record.base.values.energy_kwh_t;
      const points = [{ weight: w, m: record.optimum.recovered_tph, e: record.optimum.values.energy_kwh_t },
        ...record.path.filter(s => s.status === 'optimal').map(s => ({ weight: s.weight, m: s.recovered_tph, e: s.energy_kwh_t ?? Number.NaN }))]
        .filter((p, i, all) => all.findIndex(q => q.weight === p.weight) === i).sort((a, b) => a.weight - b.weight);
      const xs = points.map(p => 100 * p.weight);
      return (
        <Chart data={[xs, points.map(p => 100 * (p.m / baseM - 1)), points.map(p => 100 * (p.e / baseE - 1))] as uPlot.AlignedData}
          xLabel={TEXT.weightAxis[lang]} yLabel={TEXT.change[lang]} title={TEXT.pathTitle[lang]} levels={[{ y: 0, label: TEXT.base[lang] }]}
          series={[{ label: TEXT.metalChange[lang], colour: 'accent', points: true }, { label: TEXT.energyChange[lang], colour: 'warn', points: true }]}
          summary={TEXT.pathSummary[lang]} format={(v, axis) => (axis === 'x' ? `${v}%` : `${formatSignificant(v ?? Number.NaN, lang, 3)}%`)}
          onCursor={reading => {
            if (!reading) { onCursor(null); return; }
            const p = points[reading.index];
            onCursor(`${Math.round(100 * p.weight)}% ${TEXT.weight[lang]}: ${formatWithUnit(metal(p.m), metalUnit, lang)}, ${formatWithUnit(p.e, 'kWh/t', lang)}`);
          }} />
      );
    }
    if (view === 'screen' && proposals.length) {
      const sorted = [...proposals].sort((a, b) => a.engine - b.engine);
      const xs = sorted.map(p => p.engine);
      return (
        <Chart data={[xs, sorted.map(p => p.surrogate), xs] as uPlot.AlignedData} xLabel={TEXT.engineRecovery[lang]} yLabel={TEXT.surrogateRecovery[lang]}
          title={TEXT.screenTitle[lang]}
          series={[{ label: TEXT.surrogate[lang], colour: 'accent', points: true }, { label: TEXT.identity[lang], colour: 'subtle', dash: [4, 4] }]}
          summary={TEXT.screenSummary[lang]} format={v => formatSignificant(v ?? Number.NaN, lang, 4)}
          onCursor={reading => onCursor(reading ? `${TEXT.engineRecovery[lang]} ${formatSignificant(reading.x, lang, 4)}; ${TEXT.surrogateRecovery[lang]} ${formatSignificant(reading.values[0] ?? Number.NaN, lang, 4)}` : null)} />
      );
    }
    const xs = starts.map((_, i) => i);
    const reached = starts.map(s => metal(s.end.recovered_tph) as number);
    const baseMetal = metal(record.base.recovered_tph) as number;
    // the axis spans the base and every end point: starts that agree to round-off must read as one point
    const lo = Math.min(baseMetal, ...reached);
    const hi = Math.max(baseMetal, ...reached);
    const pad = Math.max(0.15 * (hi - lo), 0.002 * Math.abs(hi), 1e-9);
    const levels = [{ y: baseMetal, label: TEXT.base[lang] }, ...(record.optimum ? [{ y: metal(record.optimum.recovered_tph) as number, label: TEXT.optimum[lang] }] : [])];
    return (
      <Chart data={[xs, starts.map((s, i) => (s.end.feasible ? reached[i] : null)), starts.map((s, i) => (s.end.feasible ? null : reached[i]))] as uPlot.AlignedData}
        categories={starts.map((_, i) => String(i + 1))} xLabel={TEXT.start[lang]} yLabel={TEXT.recovered[lang].replace('t/h', metalUnit)} levels={levels} title={TEXT.title[lang]} yRange={[lo - pad, hi + pad]}
        series={[{ label: TEXT.feasible[lang], colour: 'good', points: true }, { label: TEXT.infeasible[lang], colour: 'bad', points: true }]}
        summary={TEXT.summary[lang]} format={(v, axis) => (axis === 'x' ? String(v) : formatWithUnit(v, metalUnit, lang))}
        onCursor={reading => {
          if (!reading) { onCursor(null); return; }
          const run = starts[reading.index];
          onCursor(`${TEXT.start[lang]} ${reading.index + 1}${reading.index === 0 ? ` (${TEXT.first[lang]})` : ''}: ${decisionText(run.end.decisions)}; `
            + `${formatWithUnit(metal(run.end.recovered_tph), metalUnit, lang)}, ${run.evaluations} ${TEXT.evaluations[lang]}`);
        }} />
    );
  })();
  const shown: View = (view === 'trace' && record.trace) || (view === 'path' && record.path && record.optimum) || (view === 'screen' && proposals.length) ? view : 'starts';

  const constraints: Array<{ id: 'grade' | 'power' | 'water'; label: string; limit: string }> = [
    { id: 'grade', label: `${TEXT.grade[lang]} ${formulaText(record.constraints.grade.species)}`, limit: `${TEXT.atLeast[lang]} ${formatWithUnit(record.constraints.grade.minimum, gradeUnit, lang)}` },
    { id: 'power', label: TEXT.power[lang], limit: `${TEXT.atMost[lang]} ${formatWithUnit(record.constraints.power.maximum_kw, 'kW', lang)}` },
    ...(record.constraints.water ? [{ id: 'water' as const, label: TEXT.water[lang], limit: `${TEXT.atMost[lang]} ${formatWithUnit(record.constraints.water.maximum_m3_t, 'm3/t', lang)}` }] : []),
  ];
  const slackUnit = { grade: gradeUnit, power: 'kW', water: 'm3/t' };
  const status = record.optimum
    ? `${TEXT.optimal[lang]}: ${(record.gain_tph ?? 0) >= 0 ? '+' : ''}${formatFixed(metal(record.gain_tph ?? 0) as number, lang, 3)} ${unitLabel(metalUnit)} ${TEXT.gain[lang]}${record.gain_pct != null ? ` (${record.gain_pct >= 0 ? '+' : ''}${formatSignificant(record.gain_pct, lang, 3)}%)` : ''}`
    : TEXT.noFeasible[lang];
  const screenTotals = record.screened ? {
    screened: starts.reduce((s, r) => s + (r.screen?.screened ?? 0), 0), guard: starts.reduce((s, r) => s + (r.screen?.rejected.guard ?? 0), 0),
    interval: starts.reduce((s, r) => s + (r.screen?.rejected.interval ?? 0), 0), proposed: starts.reduce((s, r) => s + (r.screen?.proposed ?? 0), 0),
    improved: starts.reduce((s, r) => s + (r.screen?.improved ?? 0), 0),
  } : null;
  const meanError = proposals.length ? proposals.reduce((s, p) => s + Math.abs(p.surrogate - p.engine), 0) / proposals.length : null;

  return (
    <div className="of-split">
      {chart}
      <div className="of-aside">
        {control && (
          <div className="of-rerun">
            <p className="of-facts-title">{TEXT.rerun[lang]}</p>
            <div className="of-fields">
              <label className="of-field"><span>{control.label[lang]}</span>
                <select value={weightPct} title={control.help[lang]} onChange={e => setWeightPct(Number(e.target.value))}>
                  {weightOptions.map(n => <option key={n} value={n}>{`${n}%`}</option>)}</select></label>
            </div>
            {verdict && !verdict.accepted && <p className="of-note">{contract.messages[verdict.errors[0].code]?.[lang] ?? verdict.errors[0].code}</p>}
            <div className="of-actions">
              <button type="button" className="of-run" onClick={start} disabled={!verdict?.accepted || progress !== null}>{TEXT.run[lang]}</button>
              {progress && <button type="button" className="of-revert" onClick={stop}>{TEXT.cancel[lang]}</button>}
              {progress && <span className="of-progress">{`${TEXT.running[lang]}: ${progress.done} / ${progress.total}`}</span>}
            </div>
            {failure && <p className="of-note">{`${TEXT.failed[lang]}: ${failure}`}</p>}
            {live && <div className="of-actions">
              <p className="of-status-line neutral">{`${TEXT.live[lang]}: ${Math.round(100 * live.weights.recovered_metal)}% ${TEXT.weight[lang]}`}</p>
              <button type="button" className="of-revert" onClick={() => setLive(null)}>{TEXT.showBaked[lang]}</button></div>}
          </div>
        )}
        {modified && !live && <p className="of-note">{TEXT.baked[lang]}</p>}
        <div className="of-fields">
          <label className="of-field"><span>{TEXT.chart[lang]}</span>
            <select value={shown} onChange={e => setView(e.target.value as View)}>
              {(['starts', 'trace', 'path', 'screen'] as View[]).map(v => <option key={v} value={v}>{TEXT.views[v][lang]}</option>)}</select></label>
        </div>
        {view === 'screen' && !proposals.length && <p className="of-note">{record.screened ? TEXT.noProposals[lang] : TEXT.unscreened[lang]}</p>}
        {/* a gain is good news; a loss at a partial weight is a trade the weight asked for, shown neutral, never green */}
        {/* U-35: while a re-run is on its way, the previous record's status is not shown under its progress */}
        {progress === null && <p className={!record.optimum ? 'of-status-line warn' : (record.gain_tph ?? 0) < 0 ? 'of-status-line neutral' : 'of-status-line'}>{status}</p>}
        {record.optimum && record.weights.recovered_metal < 1 && <p className="of-note">{TEXT.weightNote[lang]}</p>}
        <table className="of-table">
          <thead><tr><th scope="col">{TEXT.quantity[lang]}</th><th scope="col">{TEXT.baseCol[lang]}</th>
            <th scope="col">{record.optimum ? TEXT.optimumCol[lang] : TEXT.leastCol[lang]}</th><th scope="col">{TEXT.bounds[lang]}</th></tr></thead>
          <tbody>
            {record.decisions.map(n => {
              // U-04: a decision within one contract step of its bound is the search box's corner, and says so
              const [low, high] = record.bounds[n];
              const step = contract.cases[caseId]?.inputs[n]?.step ?? 0.005 * (high - low);
              const d = outcome?.decisions[n];
              const atBound = record.optimum !== null && d !== undefined && (Math.abs(d - low) <= step || Math.abs(high - d) <= step);
              // U-30: a row's base, result and bounds at one precision
              const rd = sharedDecimals([record.base.decisions[n], d, low, high], unitOf(n));
              return (
              <tr key={n}><th scope="row">{`${declared[n].label[lang]} (${unitLabel(unitOf(n)) || '-'})`}</th>
                <td>{formatFixed(record.base.decisions[n], lang, rd)}</td>
                <td>{formatFixed(d, lang, rd)}{atBound ? <span className="of-tag">{TEXT.atBound[lang]}</span> : null}</td>
                <td>{formatRange(low, high, unitOf(n), lang, false)}</td></tr>
              );
            })}
            {RESULTS.map(row => {
              // U-05, U-30: recovered metal in the plant's own unit, to the resolution the status line quotes
              const isMetal = row.key === 'recovered_tph';
              const unit = isMetal ? metalUnit : row.unit ?? gradeUnit;
              const rd = sharedDecimals([value(record.base, row.key), value(outcome, row.key)], unit);
              const show = (v: number | null | undefined) => (isMetal ? (v == null ? formatValue(v, unit, lang) : formatFixed(metal(v) as number, lang, 3)) : formatFixed(v, lang, rd));
              return (
                <tr key={row.metric} className="of-table-group"><th scope="row">{`${metricLabel(row.metric, lang)} (${unitLabel(unit)})`}</th>
                  <td>{show(value(record.base, row.key))}</td>
                  <td>{show(value(outcome, row.key))}</td><td /></tr>
              );
            })}
          </tbody>
        </table>
        <table className="of-table">
          <thead><tr><th scope="col">{TEXT.constraint[lang]}</th><th scope="col">{TEXT.limit[lang]}</th><th scope="col">{TEXT.slack[lang]}</th></tr></thead>
          <tbody>
            {constraints.map(c => {
              const slack = outcome?.slacks[c.id];
              const active = outcome?.active.includes(c.id);
              return (
                <tr key={c.id}><th scope="row">{c.label}</th><td>{c.limit}</td>
                  <td>{formatWithUnit(slack, slackUnit[c.id], lang)}{active ? <span className="of-tag">{TEXT.active[lang]}</span> : null}</td></tr>
              );
            })}
          </tbody>
        </table>
        {record.screened && record.without_screen && (
          <table className="of-table of-table-data">
            <thead><tr><th scope="col">{TEXT.screenCol[lang]}</th><th scope="col">{TEXT.withCol[lang]}</th><th scope="col">{TEXT.withoutCol[lang]}</th>
              <th scope="col">{TEXT.proposedCol[lang]}</th><th scope="col">{TEXT.improvedCol[lang]}</th></tr></thead>
            <tbody>
              {starts.map((s, i) => (
                <tr key={i}><th scope="row">{i + 1}</th><td>{s.evaluations}</td><td>{record.without_screen!.starts[i]}</td>
                  <td>{s.screen?.proposed ?? 0}</td><td>{s.screen?.improved ?? 0}</td></tr>
              ))}
              <tr className="of-table-group"><th scope="row">{TEXT.total[lang]}</th><td>{record.evaluations}</td><td>{record.without_screen.evaluations}</td>
                <td>{screenTotals!.proposed}</td><td>{screenTotals!.improved}</td></tr>
            </tbody>
          </table>
        )}
        <p className="of-footnote">
          {`${starts.length} ${TEXT.starts[lang]}, ${record.evaluations} ${TEXT.evaluations[lang]} (${TEXT.method[lang]}), ${Math.round(100 * w)}% ${TEXT.weight[lang]}`}
          {screenTotals && `; ${screenTotals.screened} ${TEXT.screened[lang]}, ${screenTotals.guard} ${TEXT.rejected[lang]} ${lang === 'es' ? 'y' : 'and'} ${screenTotals.interval} ${TEXT.interval[lang]} (${formatSignificant(record.screen_bound_pct ?? 0, lang, 2)} ${lang === 'es' ? 'puntos' : 'points'})`}
          {meanError !== null && `; ${TEXT.disagreement[lang]}: ${formatSignificant(meanError, lang, 3)} ${lang === 'es' ? 'puntos' : 'points'}`}
          {'.'}
        </p>
        {record.path && <p className="of-footnote">{record.path.map(s => `${Math.round(100 * s.weight)}%: ${s.status === 'optimal' ? formatWithUnit(metal(s.recovered_tph), metalUnit, lang) : TEXT.infeasible[lang]}`).join('; ')}</p>}
        {record.optimum && <p className="of-footnote">{TEXT.costNote[lang]}</p>}
      </div>
    </div>
  );
}
