/**
 * Compare view (design §12.1, view 6): the six variants of the case side by side, each a single-factor
 * change from the nominal state (PE-32), and the twelve cases at their nominal states on one map of
 * recovery against specific energy. Every number is the bake's: the variants from the case artifact,
 * the cases from benchmark.json, whose variant metrics the artifact checks hold equal to the artifacts.
 */
import { useState } from 'react';
import type uPlot from 'uplot';
import type { OperatingContract } from '../../engine/contract';
import type { Benchmark, CaseArtifact, CaseIndex } from '../../lib/artifacts.types';
import { formatValue, formatWithUnit, unitLabel, type Lang } from '../../lib/format';
import { flagShort, flagText, metricLabel } from '../../lib/i18n';
import { Chart } from '../../components/charts/Chart';

const METRICS = ['recovery_pct', 'concentrate_grade', 'recovered_primary_tph', 'specific_energy_total_kwh_t', 'p80_um', 'mill_power_kw', 'water_intensity_m3_t'];
const TABLE = ['recovery_pct', 'concentrate_grade', 'recovered_primary_tph', 'specific_energy_total_kwh_t', 'p80_um', 'mill_power_kw'];
const TEXT = {
  metric: { en: 'Metric', es: 'Métrica' },
  variant: { en: 'Variant', es: 'Variante' },
  change: { en: 'Change from nominal', es: 'Cambio respecto del nominal' },
  flags: { en: 'Engine flags', es: 'Avisos del motor' },
  none: { en: 'none', es: 'ninguno' },
  nominal: { en: 'nominal', es: 'nominal' },
  energy: { en: 'Specific energy (kWh/t)', es: 'Energía específica (kWh/t)' },
  recovery: { en: 'Recovery (%)', es: 'Recuperación (%)' },
  cases: { en: 'Cases at their nominal state', es: 'Casos en su estado nominal' },
  thisCase: { en: 'This case', es: 'Este caso' },
  selected: { en: 'Selected variant', es: 'Variante elegida' },
  variantsTitle: { en: 'Variants of this case (numbered as in the table)', es: 'Variantes de este caso (numeradas como en la tabla)' },
  variantsSummary: { en: 'The chosen metric for each variant of the case, against the nominal state.', es: 'La métrica elegida para cada variante del caso, frente al estado nominal.' },
  casesSummary: { en: 'Recovery against total specific energy for the twelve cases at their nominal states.', es: 'Recuperación contra energía específica total de los doce casos en su estado nominal.' },
};

export function CompareView({ contract, artifact, index, benchmark, variantId, lang, onCursor }: {
  contract: OperatingContract; artifact: CaseArtifact; index: CaseIndex; benchmark: Benchmark | null; variantId: string; lang: Lang;
  onCursor: (text: string | null) => void;
}) {
  const [metric, setMetric] = useState('recovery_pct');
  const entry = contract.cases[artifact.case_id];
  const declared = Object.fromEntries(contract.inputs.map(s => [s.name, s]));
  const unitOfMetric = (key: string) => (key === 'concentrate_grade' ? entry.primary.unit : artifact.variants[0].trace.metric_units[key] ?? '');
  const unitOfInput = (name: string) => (declared[name].unit === 'case' ? entry.primary.unit : declared[name].unit);
  const variants = artifact.variants;
  const values = variants.map(v => v.trace.metrics[metric] ?? null);
  const nominal = variants.find(v => v.id === 'nominal')?.trace.metrics[metric];
  const unit = unitOfMetric(metric);
  const selected = variants.findIndex(v => v.id === variantId);
  // `change` holds the factor the variant applies; the value it sets is the variant's own point
  const change = (v: (typeof variants)[number]) => {
    const name = Object.keys(v.change)[0];
    return name ? `${declared[name]?.label[lang] ?? name} ${formatWithUnit(v.point[name as keyof typeof v.point], unitOfInput(name), lang)}` : TEXT.nominal[lang];
  };

  // the twelve cases, sorted by energy for the aligned x axis; this case drawn again as its own series
  const rows = (benchmark?.cases ?? []).map(c => ({
    id: c.case_id,
    title: index.cases.find(e => e.case_id === c.case_id)?.title[lang] ?? c.case_id,
    energy: c.variants.nominal.specific_energy_total_kwh_t as number,
    recovery: c.variants.nominal.recovery_pct as number,
  })).sort((a, b) => a.energy - b.energy);

  return (
    <div className="of-view of-view-compare">
      <div className="of-controls" role="group">
        <label className="of-field"><span>{TEXT.metric[lang]}</span>
          <select value={metric} onChange={e => setMetric(e.target.value)}>{METRICS.map(k => <option key={k} value={k}>{metricLabel(k, lang)}</option>)}</select></label>
      </div>
      <div className="of-compare-charts">
        <Chart data={[variants.map((_, i) => i), values, values.map((v, i) => (i === selected ? v : null))] as uPlot.AlignedData}
          categories={variants.map((_, i) => String(i + 1))} xLabel={TEXT.variant[lang]} yLabel={`${metricLabel(metric, lang)} (${unitLabel(unit)})`}
          title={TEXT.variantsTitle[lang]}
          series={[{ label: metricLabel(metric, lang), colour: 'accent', points: true }, { label: TEXT.selected[lang], colour: 'warn', points: true }]}
          levels={nominal !== undefined ? [{ y: nominal, label: TEXT.nominal[lang] }] : []}
          summary={TEXT.variantsSummary[lang]} format={(v, axis) => (axis === 'x' ? String(v) : formatValue(v, unit, lang))}
          onCursor={reading => onCursor(reading ? `${variants[reading.index].label[lang]} (${change(variants[reading.index])}): ${formatWithUnit(reading.values[0], unit, lang)}` : null)} />
        {rows.length > 0 && (
          <Chart data={[rows.map(r => r.energy), rows.map(r => r.recovery), rows.map(r => (r.id === artifact.case_id ? r.recovery : null))] as uPlot.AlignedData}
            xLabel={TEXT.energy[lang]} yLabel={TEXT.recovery[lang]} pointLabels={rows.map(r => r.title)} title={TEXT.cases[lang]}
            pointLabelFirst={rows.findIndex(r => r.id === artifact.case_id)}
            series={[{ label: TEXT.cases[lang], colour: 'accent-2', points: true }, { label: TEXT.thisCase[lang], colour: 'warn', points: true }]}
            summary={TEXT.casesSummary[lang]} format={(v, axis) => (axis === 'x' ? formatValue(v, 'kWh/t', lang) : formatValue(v, '%', lang))}
            onCursor={reading => onCursor(reading ? `${rows[reading.index].title}: ${formatWithUnit(rows[reading.index].recovery, '%', lang)}, ${formatWithUnit(rows[reading.index].energy, 'kWh/t', lang)}` : null)} />
        )}
      </div>
      <table className="of-table of-table-wide of-compare-table">
        <thead><tr><th scope="col">#</th><th scope="col">{TEXT.variant[lang]}</th><th scope="col">{TEXT.change[lang]}</th>
          {TABLE.map(k => <th scope="col" key={k}>{`${metricLabel(k, lang)} (${unitLabel(unitOfMetric(k))})`}</th>)}<th scope="col">{TEXT.flags[lang]}</th></tr></thead>
        <tbody>{variants.map((v, i) => (
          <tr key={v.id} className={v.id === variantId ? 'is-selected' : undefined}><td>{i + 1}</td><th scope="row" title={v.label[lang]}>{v.label[lang]}</th><td>{change(v)}</td>
            {TABLE.map(k => <td key={k}>{formatValue(v.trace.metrics[k], unitOfMetric(k), lang)}</td>)}
            <td title={v.trace.flags.map(f => flagText(f.code, lang)).join(' ')}>{v.trace.flags.length ? v.trace.flags.map(f => flagShort(f.code, lang)).join(', ') : TEXT.none[lang]}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
