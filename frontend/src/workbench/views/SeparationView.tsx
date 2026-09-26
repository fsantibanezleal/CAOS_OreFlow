/**
 * Separation view, by family: for flotation the rougher recovery by size, the grade-recovery curve down
 * the rougher bank and the kinetic record (batch curve, five lumped fits and their bank projections);
 * for magnetite the LIMS capture by particle class; for phosphate the desliming partition. Every curve is
 * the trace's own; nothing is computed here. The charts are built by `separationCharts`, so the focus
 * route can put any one of them on its stage.
 */
import type { ReactNode } from 'react';
import type uPlot from 'uplot';
import type { Trace } from '../../engine/trace';
import { formatSignificant, formatWithUnit, type Lang } from '../../lib/format';
import { formulaText, metricLabel, speciesName } from '../../lib/i18n';
import { Chart, type CursorReading, type Series } from '../../components/charts/Chart';

type KineticModel = { id: string; parameters: Record<string, number>; parameter_units: Record<string, string>; rmse_pct: number; converged: boolean;
  dense_pct: number[]; bank_projection_pct: number; lumping_error_pct: number; ultimate_gap_pct: number };
type Kinetics = { status: string; times_min?: number[]; batch_recovery_pct?: number[]; dense_times_min?: number[];
  bank?: { cells: number; residence_min: number; exact_true_flotation_pct: number; engine_rougher_pct: number }; models?: KineticModel[] };

const MODEL_NAMES: Record<string, [string, string]> = {
  first_order: ['First order', 'Primer orden'], kelsall: ['Kelsall', 'Kelsall'], klimpel: ['Klimpel', 'Klimpel'],
  gamma: ['Gamma', 'Gamma'], stretched_exponential: ['Stretched exponential', 'Exponencial estirada'],
};
const TEXT = {
  size: { en: 'Particle size (µm)', es: 'Tamaño de partícula (µm)' },
  recovery: { en: 'Rougher recovery', es: 'Recuperación rougher' },
  payable: { en: 'Payable', es: 'Pagable' },
  host: { en: 'Host gangue', es: 'Ganga huésped' },
  entrained: { en: 'Entrained share of host gangue', es: 'Fracción arrastrada de la ganga' },
  cumRecovery: { en: 'Cumulative recovery (%)', es: 'Recuperación acumulada (%)' },
  grade: { en: 'Cumulative grade', es: 'Ley acumulada' },
  time: { en: 'Batch time (min)', es: 'Tiempo de laboratorio (min)' },
  batch: { en: 'Virtual batch test', es: 'Prueba batch virtual' },
  capture: { en: 'LIMS capture', es: 'Captura LIMS' },
  under: { en: 'Fraction to underflow', es: 'Fracción a la descarga' },
  cut: { en: 'desliming cut', es: 'corte de deslamado' },
  model: { en: 'Model', es: 'Modelo' },
  rmse: { en: 'Fit RMSE', es: 'RMSE del ajuste' },
  projection: { en: 'Bank', es: 'Banco' },
  lumping: { en: 'Lumping', es: 'Agregación' },
  gap: { en: 'Beyond test', es: 'Tras la prueba' },
  points: { en: 'Errors in percentage points.', es: 'Errores en puntos porcentuales.' },
  exact: { en: 'Exact bank (all classes)', es: 'Banco exacto (todas las clases)' },
  engine: { en: 'Engine rougher (with entrainment)', es: 'Rougher del motor (con arrastre)' },
  sizeSummary: { en: 'Rougher recovery by size for the payable and the host gangue, with the entrained share of that gangue.', es: 'Recuperación rougher por tamaño del pagable y de la ganga huésped, con la fracción arrastrada de esa ganga.' },
  profileSummary: { en: 'Cumulative grade against cumulative recovery cell by cell down the rougher bank.', es: 'Ley acumulada contra recuperación acumulada, celda por celda, a lo largo del banco rougher.' },
  kineticsSummary: { en: 'Batch recovery of the rougher feed and the five lumped kinetic fits.', es: 'Recuperación batch de la alimentación rougher y los cinco ajustes cinéticos agregados.' },
  captureSummary: { en: 'LIMS rougher capture by size for liberated magnetite, composites and entrapped gangue.', es: 'Captura del LIMS rougher por tamaño para magnetita liberada, mixtos y ganga atrapada.' },
  deslimeSummary: { en: 'Desliming partition to underflow by particle class; finer material reports to the slimes.', es: 'Partición del deslamado a la descarga por clase de partícula; el material fino va a las lamas.' },
};

const ascending = (x: number[], ...ys: (number | null)[][]): uPlot.AlignedData => {
  const order = x.map((_, i) => i).reverse();
  return [order.map(i => x[i]), ...ys.map(y => order.map(i => y[i]))] as uPlot.AlignedData;
};
const PALETTE: Series['colour'][] = ['accent', 'good', 'warn', 'magenta', 'accent-2', 'bad'];

export type SeparationChart = 'recovery_by_size' | 'bank_profile' | 'kinetics' | 'deslime' | 'capture';
export const SEPARATION_CHARTS: Record<SeparationChart, { en: string; es: string }> = {
  recovery_by_size: { en: 'Recovery by size', es: 'Recuperación por tamaño' },
  bank_profile: { en: 'Grade and recovery down the bank', es: 'Ley y recuperación a lo largo del banco' },
  kinetics: { en: 'Batch kinetics', es: 'Cinética batch' },
  deslime: { en: 'Desliming partition', es: 'Partición del deslamado' },
  capture: { en: 'LIMS capture', es: 'Captura LIMS' },
};

/** The separation charts a trace carries: flotation curves, the desliming partition, or the LIMS capture. */
export function separationCharts(trace: Trace, primary: { species: string; unit: string }, lang: Lang, onCursor: (text: string | null) => void): Partial<Record<SeparationChart, ReactNode>> {
  const curves = trace.curves as Record<string, unknown>;
  const size = curves.size_um as number[];
  const fmtSize = (v: number | null, axis: 'x' | 'y') => (axis === 'x' ? formatWithUnit(v, 'um', lang) : formatSignificant(v, lang, 3));
  const report = (xUnit: string, labels: string[]) => (reading: CursorReading | null) => {
    if (!reading) { onCursor(null); return; }
    onCursor(`${formatWithUnit(reading.x, xUnit, lang)}: ${reading.values.map((v, i) => `${labels[i]} ${formatSignificant(v, lang, 3)}`).join(', ')}`);
  };

  if (curves.capture) {
    const capture = curves.capture as Record<string, number[]>;
    const keys = Object.keys(capture);
    return {
      capture: (
        <Chart key="capture" title={SEPARATION_CHARTS.capture[lang]} data={ascending(size, ...keys.map(k => capture[k]))} logX xLabel={TEXT.size[lang]} yLabel={TEXT.capture[lang]} yRange={[0, 1]}
          series={keys.map((k, i) => ({ label: speciesName(k, lang), colour: PALETTE[i % PALETTE.length] }))} summary={TEXT.captureSummary[lang]} format={fmtSize} onCursor={report('um', keys.map(k => speciesName(k, lang)))} />
      ),
    };
  }

  const kinetics = (trace.methods as { kinetics: Kinetics }).kinetics;
  const bySize = curves.recovery_by_size as { primary: (number | null)[]; host_gangue: number[]; host_gangue_entrained_share: number[] };
  const profile = curves.bank_profile as Array<{ cell: number; recovery: number; grade: number }>;
  const deslime = curves.deslime_partition as Record<string, number[]> | undefined;
  const gradeUnit = primary.unit;
  const gradeScale = gradeUnit === '%' ? 100.0 : 1.0e6;
  const dense = kinetics.dense_times_min ?? [];
  const batchSeries = dense.map(tm => {
    const k = (kinetics.times_min ?? []).findIndex(bt => Math.abs(bt - tm) < 1e-9);
    return k >= 0 ? (kinetics.batch_recovery_pct ?? [])[k] : null;
  });
  const models = kinetics.models ?? [];
  return {
    recovery_by_size: (
      <Chart key="recovery_by_size" title={SEPARATION_CHARTS.recovery_by_size[lang]} data={ascending(size, bySize.primary, bySize.host_gangue, bySize.host_gangue_entrained_share)} logX xLabel={TEXT.size[lang]} yLabel={TEXT.recovery[lang]} yRange={[0, 1]}
        series={[{ label: `${TEXT.payable[lang]} ${formulaText(primary.species)}`, colour: 'good' }, { label: TEXT.host[lang], colour: 'bad' }, { label: TEXT.entrained[lang], colour: 'warn', dash: [5, 4] }]}
        summary={TEXT.sizeSummary[lang]} format={fmtSize} onCursor={report('um', [TEXT.payable[lang], TEXT.host[lang], TEXT.entrained[lang]])} />
    ),
    bank_profile: (
      <Chart key="bank_profile" title={SEPARATION_CHARTS.bank_profile[lang]} data={[profile.map(p => 100.0 * p.recovery), profile.map(p => p.grade * gradeScale)] as uPlot.AlignedData}
        xLabel={TEXT.cumRecovery[lang]} yLabel={`${TEXT.grade[lang]} ${formulaText(primary.species)} (${gradeUnit})`}
        series={[{ label: TEXT.grade[lang], colour: 'accent', points: true }]} summary={TEXT.profileSummary[lang]}
        format={v => formatSignificant(v, lang, 3)} onCursor={report('%', [TEXT.grade[lang]])} />
    ),
    ...(models.length > 0 ? {
      kinetics: (
        <Chart key="kinetics" title={SEPARATION_CHARTS.kinetics[lang]} data={[dense, batchSeries, ...models.map(md => md.dense_pct)] as uPlot.AlignedData} xLabel={TEXT.time[lang]} yLabel={`${TEXT.recovery[lang]} (%)`}
          series={[{ label: TEXT.batch[lang], colour: 'subtle', points: true }, ...models.map((md, i) => ({ label: MODEL_NAMES[md.id][lang === 'es' ? 1 : 0], colour: PALETTE[(i + 1) % PALETTE.length] }))]}
          summary={TEXT.kineticsSummary[lang]} format={(v, axis) => (axis === 'x' ? formatWithUnit(v, 'min', lang) : formatSignificant(v, lang, 3))}
          onCursor={report('min', [TEXT.batch[lang], ...models.map(md => MODEL_NAMES[md.id][lang === 'es' ? 1 : 0])])} />
      ),
    } : {}),
    ...(deslime ? {
      deslime: (
        <Chart key="deslime" title={SEPARATION_CHARTS.deslime[lang]} data={ascending(size, ...Object.values(deslime))} logX xLabel={TEXT.size[lang]} yLabel={TEXT.under[lang]} yRange={[0, 1]}
          series={Object.keys(deslime).map((k, i) => ({ label: speciesName(k, lang), colour: PALETTE[i % PALETTE.length] }))} summary={TEXT.deslimeSummary[lang]} format={fmtSize}
          marks={[{ x: (trace.point as { deslime_cut_um: number }).deslime_cut_um, label: TEXT.cut[lang] }]} onCursor={report('um', Object.keys(deslime).map(k => speciesName(k, lang)))} />
      ),
    } : {}),
  };
}

export function SeparationView({ trace, primary, lang, onCursor }: { trace: Trace; primary: { species: string; unit: string }; lang: Lang; onCursor: (text: string | null) => void }) {
  const charts = separationCharts(trace, primary, lang, onCursor);
  const m = trace.metrics;
  if (charts.capture) {
    return (
      // the facts, a strip under the chart (of-grid-single)
      <div className="of-view of-grid-single">
        {charts.capture}
        <Facts trace={trace} lang={lang} framed keys={['recovery_pct', 'magnetite_recovery_pct', 'concentrate_grade', 'concentrate_SiO2', 'mass_pull_pct', 'tail_grade']} />
      </div>
    );
  }
  const kinetics = (trace.methods as { kinetics: Kinetics }).kinetics;
  const models = kinetics.models ?? [];
  return (
    // the kinetic table and the facts, a strip under the charts on a large screen (of-grid-strip-panel)
    <div className="of-view of-grid-2x2 of-grid-strip-panel">
      {charts.recovery_by_size}
      {charts.bank_profile}
      {charts.deslime ?? charts.kinetics}
      <div className="of-panel">
        {models.length > 0 && kinetics.bank && (
          <table className="of-table">
            <caption>{`${TEXT.exact[lang]}: ${formatWithUnit(kinetics.bank.exact_true_flotation_pct, '%', lang)} · ${TEXT.engine[lang]}: ${formatWithUnit(kinetics.bank.engine_rougher_pct, '%', lang)}. ${TEXT.points[lang]}`}</caption>
            <thead><tr><th scope="col">{TEXT.model[lang]}</th><th scope="col">{TEXT.rmse[lang]}</th><th scope="col">{TEXT.projection[lang]}</th><th scope="col">{TEXT.lumping[lang]}</th><th scope="col">{TEXT.gap[lang]}</th></tr></thead>
            <tbody>{models.map(md => (
              <tr key={md.id}><th scope="row">{MODEL_NAMES[md.id][lang === 'es' ? 1 : 0]}{md.converged ? '' : ' *'}</th>
                <td>{formatSignificant(md.rmse_pct, lang, 2)}</td><td>{formatWithUnit(md.bank_projection_pct, '%', lang)}</td>
                <td>{formatSignificant(md.lumping_error_pct, lang, 2)}</td><td>{formatSignificant(md.ultimate_gap_pct, lang, 2)}</td></tr>
            ))}</tbody>
          </table>
        )}
        <Facts trace={trace} lang={lang} keys={['flotation_recovery_pct', 'rougher_recovery_pct', 'cleaner_recovery_pct', 'recleaner_recovery_pct', 'rougher_residence_min',
          'bubble_surface_flux_s', 'rougher_water_recovery_pct', 'entrained_gangue_share_pct', 'cleaner_recycle_tph', 'slimes_mass_pct', 'slimes_loss_pct', 'gravity_recovery_pct', 'gold_circulating_load_pct',
          // a second payable's own recovery (molybdenum beside copper)
          ...Object.keys(m).filter(k => /^recovery_[A-Za-z0-9]+_pct$/.test(k) && k !== `recovery_${primary.species}_pct`)].filter(k => k in m)} />
      </div>
    </div>
  );
}

// framed: a facts list that stands in the grid by itself (in a panel it takes the panel's frame)
function Facts({ trace, lang, keys, framed = false }: { trace: Trace; lang: Lang; keys: string[]; framed?: boolean }) {
  return (
    <dl className={framed ? 'of-facts of-grid-facts' : 'of-facts'}>
      {keys.filter(k => k in trace.metrics).map(k => <div key={k}><dt>{metricLabel(k, lang)}</dt><dd>{formatWithUnit(trace.metrics[k], trace.metric_units[k], lang)}</dd></div>)}
    </dl>
  );
}
