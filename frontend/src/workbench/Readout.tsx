/**
 * The readout row: the headline metrics of the current state and every engine flag, in one row that
 * never wraps (ADR-0071 rule 4), formatted in the interface language. A chart's cursor reading is shown
 * at the end of the same row, so every instrument reports to the same place.
 */
import type { Trace } from '../engine/trace';
import { flaggedFacts } from './views/GrindingView';
import { formatWithUnit, type Lang } from '../lib/format';
import { flagShort, flagText, metricLabel, t, UI } from '../lib/i18n';

const HEADLINE = ['recovery_pct', 'concentrate_grade', 'specific_energy_total_kwh_t', 'p80_um', 'mill_power_kw'];

export function Readout({ trace, lang, computing, cursor, rejected }: {
  trace: Trace | null; lang: Lang; computing: boolean; cursor?: string | null; rejected?: string[] | null;
}) {
  if (rejected) {
    // U-03: a rejected state has no metrics; the last valid ones are not shown as current
    // the messages themselves are in the rail and the view host; the row names the state
    return <div className="of-readout" role="status" aria-live="polite"><span className="of-readout-flags warn" title={rejected.join(' ')}>{t(UI.rejected, lang)}</span></div>;
  }
  if (!trace) return <div className="of-readout" role="status">{t(computing ? UI.computing : UI.loading, lang)}</div>;
  const flags = trace.flags;
  // U-23: the row never wraps, so it names the flags short; FlagsLine gives the full sentences under the tabs
  const status = flags.length ? flags.map(f => flagShort(f.code, lang)).join(' · ') : t(UI.noFlags, lang);
  const full = flags.length ? flags.map(f => flagText(f.code, lang)).join(' ') : status;
  const flagged = flaggedFacts(trace);
  return (
    <div className="of-readout" role="status" aria-live="polite">
      {HEADLINE.filter(key => key in trace.metrics).map(key => (
        <span key={key} className={flagged.has(key) ? 'of-readout-item warn' : 'of-readout-item'}>
          <span className="of-readout-label">{metricLabel(key, lang)}</span>
          <strong>{formatWithUnit(trace.metrics[key], trace.metric_units[key], lang)}</strong>
        </span>
      ))}
      <span className={`of-readout-flags${flags.length ? ' warn' : ''}`} title={full}>{status}</span>
      {computing && <span className="of-readout-busy">{t(UI.computing, lang)}</span>}
      {cursor && <span className="of-readout-cursor" title={cursor}>{cursor}</span>}
    </div>
  );
}

/** U-23: the full sentences of the current state's flags, on their own line under the view tabs. */
export function FlagsLine({ trace, lang }: { trace: Trace | null; lang: Lang }) {
  if (!trace || trace.flags.length === 0) return null;
  return <p className="of-flags-line" role="note">{trace.flags.map(f => flagText(f.code, lang)).join(' ')}</p>;
}
