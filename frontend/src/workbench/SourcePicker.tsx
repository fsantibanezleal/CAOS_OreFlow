/**
 * The workbench's source (RS-07, RS-08): a synthetic case, a GeoMet ore sample in the soft porphyry's circuit, or an
 * hour of the iron plant. A sample is chosen from a searchable list of its id and drill hole; an hour from the soft
 * sensor's forward windows. The rail below the picker changes with the source: a sample keeps the plant's operating
 * controls and fixes the ones that describe the datum; an hour has no control, because nothing of it is simulated.
 */
import { useMemo, useState } from 'react';
import type { IronPlant, RealSamples } from '../lib/artifacts';
import { formatFixed, type Lang } from '../lib/format';
import { SOURCES, useWorkbench, type Source } from './state';

export const SOURCE_NAME: Record<Source, { en: string; es: string }> = {
  case: { en: 'Synthetic case', es: 'Caso sintético' },
  sample: { en: 'GeoMet ore sample', es: 'Muestra de mineral GeoMet' },
  hour: { en: 'Iron-plant hour', es: 'Hora de la planta de hierro' },
};
const TEXT = {
  source: { en: 'Source', es: 'Fuente' },
  sample: { en: 'Sample', es: 'Muestra' },
  search: { en: 'Search by id or hole', es: 'Buscar por id o sondaje' },
  hole: { en: 'hole', es: 'sondaje' },
  window: { en: 'Forward window', es: 'Ventana futura' },
  hour: { en: 'Hour', es: 'Hora' },
  none: { en: 'No sample matches.', es: 'Ninguna muestra coincide.' },
  hourNote: {
    en: 'An hour of the plant is a record, not a state to change: every value was measured, so there is no control.',
    es: 'Una hora de la planta es un registro, no un estado que cambiar: cada valor fue medido, así que no hay controles.',
  },
};

export function SourceSwitch({ lang }: { lang: Lang }) {
  const { source, setSource } = useWorkbench();
  return (
    <div className="of-knob">
      <span className="of-knob-title">{TEXT.source[lang]}</span>
      <div className="of-segmented of-segmented-3" role="group" aria-label={TEXT.source[lang]}>
        {SOURCES.map(s => (
          <button key={s} type="button" aria-pressed={s === source} className={s === source ? 'active' : ''} onClick={() => setSource(s)}>{SOURCE_NAME[s][lang]}</button>
        ))}
      </div>
    </div>
  );
}

/**
 * The samples a search names (U-16): "hole 6" or "sondaje 6" in either language gives hole 6 exactly (not 60 and up),
 * a bare number a hole, and any other text a part of the sample id.
 */
export function matchSamples<S extends { id: string; hole: string | number }>(samples: S[], query: string): S[] {
  const q = query.trim().toLowerCase();
  const named = q.match(/^(?:hole|sondaje)\s*(\S+)$/);
  if (named) return samples.filter(s => String(s.hole).toLowerCase() === named[1]);
  return samples.filter(s => !q || s.id.toLowerCase().includes(q) || String(s.hole).toLowerCase() === q);
}

export function SamplePicker({ record, lang }: { record: RealSamples; lang: Lang }) {
  const { sampleId, setSample } = useWorkbench();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => matchSamples(record.samples, query), [record, query]);
  const current = record.samples.find(s => s.id === sampleId) ?? null;
  return (
    <div className="of-knob">
      <label className="of-field"><span>{TEXT.search[lang]}</span>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="of-field"><span>{TEXT.sample[lang]}</span>
        <select value={current && shown.includes(current) ? current.id : ''} onChange={e => {
          const next = record.samples.find(s => s.id === e.target.value);
          if (next) setSample(next.id, next.point);
        }}>
          {current && !shown.includes(current) && <option value="" disabled>{current.id}</option>}
          {shown.map(s => <option key={s.id} value={s.id}>{`${s.id}, ${TEXT.hole[lang]} ${s.hole}: Cu ${formatFixed(s.assays_pct.Cu, lang, 2)}%`}</option>)}
        </select></label>
      {!shown.length && <small className="of-knob-base">{TEXT.none[lang]}</small>}
    </div>
  );
}

export function HourPicker({ lane, lang }: { lane: IronPlant; lang: Lang }) {
  const { hourKey, setHour } = useWorkbench();
  const [fold, index] = (hourKey ?? '2-0').split('-').map(Number);
  const window = lane.folds[fold] ?? lane.folds[lane.folds.length - 1];
  return (
    <div className="of-knob">
      <label className="of-field"><span>{TEXT.window[lang]}</span>
        <select value={window.id} onChange={e => setHour(`${e.target.value}-0`)}>
          {lane.folds.map(f => <option key={f.id} value={f.id}>{`${f.id + 1}: ${f.test_first.slice(0, 10)} - ${f.test_last.slice(0, 10)}`}</option>)}
        </select></label>
      <label className="of-field"><span>{TEXT.hour[lang]}</span>
        <select value={Math.min(index, window.trace.length - 1)} onChange={e => setHour(`${window.id}-${e.target.value}`)}>
          {window.trace.map((t, i) => <option key={t.sensor_hour} value={i}>{t.sensor_hour.slice(0, 16)}</option>)}
        </select></label>
      <small className="of-knob-base">{TEXT.hourNote[lang]}</small>
    </div>
  );
}

/** The traced hour a key names, the last window's first hour when the key is missing or stale. */
export function hourOf(lane: IronPlant, hourKey: string | null) {
  const [fold, index] = (hourKey ?? '2-0').split('-').map(Number);
  const window = lane.folds[fold] ?? lane.folds[lane.folds.length - 1];
  const i = Number.isFinite(index) ? Math.min(Math.max(index, 0), window.trace.length - 1) : 0;
  return { window, index: i, hour: window.trace[i] };
}
