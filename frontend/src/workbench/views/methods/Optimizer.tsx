/**
 * The optimizer record of the variant (PE-27): COBYLA from six starts over the case's decisions,
 * maximizing recovered metal subject to the grade specification, the installed mill power and the
 * plant's process-water capacity. The chart shows where every start ended; the tables give the base
 * and the optimum (re-simulated from scratch by the bake) with their slacks and the active constraints.
 * Everything shown is the baked record; nothing is optimized in the browser.
 */
import type uPlot from 'uplot';
import type { OperatingContract } from '../../../engine/contract';
import type { OptimizationRecord, OptimumSummary } from '../../../lib/artifacts.types';
import { formatSignificant, formatValue, formatWithUnit, unitLabel, type Lang } from '../../../lib/format';
import { formulaText, metricLabel } from '../../../lib/i18n';
import { Chart } from '../../../components/charts/Chart';

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
  noFeasible: { en: 'No start reached a state within every constraint; the least-violating end point is shown.', es: 'Ningún inicio alcanzó un estado dentro de todas las restricciones; se muestra el punto final de menor violación.' },
  gain: { en: 'recovered metal', es: 'metal recuperado' },
  evaluations: { en: 'engine evaluations', es: 'evaluaciones del motor' },
  starts: { en: 'starts', es: 'inicios' },
  baked: { en: 'Baked for the variant state; the controls have changed since.', es: 'Calculado para el estado de la variante; los controles cambiaron desde entonces.' },
  first: { en: 'the variant state', es: 'el estado de la variante' },
  title: { en: 'Where each optimizer start ended', es: 'Dónde terminó cada inicio del optimizador' },
};

const RESULTS: Array<{ key: keyof OptimumSummary | 'grade' | 'required_power_kw' | 'water_m3_t'; metric: string; unit?: string }> = [
  { key: 'recovered_tph', metric: 'recovered_primary_tph', unit: 't/h' },
  { key: 'recovery_pct', metric: 'recovery_pct', unit: '%' },
  { key: 'grade', metric: 'concentrate_grade' },
  { key: 'required_power_kw', metric: 'required_mill_power_kw', unit: 'kW' },
  { key: 'water_m3_t', metric: 'water_intensity_m3_t', unit: 'm3/t' },
];

export function Optimizer({ record, contract, caseId, modified, lang, onCursor }: {
  record: OptimizationRecord; contract: OperatingContract; caseId: string; modified: boolean; lang: Lang;
  onCursor: (text: string | null) => void;
}) {
  const entry = contract.cases[caseId];
  const declared = Object.fromEntries(contract.inputs.map(spec => [spec.name, spec]));
  const gradeUnit = entry.primary.unit;
  const unitOf = (name: string) => (declared[name].unit === 'case' ? gradeUnit : declared[name].unit);
  const outcome = record.optimum ?? record.least_violating ?? null;
  const starts = record.starts;
  const xs = starts.map((_, i) => i);
  const feasible = starts.map(s => (s.end.feasible ? s.end.recovered_tph : null));
  const infeasible = starts.map(s => (s.end.feasible ? null : s.end.recovered_tph));
  // the axis spans the base and every end point: starts that agree to round-off must read as one point
  const reached = starts.map(s => s.end.recovered_tph);
  const lo = Math.min(record.base.recovered_tph, ...reached);
  const hi = Math.max(record.base.recovered_tph, ...reached);
  const pad = Math.max(0.15 * (hi - lo), 0.002 * Math.abs(hi), 1e-9);
  const yRange: [number, number] = [lo - pad, hi + pad];
  const levels = [{ y: record.base.recovered_tph, label: TEXT.base[lang] },
    ...(record.optimum ? [{ y: record.optimum.recovered_tph, label: TEXT.optimum[lang] }] : [])];
  const value = (summary: OptimumSummary | null, key: (typeof RESULTS)[number]['key']): number | null => {
    if (!summary) return null;
    if (key === 'grade' || key === 'required_power_kw' || key === 'water_m3_t') return summary.values[key] ?? null;
    return summary[key] as number;
  };
  const constraints: Array<{ id: 'grade' | 'power' | 'water'; label: string; limit: string }> = [
    { id: 'grade', label: `${TEXT.grade[lang]} ${formulaText(record.constraints.grade.species)}`, limit: `${TEXT.atLeast[lang]} ${formatWithUnit(record.constraints.grade.minimum, gradeUnit, lang)}` },
    { id: 'power', label: TEXT.power[lang], limit: `${TEXT.atMost[lang]} ${formatWithUnit(record.constraints.power.maximum_kw, 'kW', lang)}` },
    ...(record.constraints.water ? [{ id: 'water' as const, label: TEXT.water[lang], limit: `${TEXT.atMost[lang]} ${formatWithUnit(record.constraints.water.maximum_m3_t, 'm3/t', lang)}` }] : []),
  ];
  const slackUnit = { grade: gradeUnit, power: 'kW', water: 'm3/t' };
  const status = record.optimum
    ? `${TEXT.optimal[lang]}: ${formatWithUnit(record.gain_tph ?? 0, 't/h', lang)} ${TEXT.gain[lang]}${record.gain_pct != null ? ` (${record.gain_pct >= 0 ? '+' : ''}${formatSignificant(record.gain_pct, lang, 3)}%)` : ''}`
    : TEXT.noFeasible[lang];
  const decisionText = (decisions: Record<string, number>) =>
    record.decisions.map(n => `${declared[n].label[lang]} ${formatWithUnit(decisions[n], unitOf(n), lang)}`).join(', ');

  return (
    <div className="of-split">
      <Chart data={[xs, feasible, infeasible] as uPlot.AlignedData} categories={starts.map((_, i) => String(i + 1))}
        xLabel={TEXT.start[lang]} yLabel={TEXT.recovered[lang]} levels={levels} title={TEXT.title[lang]} yRange={yRange}
        series={[{ label: TEXT.feasible[lang], colour: 'good', points: true }, { label: TEXT.infeasible[lang], colour: 'bad', points: true }]}
        summary={TEXT.summary[lang]} format={(v, axis) => (axis === 'x' ? String(v) : formatWithUnit(v, 't/h', lang))}
        onCursor={reading => {
          if (!reading) { onCursor(null); return; }
          const run = starts[reading.index];
          onCursor(`${TEXT.start[lang]} ${reading.index + 1}${reading.index === 0 ? ` (${TEXT.first[lang]})` : ''}: ${decisionText(run.end.decisions)}; `
            + `${formatWithUnit(run.end.recovered_tph, 't/h', lang)}, ${run.evaluations} ${TEXT.evaluations[lang]}`);
        }} />
      <div className="of-aside">
        {modified && <p className="of-note">{TEXT.baked[lang]}</p>}
        <p className={record.optimum ? 'of-status-line' : 'of-status-line warn'}>{status}</p>
        <table className="of-table">
          <thead><tr><th scope="col">{TEXT.quantity[lang]}</th><th scope="col">{TEXT.baseCol[lang]}</th>
            <th scope="col">{record.optimum ? TEXT.optimumCol[lang] : TEXT.leastCol[lang]}</th><th scope="col">{TEXT.bounds[lang]}</th></tr></thead>
          <tbody>
            {record.decisions.map(n => (
              <tr key={n}><th scope="row">{`${declared[n].label[lang]} (${unitLabel(unitOf(n)) || '-'})`}</th>
                <td>{formatValue(record.base.decisions[n], unitOf(n), lang)}</td>
                <td>{formatValue(outcome?.decisions[n], unitOf(n), lang)}</td>
                <td>{`${formatValue(record.bounds[n][0], unitOf(n), lang)} – ${formatValue(record.bounds[n][1], unitOf(n), lang)}`}</td></tr>
            ))}
            {RESULTS.map(row => {
              const unit = row.unit ?? gradeUnit;
              return (
                <tr key={row.metric} className="of-table-group"><th scope="row">{`${metricLabel(row.metric, lang)} (${unitLabel(unit)})`}</th>
                  <td>{formatValue(value(record.base, row.key), unit, lang)}</td>
                  <td>{formatValue(value(outcome, row.key), unit, lang)}</td><td /></tr>
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
        <p className="of-footnote">{`${starts.length} ${TEXT.starts[lang]}, ${record.evaluations} ${TEXT.evaluations[lang]} (COBYLA)`}</p>
      </div>
    </div>
  );
}
