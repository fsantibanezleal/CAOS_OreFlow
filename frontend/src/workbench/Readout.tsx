/**
 * The readout row: the headline metrics of the current state and every engine flag, in one row that
 * never wraps (ADR-0071 rule 4), formatted in the interface language. A chart's cursor reading is shown
 * at the end of the same row, so every instrument reports to the same place.
 */
import type { Trace } from '../engine/trace';
import { formatWithUnit, type Lang } from '../lib/format';
import { flagText, metricLabel, t, UI } from '../lib/i18n';

const HEADLINE = ['recovery_pct', 'concentrate_grade', 'specific_energy_total_kwh_t', 'p80_um', 'mill_power_kw'];

export function Readout({ trace, lang, computing, cursor }: { trace: Trace | null; lang: Lang; computing: boolean; cursor?: string | null }) {
  if (!trace) return <div className="of-readout" role="status">{t(UI.loading, lang)}</div>;
  const flags = trace.flags;
  // the row never wraps, so a status cut at its end is still named in full on hover
  const status = flags.length ? flags.map(f => flagText(f.code, lang)).join(' · ') : t(UI.noFlags, lang);
  return (
    <div className="of-readout" role="status" aria-live="polite">
      {HEADLINE.filter(key => key in trace.metrics).map(key => (
        <span key={key} className="of-readout-item">
          <span className="of-readout-label">{metricLabel(key, lang)}</span>
          <strong>{formatWithUnit(trace.metrics[key], trace.metric_units[key], lang)}</strong>
        </span>
      ))}
      <span className={`of-readout-flags${flags.length ? ' warn' : ''}`} title={status}>{status}</span>
      {computing && <span className="of-readout-busy">{t(UI.computing, lang)}</span>}
      {cursor && <span className="of-readout-cursor" title={cursor}>{cursor}</span>}
    </div>
  );
}
